import crypto from "crypto";
import { SocialPlatformAdapter, OutboundMessageInput, SendMessageResult, ConnectionStatus } from "../adapter";
import { UnifiedMessage, UnifiedWebhookVerification } from "@/types/unified-message";
import { metaConfig, whatsappConfig } from "@/lib/config";
import { describeFetchError } from "@/lib/network-error";

const GRAPH_URL = "https://graph.facebook.com/v20.0";

export class WhatsAppAdapter implements SocialPlatformAdapter {
  readonly platform = "whatsapp" as const;

  isConfigured(): boolean {
    return whatsappConfig.configured;
  }

  async connect(): Promise<ConnectionStatus> {
    if (!this.isConfigured()) {
      return { connected: false, error: "Missing WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID" };
    }
    try {
      const res = await fetch(`${GRAPH_URL}/${whatsappConfig.phoneNumberId}`, {
        headers: { Authorization: `Bearer ${whatsappConfig.accessToken}` }
      });
      if (!res.ok) {
        const body = await res.text();
        return { connected: false, error: `WhatsApp API error: ${res.status} ${body}` };
      }
      const data = await res.json();
      return { connected: true, accountId: whatsappConfig.phoneNumberId, accountName: data.verified_name ?? data.display_phone_number };
    } catch (e) {
      return { connected: false, error: describeFetchError(e) };
    }
  }

  async disconnect(): Promise<void> {
    // Token revocation is managed through Meta Business Settings; locally we
    // just drop stored credentials (handled by the integrations service).
  }

  async sendMessage(input: OutboundMessageInput): Promise<SendMessageResult> {
    if (!this.isConfigured()) return { success: false, error: "WhatsApp not configured" };
    try {
      const res = await fetch(`${GRAPH_URL}/${whatsappConfig.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${whatsappConfig.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: input.toExternalId,
          type: "text",
          text: { body: input.content }
        })
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: JSON.stringify(data) };
      return { success: true, externalMessageId: data.messages?.[0]?.id };
    } catch (e) {
      return { success: false, error: describeFetchError(e) };
    }
  }

  /**
   * GET requests are Meta's webhook handshake (hub.mode/hub.verify_token/hub.challenge).
   * POST requests carry the actual message payload and must be verified via
   * the X-Hub-Signature-256 header (HMAC-SHA256 of the raw body using the
   * Meta App Secret).
   */
  async verifyWebhook(request: Request): Promise<UnifiedWebhookVerification> {
    if (request.method === "GET") {
      const url = new URL(request.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge") ?? undefined;
      const valid = mode === "subscribe" && token === metaConfig.verifyToken && Boolean(metaConfig.verifyToken);
      return { valid, challenge: valid ? challenge : undefined };
    }

    const signature = request.headers.get("x-hub-signature-256");
    if (!signature || !metaConfig.appSecret) return { valid: false };

    const rawBody = await request.clone().text();
    const expected =
      "sha256=" + crypto.createHmac("sha256", metaConfig.appSecret).update(rawBody).digest("hex");

    const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    return { valid };
  }

  parseWebhookPayload(payload: unknown): UnifiedMessage[] {
    const messages: UnifiedMessage[] = [];
    const body = payload as any;

    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value;
        for (const msg of value?.messages ?? []) {
          messages.push({
            platform: "whatsapp",
            externalMessageId: msg.id,
            customerExternalId: msg.from,
            direction: "inbound",
            type: msg.type === "text" ? "text" : msg.type === "image" ? "image" : msg.type === "video" ? "video" : msg.type === "audio" ? "audio" : msg.type === "document" ? "file" : "unknown",
            content: msg.text?.body,
            mediaUrl: msg.image?.id ?? msg.video?.id ?? msg.audio?.id ?? msg.document?.id,
            timestamp: new Date(Number(msg.timestamp) * 1000),
            metadata: { raw: msg }
          });
        }
      }
    }
    return messages;
  }
}
