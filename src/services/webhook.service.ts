import { prisma } from "@/lib/prisma";
import { PlatformId, UnifiedMessage } from "@/types/unified-message";
import { dispatchToN8n } from "./n8n.service";
import { runAutomationsForMessage } from "./automation.service";
import { createNotification } from "./notification.service";
import { realtimeBus } from "@/lib/realtime";
import { logger } from "@/lib/logger";
import { handleAiModeForNewMessage } from "@/modules/ai/handoff.service";

const platformEnumMap: Record<PlatformId, "WHATSAPP" | "MESSENGER" | "INSTAGRAM" | "TIKTOK"> = {
  whatsapp: "WHATSAPP",
  messenger: "MESSENGER",
  instagram: "INSTAGRAM",
  tiktok: "TIKTOK"
};

/**
 * Single entry point every webhook route calls after verifying the
 * signature. Handles: dedup (Section 31), persistence, customer/
 * conversation upsert, automation trigger, and n8n event dispatch.
 * Organization resolution: in this single-tenant-first build we resolve to
 * the one organization that owns the connected integration for the
 * platform; multi-account routing can be added by keying off the
 * platform-specific recipient id in `raw` metadata.
 */
export async function ingestWebhookEvent(params: {
  platform: PlatformId;
  externalEventId: string;
  rawPayload: unknown;
  messages: UnifiedMessage[];
}): Promise<{ processed: number; duplicates: number }> {
  const platformEnum = platformEnumMap[params.platform];
  logger.info("webhook", "event received", { platform: params.platform, externalEventId: params.externalEventId, messageCount: params.messages.length });

  // 1. Duplicate protection via unique(platform, externalEventId)
  const existing = await prisma.webhookEvent.findUnique({
    where: { platform_externalEventId: { platform: platformEnum, externalEventId: params.externalEventId } }
  });
  if (existing?.processed) {
    logger.info("webhook", "duplicate event ignored", { platform: params.platform, externalEventId: params.externalEventId });
    return { processed: 0, duplicates: 1 };
  }

  const integration = await prisma.socialIntegration.findFirst({
    where: { platform: platformEnum, status: "CONNECTED" }
  });

  const webhookEvent = await prisma.webhookEvent.upsert({
    where: { platform_externalEventId: { platform: platformEnum, externalEventId: params.externalEventId } },
    update: { payload: params.rawPayload as any },
    create: {
      platform: platformEnum,
      externalEventId: params.externalEventId,
      payload: params.rawPayload as any,
      organizationId: integration?.organizationId
    }
  });

  if (!integration) {
    // We still recorded the raw event for audit/debug, but there's no
    // organization to attach messages to yet.
    logger.warn("webhook", "no connected integration for platform", { platform: params.platform, externalEventId: params.externalEventId });
    await prisma.webhookEvent.update({ where: { id: webhookEvent.id }, data: { error: "No connected integration for platform" } });
    return { processed: 0, duplicates: 0 };
  }

  let processedCount = 0;

  const org = await prisma.organization.findUnique({ where: { id: integration.organizationId }, select: { defaultAiMode: true } });

  for (const um of params.messages) {
    // Platforms don't share one identity column, so there's no single
    // composite unique constraint to upsert on — find-or-create explicitly.
    const existingCustomerId = await findCustomerId(integration.organizationId, params.platform, um.customerExternalId);

    const customer = existingCustomerId
      ? await prisma.customer.update({
          where: { id: existingCustomerId },
          data: { lastInteraction: um.timestamp, name: um.customerDisplayName ?? undefined }
        })
      : await prisma.customer.create({
          data: {
            organizationId: integration.organizationId,
            name: um.customerDisplayName,
            lastInteraction: um.timestamp,
            ...platformIdField(params.platform, um.customerExternalId)
          }
        });

    let conversation = await prisma.conversation.findFirst({
      where: { organizationId: integration.organizationId, platform: platformEnum, customerId: customer.id, status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" }
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          organizationId: integration.organizationId,
          platform: platformEnum,
          customerId: customer.id,
          status: "OPEN",
          aiMode: org?.defaultAiMode ?? "HUMAN"
        }
      });
      await createNotification(integration.organizationId, "NEW_CUSTOMER", `New customer via ${params.platform}`);
    }

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        platform: platformEnum,
        externalMessageId: um.externalMessageId,
        direction: "INBOUND",
        type: um.type.toUpperCase() as any,
        content: um.content,
        metadata: um.metadata as any
      }
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: um.timestamp,
        lastMessagePreview: um.content?.slice(0, 140),
        unreadCount: { increment: 1 }
      }
    });

    await createNotification(integration.organizationId, "NEW_MESSAGE", `New ${params.platform} message`);

    realtimeBus.publish(integration.organizationId, {
      type: "message.received",
      payload: { conversationId: conversation.id, platform: params.platform, preview: um.content?.slice(0, 140) }
    });

    // Automations run synchronously for simple rule matching; anything
    // heavier is delegated to n8n.
    await runAutomationsForMessage(integration.organizationId, conversation.id, um);

    // Section 24: act according to the conversation's AI Mode (no-op for
    // HUMAN, the default). Never let an AI failure break webhook ingestion.
    await handleAiModeForNewMessage(conversation.id, integration.organizationId).catch((err) => {
      logger.error("ai", "AI handoff failed", { conversationId: conversation.id, error: (err as Error).message });
    });

    await dispatchToN8n("message.received", {
      organizationId: integration.organizationId,
      conversationId: conversation.id,
      customerId: customer.id,
      message: um
    });

    processedCount++;
  }

  await prisma.webhookEvent.update({ where: { id: webhookEvent.id }, data: { processed: true, processedAt: new Date() } });
  await prisma.socialIntegration.update({ where: { id: integration.id }, data: { lastWebhookAt: new Date() } });

  return { processed: processedCount, duplicates: 0 };
}

async function findCustomerId(organizationId: string, platform: PlatformId, externalId: string) {
  const field = platformIdField(platform, externalId);
  const customer = await prisma.customer.findFirst({ where: { organizationId, ...field } });
  return customer?.id;
}

function platformIdField(platform: PlatformId, externalId: string) {
  switch (platform) {
    case "whatsapp":
      return { whatsappNumber: externalId };
    case "messenger":
      return { facebookId: externalId };
    case "instagram":
      return { instagramId: externalId };
    case "tiktok":
      return { tiktokId: externalId };
  }
}
