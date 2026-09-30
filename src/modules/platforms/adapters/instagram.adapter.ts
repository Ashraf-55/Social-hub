import crypto from "crypto";
import { SocialPlatformAdapter, OutboundMessageInput, SendMessageResult, ConnectionStatus } from "../adapter";
import { UnifiedMessage, UnifiedWebhookVerification } from "@/types/unified-message";
import { metaConfig, instagramConfig } from "@/lib/config";
import { describeFetchError } from "@/lib/network-error";

const GRAPH_URL = "https://graph.facebook.com/v20.0";

/**
 * NOTE (Section 10): Instagram Messaging is only available to Instagram
 * Professional accounts linked to a Facebook Page, and message types /
 * eligible senders are restricted by Meta's policies (e.g. the 24-hour
 * messaging window, human-agent tag rules). This adapter implements the
 * generic send/receive flow; before enabling a specific message type in
 * the UI, confirm current eligibility in Meta's Instagram Messaging API
 * docs for the connected account.
 */
export class InstagramAdapter implements SocialPlatformAdapter {
  readonly platform = "instagram" as const;

  isConfigured(): boolean {
    return instagramConfig.configured;
  }

  async connect(): Promise<ConnectionStatus> {
    if (!this.isConfigured()) return { connected: false, error: "Missing INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_BUSINESS_ACCOUNT_ID" };
    try {
      const res = await fetch(`${GRAPH_URL}/${instagramConfig.businessAccountId}?fields=username`, {
        headers: { Authorization: `Bearer ${instagramConfig.accessToken}` }
      });
      if (!res.ok) return { connected: false, error: `Instagram API error: ${res.status}` };
      const data = await res.json();
      return { connected: true, accountId: instagramConfig.businessAccountId, accountName: data.username };
    } catch (e) {
      return { connected: false, error: describeFetchError(e) };
    }
  }

  async disconnect(): Promise<void> {}

  async sendMessage(input: OutboundMessageInput): Promise<SendMessageResult> {
    const token = input.accessTokenOverride ?? instagramConfig.accessToken;
    if (!token) return { success: false, error: "Instagram not configured" };
    try {
      const res = await fetch(`${GRAPH_URL}/${instagramConfig.businessAccountId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ recipient: { id: input.toExternalId }, message: { text: input.content } })
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: JSON.stringify(data) };
      return { success: true, externalMessageId: data.message_id };
    } catch (e) {
      return { success: false, error: describeFetchError(e) };
    }
  }

  async verifyWebhook(request: Request): Promise<UnifiedWebhookVerification> {
    if (request.method === "GET") {
      const url = new URL(request.url);
      const valid =
        url.searchParams.get("hub.mode") === "subscribe" &&
        url.searchParams.get("hub.verify_token") === metaConfig.verifyToken &&
        Boolean(metaConfig.verifyToken);
      return { valid, challenge: valid ? url.searchParams.get("hub.challenge") ?? undefined : undefined };
    }

    const signature = request.headers.get("x-hub-signature-256");
    if (!signature || !metaConfig.appSecret) return { valid: false };
    const rawBody = await request.clone().text();
    const expected = "sha256=" + crypto.createHmac("sha256", metaConfig.appSecret).update(rawBody).digest("hex");
    return { valid: crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) };
  }

  parseWebhookPayload(payload: unknown): UnifiedMessage[] {
    const messages: UnifiedMessage[] = [];
    const body = payload as any;

    for (const entry of body?.entry ?? []) {
      for (const event of entry?.messaging ?? []) {
        if (!event?.message) continue;
        messages.push({
          platform: "instagram",
          externalMessageId: event.message.mid,
          customerExternalId: event.sender?.id,
          direction: "inbound",
          type: event.message.attachments?.[0]?.type === "image" ? "image" : event.message.text ? "text" : "unknown",
          content: event.message.text,
          mediaUrl: event.message.attachments?.[0]?.payload?.url,
          timestamp: new Date(event.timestamp ?? Date.now()),
          metadata: { raw: event }
        });
      }
    }
    return messages;
  }
}
