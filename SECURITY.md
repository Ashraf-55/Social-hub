# Security

Implemented in this codebase:

- **Password hashing**: bcrypt, cost factor 12 (`src/lib/auth.ts`).
- **Sessions**: signed JWT in an HttpOnly, SameSite=Lax cookie; `secure` flag
  auto-enabled in production (`src/lib/auth.ts`).
- **Role-based authorization**: ADMIN vs EMPLOYEE + granular `Permission`
  enum checked via `src/lib/permissions.ts`; sensitive routes call
  `requirePermission`.
- **Webhook signature verification**: Meta platforms verify
  `X-Hub-Signature-256` (HMAC-SHA256 over the raw body with `META_APP_SECRET`)
  using `crypto.timingSafeEqual`; the Meta handshake (`hub.challenge`) is
  checked against `META_WEBHOOK_VERIFY_TOKEN`. TikTok verifies
  `X-Tiktok-Signature` the same way once its adapter is completed.
- **Duplicate webhook protection**: `WebhookEvent` unique constraint on
  `(platform, externalEventId)` (Section 31).
- **Input validation**: Zod schemas on every mutating API route.
- **SQL injection**: not applicable — all queries go through Prisma's
  parameterized query builder, no raw SQL string concatenation.
- **Secret encryption at rest**: `src/lib/crypto.ts` (AES-256-GCM). The
  Messenger/Instagram OAuth flow (`src/app/api/integrations/oauth/*`)
  encrypts the obtained Page Access Token before writing it to
  `SocialIntegration.encryptedAccessToken`; `src/services/token.service.ts`
  decrypts it on demand when sending a message, never logging or returning
  the plaintext.
- **No secrets in the frontend**: access tokens never appear in any
  `NEXT_PUBLIC_*` variable or client component; `/api/integrations` only
  ever returns connection status, not tokens.
- **Audit logs**: `AuditLog` records who did what (message sent, status
  changed, integration connected/disconnected, employee created).
- **.env discipline**: `.env` is gitignored; `.env.example` holds only
  placeholders.
- **Rate limiting** (`src/middleware.ts`): sliding-window limiter on every
  `/api/*` route — 10 req/min/IP on `/api/auth/login` (brute-force
  protection), 300 req/min/IP on webhook routes (absorbs a platform's retry
  burst without being unbounded), 120 req/min/IP elsewhere. In-memory and
  process-local; swap the `buckets` Map for Redis/a managed limiter before
  running more than one app instance.
- **CSRF protection** (`src/middleware.ts`): the session cookie is already
  HttpOnly + SameSite=Lax, which blocks classic cross-site form-POST CSRF.
  As a second layer, every state-changing request (`POST`/`PATCH`/`PUT`/
  `DELETE`) to a non-webhook API route is rejected with 403 unless its
  `Origin`/`Referer` host matches the request host. Webhook routes are
  exempt — they're called by platform servers, not browsers, and are
  protected by signature verification instead.

## Still needed before production (not done in this pass)

- **HTTPS termination** — handled by your hosting platform (Vercel/reverse
  proxy), not by this codebase.
- **Full audit-log coverage** — currently covers the highest-value actions
  listed above, not literally every mutation.
- **Multi-instance rate limiting** — the current limiter is per-process; see
  note above if you scale to more than one app replica.
