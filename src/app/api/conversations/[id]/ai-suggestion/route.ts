import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getAdapter } from "@/modules/platforms/registry";
import { resolveAccessToken } from "@/services/token.service";
import { hasPermission, requirePermission } from "@/lib/permissions";

const schema = z.object({
  action: z.enum(["approve", "discard"]),
  editedContent: z.string().min(1).max(4000).optional() // let the employee tweak the AI's draft before sending
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const conversation = await prisma.conversation.findFirst({
    where: { id: params.id, organizationId: session.organizationId },
    include: { customer: true }
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!conversation.pendingAiSuggestion) return NextResponse.json({ error: "No pending suggestion" }, { status: 400 });

  if (body.data.action === "discard") {
    await prisma.conversation.update({ where: { id: conversation.id }, data: { pendingAiSuggestion: null } });
    return NextResponse.json({ ok: true, discarded: true });
  }

  requirePermission(await hasPermission(session.userId, session.role, "REPLY_MESSAGES"));

  const content = body.data.editedContent ?? conversation.pendingAiSuggestion;
  const platform = conversation.platform.toLowerCase() as "whatsapp" | "messenger" | "instagram" | "tiktok";
  const externalId =
    platform === "whatsapp" ? conversation.customer.whatsappNumber :
    platform === "messenger" ? conversation.customer.facebookId :
    platform === "instagram" ? conversation.customer.instagramId :
    conversation.customer.tiktokId;

  let externalMessageId: string | undefined;
  let sendError: string | undefined;

  if (externalId) {
    const accessTokenOverride = (await resolveAccessToken(session.organizationId, platform)) ?? undefined;
    const result = await getAdapter(platform).sendMessage({ toExternalId: externalId, content, accessTokenOverride });
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
      content,
      externalMessageId,
      sentByUserId: session.userId,
      aiGenerated: true
    }
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { pendingAiSuggestion: null, lastMessageAt: new Date(), lastMessagePreview: content.slice(0, 140) }
  });

  return NextResponse.json({ message, delivered: !sendError, error: sendError });
}
