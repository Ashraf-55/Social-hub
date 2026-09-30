import { prisma } from "@/lib/prisma";
import { getAdapter } from "@/modules/platforms/registry";
import { suggestReply } from "./ai.service";
import { aiEnabled } from "@/lib/config";
import { realtimeBus } from "@/lib/realtime";
import { resolveAccessToken } from "@/services/token.service";
import { createNotification } from "@/services/notification.service";
import { logger } from "@/lib/logger";
import { PlatformId } from "@/types/unified-message";

/**
 * Called once per inbound message, after it's persisted. Implements
 * Section 24 (AI Mode / Human Mode / Hybrid Mode) and Section 25 (AI
 * Safety: never invent an answer — hand off to a human instead).
 *
 * - HUMAN (default): no-op. A human agent replies via the normal Inbox.
 * - AI: if the AI module is enabled and confident, sends the reply
 *   automatically (tagged aiGenerated). If not confident, does NOT guess —
 *   escalates to a human via a notification instead (Section 25).
 * - HYBRID: never sends automatically. Generates a suggestion (only if
 *   confident) and stores it on the conversation for an employee to
 *   review, edit, and approve or discard from the Inbox.
 */
export async function handleAiModeForNewMessage(conversationId: string, organizationId: string) {
  if (!aiEnabled) return; // Section 6: AI is fully optional; nothing to do if disabled.

  const [conversation, org] = await Promise.all([
    prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: "asc" }, take: 20 }, customer: true }
    }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { aiSystemPromptExtra: true } })
  ]);
  if (!conversation || conversation.aiMode === "HUMAN") return;

  const history = conversation.messages.map((m: { direction: string; content: string | null }) => ({
    role: (m.direction === "INBOUND" ? "user" : "assistant") as "user" | "assistant",
    content: m.content ?? ""
  }));

  const { reply, confident } = await suggestReply(history, org?.aiSystemPromptExtra);

  if (!confident || !reply) {
    // Section 25 AI Safety: don't invent an answer — hand off to a human.
    logger.info("ai", "AI not confident — escalating to human", { conversationId });
    await createNotification(organizationId, "AI_ESCALATION", "AI غير متأكد من الرد — تم تحويل المحادثة لموظف بشري", { conversationId });
    return;
  }

  if (conversation.aiMode === "HYBRID") {
    await prisma.conversation.update({ where: { id: conversationId }, data: { pendingAiSuggestion: reply } });
    realtimeBus.publish(organizationId, { type: "ai.suggestion", payload: { conversationId, suggestion: reply } });
    return;
  }

  if (conversation.aiMode === "AI") {
    const platform = conversation.platform.toLowerCase() as PlatformId;
    const externalId =
      platform === "whatsapp" ? conversation.customer.whatsappNumber :
      platform === "messenger" ? conversation.customer.facebookId :
      platform === "instagram" ? conversation.customer.instagramId :
      conversation.customer.tiktokId;

    if (!externalId) return;

    const adapter = getAdapter(platform);
    const accessTokenOverride = (await resolveAccessToken(organizationId, platform)) ?? undefined;
    const result = await adapter.sendMessage({ toExternalId: externalId, content: reply, accessTokenOverride });

    await prisma.message.create({
      data: {
        conversationId,
        platform: conversation.platform,
        direction: "OUTBOUND",
        type: "TEXT",
        content: reply,
        aiGenerated: true,
        externalMessageId: result.externalMessageId
      }
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), lastMessagePreview: reply.slice(0, 140) }
    });

    realtimeBus.publish(organizationId, { type: "message.received", payload: { conversationId, platform, preview: reply.slice(0, 140) } });
  }
}
