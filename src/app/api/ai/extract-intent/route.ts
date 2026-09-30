import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { extractCustomerIntent } from "@/modules/ai/ai.service";
import { aiEnabled } from "@/lib/config";

/**
 * Section 23's extractCustomerIntent(), exposed so an employee can pull a
 * structured read (intent + product + open questions) of a customer's
 * latest message on demand — e.g. before replying in a Product Inquiry
 * conversation — without switching the whole conversation into AI Mode.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!aiEnabled) return NextResponse.json({ error: "AI is disabled (no OPENAI_API_KEY / AI_ENABLED=false)." }, { status: 400 });

  const { conversationId } = await request.json().catch(() => ({}));
  if (!conversationId) return NextResponse.json({ error: "Missing conversationId" }, { status: 400 });

  const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, organizationId: session.organizationId } });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lastInbound = await prisma.message.findFirst({
    where: { conversationId, direction: "INBOUND", content: { not: null } },
    orderBy: { createdAt: "desc" }
  });
  if (!lastInbound?.content) return NextResponse.json({ error: "No inbound text message to analyze" }, { status: 400 });

  const result = await extractCustomerIntent(lastInbound.content);
  if (!result) return NextResponse.json({ error: "AI could not analyze this message" }, { status: 502 });

  return NextResponse.json({ result });
}
