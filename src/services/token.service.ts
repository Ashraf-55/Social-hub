import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { PlatformId } from "@/types/unified-message";

const platformEnumMap: Record<PlatformId, "WHATSAPP" | "MESSENGER" | "INSTAGRAM" | "TIKTOK"> = {
  whatsapp: "WHATSAPP",
  messenger: "MESSENGER",
  instagram: "INSTAGRAM",
  tiktok: "TIKTOK"
};

/**
 * Returns the access token to use for a given organization+platform,
 * preferring a token obtained via the OAuth flow (stored encrypted on
 * SocialIntegration) over the static value in `.env`. This lets
 * `/api/integrations/oauth/*` (real Meta OAuth) and the env-based System
 * User token (documented in INTEGRATIONS.md) coexist: whichever was
 * connected most recently wins.
 */
export async function resolveAccessToken(organizationId: string, platform: PlatformId): Promise<string | null> {
  const integration = await prisma.socialIntegration.findUnique({
    where: { organizationId_platform: { organizationId, platform: platformEnumMap[platform] } }
  });

  if (integration?.encryptedAccessToken) {
    try {
      return decryptSecret(integration.encryptedAccessToken);
    } catch {
      return null;
    }
  }

  return null; // caller falls back to the adapter's own env-based default
}
