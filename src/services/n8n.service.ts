import { n8nConfig } from "@/lib/config";
import { logger } from "@/lib/logger";

/**
 * Fires an event to n8n's webhook entry point. n8n is an *optional*
 * automation layer (Section 5/22) — if it's not configured, this is a
 * no-op and the core app keeps working normally.
 */
export async function dispatchToN8n(eventType: string, data: Record<string, unknown>): Promise<void> {
  if (!n8nConfig.enabled) return;

  try {
    await fetch(`${n8nConfig.baseUrl.replace(/\/$/, "")}/webhook/social-hub`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": n8nConfig.webhookSecret
      },
      body: JSON.stringify({ eventType, data, sentAt: new Date().toISOString() })
    });
  } catch (err) {
    // n8n being unreachable must never break the main request flow.
    logger.error("automation", "n8n dispatch failed", { eventType, error: (err as Error).message });
  }
}
