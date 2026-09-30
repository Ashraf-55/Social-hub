/**
 * Central place that reads environment/config so nothing else in the app
 * has to guess whether we're running with real platform credentials or not.
 *
 * APP_MODE=mock  -> Section 44 "Development Mode": no real API calls are
 *                    ever made, adapters return simulated data, and
 *                    /dashboard/integrations shows everything as mock.
 * APP_MODE=live  -> Real Official APIs are called. Missing credentials for
 *                    a given platform simply keep that platform's
 *                    integration status = NOT_CONNECTED; the rest of the
 *                    app (auth, inbox, customers, automations) keeps
 *                    working regardless (Section 6 / 53).
 */
export const APP_MODE: "mock" | "live" = process.env.APP_MODE === "live" ? "live" : "mock";
export const isMockMode = APP_MODE === "mock";

export const aiEnabled = Boolean(process.env.OPENAI_API_KEY) && process.env.AI_ENABLED === "true";

export const n8nConfig = {
  baseUrl: process.env.N8N_BASE_URL ?? "",
  webhookSecret: process.env.N8N_WEBHOOK_SECRET ?? "",
  enabled: Boolean(process.env.N8N_BASE_URL)
};

export const metaConfig = {
  appId: process.env.META_APP_ID ?? "",
  appSecret: process.env.META_APP_SECRET ?? "",
  verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN ?? ""
};

export const whatsappConfig = {
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
  configured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
};

export const facebookConfig = {
  pageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? "",
  pageId: process.env.FACEBOOK_PAGE_ID ?? "",
  configured: Boolean(process.env.FACEBOOK_PAGE_ACCESS_TOKEN && process.env.FACEBOOK_PAGE_ID)
};

export const instagramConfig = {
  accessToken: process.env.INSTAGRAM_ACCESS_TOKEN ?? "",
  businessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID ?? "",
  configured: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID)
};

export const tiktokConfig = {
  clientKey: process.env.TIKTOK_CLIENT_KEY ?? "",
  clientSecret: process.env.TIKTOK_CLIENT_SECRET ?? "",
  webhookSecret: process.env.TIKTOK_WEBHOOK_SECRET ?? "",
  configured: Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET)
};
