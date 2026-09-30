import crypto from "crypto";
import { SocialPlatformAdapter, OutboundMessageInput, SendMessageResult, ConnectionStatus } from "../adapter";
import { UnifiedMessage, UnifiedWebhookVerification } from "@/types/unified-message";
import { tiktokConfig } from "@/lib/config";

/**
 * IMPORTANT (Section 11 / 49) — verified against TikTok's own docs
 * (business-api.tiktok.com/portal, Sept 2026):
 *
 *   - TikTok Business Messaging API is a real, official API (part of
 *     "TikTok API for Business"), covering conversations, sending/
 *     retrieving messages, media upload/download, webhook configuration,
 *     Business Account capability checks and automatic-message management.
 *   - It requires: (1) a TikTok Developer Account, (2) an app registered in
 *     the TikTok Developer Portal, (3) a *separate approval* — "apply for
 *     Business Messaging API access" — which is not automatically granted
 *     with normal app creation, (4) the connected account must be a TikTok
 *     **Business Account** (not personal) with "accept direct messages from
 *     everyone" enabled.
 *   - It is **region-restricted**: as of the last check it is unavailable
 *     for accounts registered in the EEA, Switzerland, or the UK. This can
 *     change — re-verify for the specific account/region before enabling.
 *   - Conversations must always be user-initiated; a business cannot
 *     message a TikTok user first (unlike WhatsApp template messages).
 *
 * Because the exact endpoint URLs and JSON payload shapes are only fully
 * exposed once an app has been granted Business Messaging API access
 * (behind the authenticated developer portal), this adapter:
 *   - implements the adapter interface fully so the rest of the system
 *     (webhooks router, inbox, dedup) works uniformly,
 *   - performs webhook signature verification generically (HMAC over the
 *     raw body with a shared webhook secret, TikTok's documented pattern),
 *   - does NOT hardcode a guessed send/receive payload shape.
 *
 * Before going live: get Business Messaging API access approved for the
 * connected TikTok Business Account, copy the exact endpoint URLs/payload
 * fields from the now-accessible portal docs, and fill in `sendMessage` /
 * `parseWebhookPayload` accordingly. Until then, `isConfigured()` reports
 * false and the Integrations page shows TikTok as "Not available through
 * the official API for this account/region" instead of faking a connection.
 */
export class TikTokAdapter implements SocialPlatformAdapter {
  readonly platform = "tiktok" as const;

  isConfigured(): boolean {
    // Deliberately always false until endpoints are confirmed against the
    // official docs for the specific connected account (see note above).
    return false && tiktokConfig.configured;
  }

  async connect(): Promise<ConnectionStatus> {
    return {
      connected: false,
      error:
        "TikTok messaging endpoints must be confirmed against the official TikTok for Business docs for this account/region before connecting."
    };
  }

  async disconnect(): Promise<void> {}

  async sendMessage(_input: OutboundMessageInput): Promise<SendMessageResult> {
    return { success: false, error: "Not available through the official API yet for this account/region." };
  }

  async verifyWebhook(request: Request): Promise<UnifiedWebhookVerification> {
    const signature = request.headers.get("x-tiktok-signature");
    if (!signature || !tiktokConfig.webhookSecret) return { valid: false };
    const rawBody = await request.clone().text();
    const expected = crypto.createHmac("sha256", tiktokConfig.webhookSecret).update(rawBody).digest("hex");
    try {
      return { valid: crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) };
    } catch {
      return { valid: false };
    }
  }

  parseWebhookPayload(_payload: unknown): UnifiedMessage[] {
    // Left intentionally unimplemented — see class-level note. Wire this up
    // once the confirmed payload shape from TikTok's docs is available.
    return [];
  }
}
