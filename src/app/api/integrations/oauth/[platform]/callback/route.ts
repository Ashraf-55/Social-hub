import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { metaConfig } from "@/lib/config";
import { logger } from "@/lib/logger";

const GRAPH_URL = "https://graph.facebook.com/v20.0";

/**
 * Completes the Meta OAuth dance started in ../start/route.ts:
 *   1. exchange the `code` for a short-lived user access token
 *   2. exchange that for a long-lived user access token
 *   3. call /me/accounts to list Pages the user administers, with a Page
 *      Access Token for each (these Page tokens don't expire as long as
 *      the user token behind them stays valid)
 *   4. for Instagram, resolve the Page's linked instagram_business_account
 *   5. persist the token encrypted (Section 32) on SocialIntegration and
 *      mark it CONNECTED
 *
 * Note: this takes the *first* Page returned by /me/accounts. A business
 * managing multiple Pages should extend this with a picker step between (3)
 * and (5) — the data needed for that (the full list with names) is already
 * being fetched here, just not surfaced in the UI yet.
 */
export async function GET(request: NextRequest, { params }: { params: { platform: string } }) {
  const platform = params.platform;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const redirectBase = "/dashboard/integrations";

  if (oauthError) {
    return NextResponse.redirect(new URL(`${redirectBase}?oauth_error=${encodeURIComponent(oauthError)}`, request.url));
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL(`${redirectBase}?oauth_error=missing_code_or_state`, request.url));
  }

  const session = await verifySessionToken(state);
  if (!session || session.email !== `oauth:${platform}`) {
    return NextResponse.redirect(new URL(`${redirectBase}?oauth_error=invalid_state`, request.url));
  }

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin}/api/integrations/oauth/${platform}/callback`;

    // Step 1: code -> short-lived user token
    const tokenRes = await fetch(
      `${GRAPH_URL}/oauth/access_token?client_id=${metaConfig.appId}&client_secret=${metaConfig.appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
    );
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData?.error?.message ?? "Token exchange failed");

    // Step 2: short-lived -> long-lived user token
    const longLivedRes = await fetch(
      `${GRAPH_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${metaConfig.appId}&client_secret=${metaConfig.appSecret}&fb_exchange_token=${tokenData.access_token}`
    );
    const longLivedData = await longLivedRes.json();
    const userToken = longLivedRes.ok ? longLivedData.access_token : tokenData.access_token;

    // Step 3: list Pages + their (non-expiring) Page Access Tokens
    const pagesRes = await fetch(`${GRAPH_URL}/me/accounts?access_token=${userToken}`);
    const pagesData = await pagesRes.json();
    if (!pagesRes.ok || !pagesData.data?.length) {
      throw new Error("No Facebook Pages found for this account. Connect at least one Page with admin access.");
    }
    const page = pagesData.data[0]; // see note above re: multi-page picker

    let externalAccountId = page.id;
    let externalAccountName = page.name;
    let tokenToStore = page.access_token;

    if (platform === "instagram") {
      const igRes = await fetch(`${GRAPH_URL}/${page.id}?fields=instagram_business_account{id,username}&access_token=${page.access_token}`);
      const igData = await igRes.json();
      if (!igData.instagram_business_account?.id) {
        throw new Error("This Page has no linked Instagram Professional account.");
      }
      externalAccountId = igData.instagram_business_account.id;
      externalAccountName = igData.instagram_business_account.username ?? page.name;
      // Instagram messaging uses the same Page-linked token.
      tokenToStore = page.access_token;
    }

    const platformEnum = platform.toUpperCase() as "MESSENGER" | "INSTAGRAM";

    await prisma.socialIntegration.upsert({
      where: { organizationId_platform: { organizationId: session.organizationId, platform: platformEnum } },
      update: {
        status: "CONNECTED",
        externalAccountId,
        externalAccountName,
        encryptedAccessToken: encryptSecret(tokenToStore),
        lastError: null,
        lastSyncAt: new Date()
      },
      create: {
        organizationId: session.organizationId,
        platform: platformEnum,
        status: "CONNECTED",
        externalAccountId,
        externalAccountName,
        encryptedAccessToken: encryptSecret(tokenToStore)
      }
    });

    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorId: session.userId,
        action: "integration.oauth_connected",
        target: `Platform:${platform}`,
        meta: { accountName: externalAccountName }
      }
    });

    logger.info("integration", "OAuth connection succeeded", { organizationId: session.organizationId, platform, accountName: externalAccountName });

    return NextResponse.redirect(new URL(`${redirectBase}?oauth_success=${platform}`, request.url));
  } catch (err) {
    const message = (err as Error).message;
    logger.error("integration", "OAuth connection failed", { organizationId: session.organizationId, platform, error: message });

    await prisma.socialIntegration
      .updateMany({
        where: { organizationId: session.organizationId, platform: platform.toUpperCase() as "MESSENGER" | "INSTAGRAM" },
        data: { status: "ERROR", lastError: message }
      })
      .catch(() => {});

    return NextResponse.redirect(new URL(`${redirectBase}?oauth_error=${encodeURIComponent(message)}`, request.url));
  }
}
