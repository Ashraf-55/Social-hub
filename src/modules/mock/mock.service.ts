import { prisma } from "@/lib/prisma";
import { PlatformId } from "@/types/unified-message";
import { ingestWebhookEvent } from "@/services/webhook.service";
import { randomUUID } from "crypto";

const SAMPLE_MESSAGES: Record<PlatformId, string[]> = {
  whatsapp: ["عايز أعرف السعر", "في توصيل لمدينة نصر؟", "الطلب وصل امتى؟"],
  instagram: ["في توصيل؟", "عندكم الوان تانية؟", "ممكن صورة للمنتج؟"],
  messenger: ["ازاي اطلب؟", "فيه عرض النهاردة؟"],
  tiktok: ["شفت الفيديو بتاعكم، السعر كام؟"]
};

/**
 * Simulates an inbound webhook event end-to-end (customer -> conversation ->
 * message -> automation -> AI/n8n dispatch) without touching any real
 * platform API. Lets the whole app (Inbox, Automations, AI, Employee
 * Assignment) be developed and demoed before real credentials exist
 * (Section 44).
 *
 * `content`: pass real text (e.g. what a test "customer" would actually
 * type) to properly exercise Automation Rules and AI Mode against it,
 * instead of a random sample line.
 * `customerKey`: a stable identifier so repeated calls simulate the *same*
 * customer continuing one conversation, rather than a new random person
 * every time — closer to a real back-and-forth test.
 */
export async function simulateInboundMessage(
  organizationId: string,
  platform: PlatformId,
  options?: { content?: string; customerName?: string; customerKey?: string }
) {
  // Ensure there is a "mock-connected" integration row for this platform so
  // ingestWebhookEvent can resolve an organization.
  await prisma.socialIntegration.upsert({
    where: { organizationId_platform: { organizationId, platform: platform.toUpperCase() as any } },
    update: { status: "CONNECTED" },
    create: { organizationId, platform: platform.toUpperCase() as any, status: "CONNECTED", externalAccountName: `Mock ${platform}` }
  });

  const externalCustomerId = options?.customerKey ? `mock-${platform}-${options.customerKey}` : `mock-${platform}-${Math.floor(Math.random() * 1000)}`;
  const text = options?.content?.trim() || SAMPLE_MESSAGES[platform][Math.floor(Math.random() * SAMPLE_MESSAGES[platform].length)];

  return ingestWebhookEvent({
    platform,
    externalEventId: randomUUID(),
    rawPayload: { mock: true },
    messages: [
      {
        platform,
        externalMessageId: randomUUID(),
        customerExternalId: externalCustomerId,
        customerDisplayName: options?.customerName ?? "عميل تجريبي",
        direction: "inbound",
        type: "text",
        content: text,
        timestamp: new Date()
      }
    ]
  });
}
