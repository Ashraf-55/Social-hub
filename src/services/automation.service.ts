import { prisma } from "@/lib/prisma";
import { UnifiedMessage } from "@/types/unified-message";
import { getAdapter } from "@/modules/platforms/registry";
import { resolveAccessToken } from "./token.service";
import { createNotification } from "./notification.service";
import { logger } from "@/lib/logger";

interface AutomationConditions {
  contains?: string; // case-insensitive substring match on message content
  isNewCustomer?: boolean;
}

interface AutomationAction {
  type: "send_reply" | "add_tag" | "assign_employee" | "notify_employee";
  text?: string;
  tagName?: string;
  employeeId?: string;
}

/**
 * Json columns are sometimes stored as a JSON *string* (e.g. rows inserted by
 * hand: "{\"contains\": \"x\"}"). Parse up to twice so both the proper form and
 * the stringified form work; otherwise fall back to the default.
 */
function asJson<T>(value: unknown, fallback: T): T {
  let v: unknown = value;
  for (let i = 0; i < 2 && typeof v === "string"; i++) {
    try {
      v = JSON.parse(v as string);
    } catch {
      return fallback;
    }
  }
  return (v ?? fallback) as T;
}

/**
 * Evaluates all enabled automations for an organization against one
 * incoming message. This is intentionally simple rule-matching for
 * immediate in-app actions (Section 21); anything more elaborate is meant
 * to be built as an n8n workflow instead (Section 5/22).
 */
export async function runAutomationsForMessage(organizationId: string, conversationId: string, message: UnifiedMessage) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { automationsEnabled: true } });
  if (org && !org.automationsEnabled) return; // Section 48: org-wide pause, independent of individual rule toggles

  const automations = await prisma.automation.findMany({ where: { organizationId, enabled: true, triggerType: "new_message" } });

  for (const automation of automations) {
    const conditions = asJson<AutomationConditions>(automation.conditions, {});
    let matched = true;

    if (conditions.contains) {
      matched = matched && Boolean(message.content?.toLowerCase().includes(conditions.contains.toLowerCase()));
    }

    if (conditions.isNewCustomer) {
      const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
      const count = await prisma.conversation.count({ where: { customerId: conversation?.customerId } });
      matched = matched && count <= 1;
    }

    if (!matched) continue;

    const parsedActions = asJson<AutomationAction[]>(automation.actions, []);
    const actions = Array.isArray(parsedActions) ? parsedActions : [];
    if (actions.length === 0) {
      logger.warn("automation", "automation has no valid actions, skipping", { automationId: automation.id, automationName: automation.name });
    }
    let success = true;
    let error: string | undefined;

    try {
      for (const action of actions) {
        await runAction(organizationId, conversationId, message, action);
      }
    } catch (e) {
      success = false;
      error = (e as Error).message;
      logger.error("automation", "automation action failed", { automationId: automation.id, automationName: automation.name, conversationId, error });
    }

    await prisma.automationExecution.create({
      data: { automationId: automation.id, conversationId, success, error }
    });

    if (!success) {
      await createNotification(organizationId, "AUTOMATION_FAILED", `Automation "${automation.name}" failed: ${error}`, { conversationId, automationId: automation.id });
    }
  }
}

async function runAction(organizationId: string, conversationId: string, message: UnifiedMessage, action: AutomationAction) {
  switch (action.type) {
    case "send_reply": {
      if (!action.text) return;
      const adapter = getAdapter(message.platform);
      const accessTokenOverride = (await resolveAccessToken(organizationId, message.platform)) ?? undefined;
      const result = await adapter.sendMessage({ toExternalId: message.customerExternalId, content: action.text, accessTokenOverride });
      if (!result.success) throw new Error(result.error ?? `${message.platform} send failed`);
      await prisma.message.create({
        data: {
          conversationId,
          platform: message.platform.toUpperCase() as any,
          direction: "OUTBOUND",
          type: "TEXT",
          content: action.text,
          aiGenerated: false,
          externalMessageId: result.externalMessageId
        }
      });
      break;
    }
    case "add_tag": {
      if (!action.tagName) return;
      const tag = await prisma.tag.upsert({
        where: { organizationId_name: { organizationId, name: action.tagName } },
        update: {},
        create: { organizationId, name: action.tagName }
      });
      await prisma.conversationTag.upsert({
        where: { conversationId_tagId: { conversationId, tagId: tag.id } },
        update: {},
        create: { conversationId, tagId: tag.id }
      });
      break;
    }
    case "assign_employee": {
      if (!action.employeeId) return;
      await prisma.conversation.update({ where: { id: conversationId }, data: { assignedEmployeeId: action.employeeId } });
      await createNotification(organizationId, "CONVERSATION_ASSIGNED", "A conversation was auto-assigned to you", { conversationId });
      break;
    }
    case "notify_employee": {
      await createNotification(organizationId, "NEW_MESSAGE", "New message needs attention", { conversationId });
      break;
    }
  }
}
