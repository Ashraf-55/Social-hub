# Integrations Setup

All integrations use **official APIs and webhooks only**. This document is
what you follow when moving from Mock Mode to Live Mode.

## Meta apps (WhatsApp, Messenger, Instagram all share one Meta App)

1. Create an app at https://developers.facebook.com/apps → type "Business".
2. Add products: **WhatsApp**, **Messenger**, **Instagram Graph API** as needed.
3. Under App Settings → Basic, copy **App ID** and **App Secret** into
   `META_APP_ID` / `META_APP_SECRET`.
4. Under App Settings → Basic, add `https://<your-domain>/api/integrations/oauth/messenger/callback`
   and `.../instagram/callback` to **Valid OAuth Redirect URIs**.
5. Under each product's Webhooks settings, set the callback URL to:
   - `https://<your-domain>/api/webhooks/whatsapp`
   - `https://<your-domain>/api/webhooks/messenger`
   - `https://<your-domain>/api/webhooks/instagram`
   and a **Verify Token** of your choice — put the same value in
   `META_WEBHOOK_VERIFY_TOKEN`.
6. Subscribe to the `messages` webhook field for each product.

### Messenger & Instagram: real OAuth (implemented)

With `APP_MODE=live`, the **Connect with Meta (OAuth)** button on
`/dashboard/integrations` sends the Admin through Meta's actual Facebook
Login for Business dialog (`src/app/api/integrations/oauth/[platform]/start`),
exchanges the returned code for a long-lived Page Access Token
(`.../callback`), and stores it **encrypted** on `SocialIntegration`
(`src/lib/crypto.ts`) — nothing is written to `.env` or exposed to the
frontend. This takes the first Page the admin manages; if your business runs
multiple Pages, extend the callback route with a picker (the full list is
already fetched, just not surfaced in the UI yet).

You still need `META_APP_ID` / `META_APP_SECRET` / `META_WEBHOOK_VERIFY_TOKEN`
in `.env` for this to work — OAuth authenticates the *Page*, not the app
itself.

### WhatsApp specifically
- WhatsApp Cloud API's current recommended onboarding is **Embedded
  Signup** — a client-side Facebook JS SDK flow (`FB.login` with an
  extension), not a plain OAuth redirect. Implementing that requires
  loading Facebook's JS SDK in the browser and a dedicated popup flow; it
  is **not implemented** here (Section 49: don't fake OAuth where the
  platform's real flow is different).
- What **is** implemented and works today: a **System User token**. Get a
  phone number under WhatsApp → API Setup, copy the **Phone Number ID**
  into `WHATSAPP_PHONE_NUMBER_ID`, and generate a non-expiring token via a
  System User (Business Settings → System Users) into
  `WHATSAPP_ACCESS_TOKEN`. Once both are set, `/dashboard/integrations`
  shows WhatsApp as connectable immediately.

### Messenger specifically
- Preferred: use the **Connect with Meta (OAuth)** button (see above) —
  handles Page selection and token storage automatically.
- Fallback (e.g. for automation/CI without a browser): generate a **Page
  Access Token** manually and put it in `FACEBOOK_PAGE_ACCESS_TOKEN` /
  `FACEBOOK_PAGE_ID`. The adapter uses the OAuth-stored token when present
  and falls back to these env values otherwise.

### Instagram specifically
- Preferred: same **Connect with Meta (OAuth)** button — it resolves the
  linked Instagram Professional account automatically.
- Requires an Instagram **Professional** account linked to a Facebook Page;
  the OAuth callback will report a clear error if the selected Page has no
  linked IG account.
- Fallback: `INSTAGRAM_ACCESS_TOKEN` / `INSTAGRAM_BUSINESS_ACCOUNT_ID` in
  `.env`.
- Messaging eligibility (who can be messaged, which message types, the
  24-hour window) is governed entirely by Meta's current policies for your
  account — check the Instagram Messaging API docs for your account type
  before assuming a feature works.

## TikTok

TikTok **does** have an official Business Messaging API (part of "TikTok API
for Business", portal at business-api.tiktok.com/portal), but — verified
against TikTok's own docs — it has real gates this codebase respects rather
than works around:

- **Approval-gated.** Registering a developer app is not enough; you must
  separately *apply for Business Messaging API access* and be approved.
- **Business Account only.** The connected TikTok account must be a
  **Business Account** (not personal), with "accept direct messages from
  everyone" turned on in the TikTok app.
- **Region-restricted.** Last verified unavailable for accounts registered
  in the **EEA, Switzerland, and the UK**. Re-check for your account/region
  before relying on this — TikTok can change availability.
- **User-initiated only.** A business cannot message a TikTok user first;
  the user has to message you before you can reply (no WhatsApp-style
  template/first-contact messaging).

Because the exact endpoint URLs and JSON payload shapes only become visible
once your app is approved (they sit behind the authenticated portal), **this
codebase intentionally does not guess TikTok's message payload shape.** To
finish this integration once you're approved:

1. Apply for Business Messaging API access via
   https://business-api.tiktok.com/portal (or https://developers.tiktok.com
   for the general developer account first).
2. Confirm your Business Account is eligible for your region, and that DMs
   from everyone are enabled.
3. Once approved, open the now-accessible API reference and confirm: base
   URLs, auth flow, webhook payload shape, and the exact scopes granted.
4. Fill in `src/modules/platforms/adapters/tiktok.adapter.ts`:
   `connect()`, `sendMessage()`, and `parseWebhookPayload()` using the
   confirmed shapes. `isConfigured()` currently always returns `false` — flip
   it once the above is done.
5. Put `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` / `TIKTOK_WEBHOOK_SECRET`
   in `.env`.

Until then, the Integrations page correctly shows TikTok as unavailable
rather than faking a connection (Section 49).

## Where credentials go

App-level secrets (`META_APP_ID`, `META_APP_SECRET`, `OPENAI_API_KEY`,
`N8N_WEBHOOK_SECRET`, etc.) go in `.env` — never in the frontend, never
committed to git. See `.env.example` for the full list.

Per-Page/account **access tokens** obtained via the OAuth flow above are
stored encrypted (AES-256-GCM, `src/lib/crypto.ts`) in the database
(`SocialIntegration.encryptedAccessToken`), never in `.env` and never
returned to the frontend — `/api/integrations` only ever exposes connection
status. See `SECURITY.md`.
