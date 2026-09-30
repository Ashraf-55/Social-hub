import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getAdapter } from "@/modules/platforms/registry";
import { resolveAccessToken } from "@/services/token.service";
import { hasPermission, requirePermission } from "@/lib/permissions";

const PAGE_SIZE = 50;

/**
 * GET /api/conversations/:id/messages?before=<messageId> — lazy-loads one
 * older page of messages (Section 39: never load thousands of messages at
 * once). The Inbox thread starts with the recent page already returned by
 * `GET /api/conversations/:id`; scrolling to the top of the thread calls
 * this with the oldest currently-loaded message's id to fetch the previous
 * 50, until `hasMore` comes back false.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversation = await prisma.conversation.findFirst({ where: { id: params.id, organizationId: session.organizationId } });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const beforeId = request.nextUrl.searchParams.get("before");
  let beforeCreatedAt: Date | undefined;
  if (beforeId) {
    const beforeMessage = await prisma.message.findUnique({ where: { id: beforeId }, select: { createdAt: true } });
    beforeCreatedAt = beforeMessage?.createdAt;
  }

  const olderMessagesDesc = await prisma.message.findMany({
    where: { conversationId: conversation.id, ...(beforeCreatedAt ? { createdAt: { lt: beforeCreatedAt } } : {}) },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1, // fetch one extra to know if there's another page after this
    include: { attachments: true }
  });

  const hasMore = olderMessagesDesc.length > PAGE_SIZE;
  const messages = olderMessagesDesc.slice(0, PAGE_SIZE).reverse(); // chronological order

  return NextResponse.json({ messages, hasMore });
}

const sendSchema = z.object({ content: z.string().min(1).max(4000) });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  requirePermission(await hasPermission(session.userId, session.role, "REPLY_MESSAGES"));

  const body = sendSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const conversation = await prisma.conversation.findFirst({
    where: { id: params.id, organizationId: session.organizationId },
    include: { customer: true }
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const platform = conversation.platform.toLowerCase() as "whatsapp" | "messenger" | "instagram" | "tiktok";
  const externalId =
    platform === "whatsapp" ? conversation.customer.whatsappNumber :
    platform === "messenger" ? conversation.customer.facebookId :
    platform === "instagram" ? conversation.customer.instagramId :
    conversation.customer.tiktokId;

  let externalMessageId: string | undefined;
  let sendError: string | undefined;

  if (externalId) {
    const adapter = getAdapter(platform);
    const accessTokenOverride = (await resolveAccessToken(session.organizationId, platform)) ?? undefined;
    const result = await adapter.sendMessage({ toExternalId: externalId, content: body.data.content, accessTokenOverride });
    externalMessageId = result.externalMessageId;
    if (!result.success) sendError = result.error;
  } else {
    sendError = "Missing external customer id for this platform";
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      platform: conversation.platform,
      direction: "OUTBOUND",
      type: "TEXT",
      content: body.data.content,
      externalMessageId,
      sentByUserId: session.userId
    }
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), lastMessagePreview: body.data.content.slice(0, 140) }
  });

  await prisma.auditLog.create({
    data: {
      organizationId: session.organizationId,
      actorId: session.userId,
      action: "message.sent",
      target: `Conversation:${conversation.id}`,
      meta: { platform: conversation.platform }
    }
  });

  return NextResponse.json({ message, delivered: !sendError, error: sendError });
}
