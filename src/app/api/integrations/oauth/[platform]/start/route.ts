import { NextRequest, NextResponse } from "next/server";
import { getSession, createSessionToken } from "@/lib/auth";
import { metaConfig } from "@/lib/config";

const SCOPES: Record<string, string[]> = {
  messenger: ["pages_messaging", "pages_show_list", "pages_manage_metadata"],
  instagram: ["instagram_basic", "instagram_manage_messages", "pages_show_list", "pages_manage_metadata"]
};

/**
 * Real Meta OAuth (Facebook Login for Business) — Section 17: "use OAuth
 * when the platform requires it". Covers Messenger and Instagram, which
 * both authenticate this way against a Facebook Page.
 *
 * WhatsApp is intentionally NOT redirected through this same dialog: Meta's
 * current recommended flow for WhatsApp Cloud API is "Embedded Signup", a
 * client-side JS SDK flow (FB.login with an extension), not a plain OAuth
 * redirect — faking it as one would misrepresent what actually happens.
 * See INTEGRATIONS.md for the honest, working alternative (System User
 * token via env vars) and what's needed to add real Embedded Signup.
 */
export async function GET(request: NextRequest, { params }: { params: { platform: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const platform = params.platform;

  if (platform === "whatsapp") {
    return NextResponse.json(
      {
        error:
          "WhatsApp does not use a plain OAuth redirect. Meta's current flow is 'Embedded Signup' (client-side JS SDK), not implemented here. Use a System User token via WHATSAPP_ACCESS_TOKEN in .env instead — see INTEGRATIONS.md."
      },
      { status: 400 }
    );
  }

  if (platform === "tiktok") {
    return NextResponse.json(
      { error: "TikTok Business Messaging requires a separate approved application — see INTEGRATIONS.md." },
      { status: 400 }
    );
  }

  const scopes = SCOPES[platform];
  if (!scopes) return NextResponse.json({ error: "Unknown platform" }, { status: 400 });

  if (!metaConfig.appId) {
    return NextResponse.json({ error: "META_APP_ID is not set — add your Meta App credentials to .env first." }, { status: 400 });
  }

  // CSRF-safe `state`: a short-lived signed token carrying who's connecting
  // what, verified in the callback (Section 32).
  const state = await createSessionToken({
    userId: session.userId,
    organizationId: session.organizationId,
    role: session.role,
    email: `oauth:${platform}` // reused field to smuggle the platform through state without a new JWT shape
  });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin}/api/integrations/oauth/${platform}/callback`;

  const authUrl = new URL("https://www.facebook.com/v20.0/dialog/oauth");
  authUrl.searchParams.set("client_id", metaConfig.appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("scope", scopes.join(","));
  authUrl.searchParams.set("response_type", "code");

  return NextResponse.redirect(authUrl.toString());
}
