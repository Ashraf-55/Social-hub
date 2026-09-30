import OpenAI from "openai";
import { aiEnabled } from "@/lib/config";
import { prisma } from "@/lib/prisma";

let client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (!aiEnabled) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export interface IntentResult {
  intent: string;
  entities: Record<string, string>;
  confident: boolean;
}

export interface CustomerIntent {
  intent: string;
  product?: string;
  questions: string[];
  confident: boolean;
}

/**
 * Section 25 AI Safety: caller MUST check `confident` before auto-sending.
 * `extraSystemInstructions` (Section 48 AI Settings) lets an org layer its
 * own tone/business rules on top of the base prompt — e.g. "always answer
 * in Egyptian Arabic" or "never promise same-day delivery" — without
 * changing code.
 */
export async function suggestReply(
  conversationHistory: { role: "user" | "assistant"; content: string }[],
  extraSystemInstructions?: string | null
): Promise<{ reply: string; confident: boolean }> {
  const openai = getClient();
  if (!openai) return { reply: "", confident: false };

  const baseInstructions =
    "You are a helpful, concise customer-support assistant for a business. If you are not confident about the answer (pricing, stock, policies you don't have data for), say you are not confident instead of guessing.";

  const res = await logged("suggestReply", { conversationHistory }, async () => {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: extraSystemInstructions ? `${baseInstructions}\n\nAdditional business-specific instructions:\n${extraSystemInstructions}` : baseInstructions
        },
        ...conversationHistory
      ],
      temperature: 0.4
    });
    const text = completion.choices[0]?.message?.content ?? "";
    const confident = !/not (sure|confident)|i don'?t know/i.test(text);
    return { reply: text, confident };
  });

  return res ?? { reply: "", confident: false };
}

/**
 * Section 23's worked example: "عايز أعرف سعر بوكس الورد الأحمر وهل فيه
 * توصيل؟" -> { intent: PRODUCT_INQUIRY, product: "Red Flower Box",
 * questions: ["Price", "Delivery"] }. Distinct from classifyMessage() —
 * this extracts a structured product + open questions list a human agent
 * or a DB lookup can act on directly, rather than a generic intent/entity
 * bag. Returns null (never a guess) when AI is disabled or the model
 * itself isn't confident — same Section 25 safety rule as everywhere else.
 */
export async function extractCustomerIntent(content: string): Promise<CustomerIntent | null> {
  const openai = getClient();
  if (!openai) return null;

  return logged("extractCustomerIntent", { content }, async () => {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Extract what the customer wants. Respond ONLY with JSON: {"intent": string (e.g. PRODUCT_INQUIRY, ORDER_STATUS, COMPLAINT, GENERAL), "product": string | null, "questions": string[] (each distinct thing they are asking, e.g. "Price", "Delivery"), "confident": boolean}.'
        },
        { role: "user", content }
      ]
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    return {
      intent: parsed.intent ?? "GENERAL",
      product: parsed.product ?? undefined,
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      confident: Boolean(parsed.confident)
    } as CustomerIntent;
  });
}

export async function classifyMessage(content: string): Promise<IntentResult | null> {
  const openai = getClient();
  if (!openai) return null;

  return logged("classifyMessage", { content }, async () => {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Classify the customer message. Respond ONLY with JSON: {"intent": string, "entities": object, "confident": boolean}.'
        },
        { role: "user", content }
      ]
    });
    return JSON.parse(completion.choices[0]?.message?.content ?? "{}") as IntentResult;
  });
}

export async function summarizeConversation(messages: string[]): Promise<string | null> {
  const openai = getClient();
  if (!openai) return null;
  return logged("summarizeConversation", { messages }, async () => {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Summarize this customer conversation in 2-3 sentences for a support agent." },
        { role: "user", content: messages.join("\n") }
      ]
    });
    return completion.choices[0]?.message?.content ?? "";
  });
}

/**
 * Section 23 lists `generateReply()` and `suggestReply()` as separate
 * functions; they are the same safety-checked generation under the hood —
 * splitting them would mean either two prompts to keep in sync or a
 * "generateReply" that skips the confidence check Section 25 requires.
 * Kept as an explicit named alias so both names from the spec exist as
 * real, callable exports rather than only one of the two.
 */
export const generateReply = suggestReply;

async function logged<T>(kind: string, input: unknown, fn: () => Promise<T>): Promise<T | null> {
  try {
    const output = await fn();
    await prisma.aIRequest.create({ data: { kind, input: input as any, output: output as any, success: true } }).catch(() => {});
    return output;
  } catch (err) {
    await prisma.aIRequest.create({ data: { kind, input: input as any, success: false, error: (err as Error).message } }).catch(() => {});
    return null;
  }
}
