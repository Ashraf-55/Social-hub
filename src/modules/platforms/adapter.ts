import { PlatformId, UnifiedMessage, UnifiedWebhookVerification } from "@/types/unified-message";

export interface OutboundMessageInput {
  toExternalId: string; // recipient's platform-specific id (phone, PSID, IGSID...)
  content: string;
  mediaUrl?: string;
  /** Overrides the adapter's env-configured token, e.g. an OAuth-obtained one. */
  accessTokenOverride?: string;
}

export interface SendMessageResult {
  success: boolean;
  externalMessageId?: string;
  error?: string;
}

export interface ConnectionStatus {
  connected: boolean;
  accountId?: string;
  accountName?: string;
  error?: string;
}

/**
 * Every platform integration (WhatsApp, Messenger, Instagram, TikTok, and
 * any future one — Telegram, Email, LinkedIn, Live Chat...) implements this
 * exact interface. The rest of the system (webhooks router, inbox,
 * automation engine) only ever depends on this interface, never on a
 * specific platform's SDK/payload shape (Section 20/46).
 */
export interface SocialPlatformAdapter {
  readonly platform: PlatformId;

  /** Whether this adapter has the credentials it needs to make real calls. */
  isConfigured(): boolean;

  connect(params?: Record<string, unknown>): Promise<ConnectionStatus>;
  disconnect(): Promise<void>;

  sendMessage(input: OutboundMessageInput): Promise<SendMessageResult>;

  /**
   * Verifies the platform's webhook handshake (e.g. Meta's hub.challenge
   * GET request) or a signature header on an incoming POST.
   */
  verifyWebhook(request: Request): Promise<UnifiedWebhookVerification>;

  /** Translates a raw platform payload into zero or more UnifiedMessages. */
  parseWebhookPayload(payload: unknown): UnifiedMessage[];
}
