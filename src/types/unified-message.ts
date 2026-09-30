export type PlatformId = "whatsapp" | "messenger" | "instagram" | "tiktok";

export type MessageDirection = "inbound" | "outbound";

export type MessageKind = "text" | "image" | "video" | "audio" | "file" | "unknown";

/**
 * The single shape every part of the app (DB layer, inbox UI, automation
 * engine, AI module) works with. Nothing outside src/modules/platforms/
 * should ever touch a raw WhatsApp/Meta/TikTok payload directly — adapters
 * translate into this shape at the webhook boundary (Section 19).
 */
export interface UnifiedMessage {
  id?: string;
  platform: PlatformId;
  externalMessageId: string;
  conversationExternalId?: string;
  customerExternalId: string;
  customerDisplayName?: string;
  direction: MessageDirection;
  type: MessageKind;
  content?: string;
  mediaUrl?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface UnifiedWebhookVerification {
  challenge?: string;
  valid: boolean;
}
