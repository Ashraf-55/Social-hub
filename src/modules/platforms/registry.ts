import { PlatformId } from "@/types/unified-message";
import { SocialPlatformAdapter } from "./adapter";
import { WhatsAppAdapter } from "./adapters/whatsapp.adapter";
import { MessengerAdapter } from "./adapters/messenger.adapter";
import { InstagramAdapter } from "./adapters/instagram.adapter";
import { TikTokAdapter } from "./adapters/tiktok.adapter";

const registry: Record<PlatformId, SocialPlatformAdapter> = {
  whatsapp: new WhatsAppAdapter(),
  messenger: new MessengerAdapter(),
  instagram: new InstagramAdapter(),
  tiktok: new TikTokAdapter()
};

export function getAdapter(platform: PlatformId): SocialPlatformAdapter {
  return registry[platform];
}

export function allAdapters(): SocialPlatformAdapter[] {
  return Object.values(registry);
}
