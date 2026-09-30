# API

All routes are Next.js Route Handlers under `src/app/api/`. Authenticated
routes read the session from an HttpOnly cookie (`src/lib/auth.ts`).

## Auth
- `POST /api/auth/login` — `{ email, password }` → sets session cookie
- `POST /api/auth/logout`
- `GET /api/auth/me` — current session

## Conversations (Unified Inbox)
- `GET /api/conversations?platform=&status=&employee=&q=&page=`
- `GET /api/conversations/:id` — full thread + notes + tags
- `POST /api/conversations/:id/messages` — `{ content }` → sends via the platform adapter and persists
- `PATCH /api/conversations/:id/status` — `{ status?, priority?, unread? }`
- `PATCH /api/conversations/:id/assign` — `{ employeeId | null }`

## Customers
- `GET /api/customers?q=`

## Integrations
- `GET /api/integrations` — status per platform (mock or live)
- `POST /api/integrations` — `{ platform }` → connect (mock-connects in Mock Mode, calls the real adapter in Live Mode)
- `POST /api/integrations/disconnect` — `{ platform }`

## Automations
- `GET /api/automations`
- `POST /api/automations` — `{ name, conditions: { contains? , isNewCustomer? }, actions: [{ type: "send_reply"|"add_tag"|"assign_employee"|"notify_employee", ... }] }`

## Employees
- `GET /api/employees`
- `POST /api/employees` — ADMIN only — `{ name, email, password, role, permissions[] }`
- `PATCH /api/employees/:id` — ADMIN only — edit name/role/active/password/permissions (Section 15); an admin cannot disable their own account

## Settings (Section 48)
- `GET /api/settings` — business info, AI settings (org default mode + custom prompt), automation kill-switch state, muted notification types, plus read-only summaries (integrations connected, employee count, recent audit log)
- `PATCH /api/settings` — ADMIN only — update any subset: `{ contactEmail, contactPhone, timezone, automationsEnabled, aiSystemPromptExtra, defaultAiMode, mutedNotificationTypes[] }`. `automationsEnabled: false` pauses every automation rule org-wide; `mutedNotificationTypes` suppresses those categories at creation time (not just in the UI)

## Notifications (Section 26)
- `GET /api/notifications?unread=true` — list + unread count
- `PATCH /api/notifications` — `{ id }` to mark one read, or `{ all: true }` for all

## Reports
- `GET /api/reports` — aggregated metrics for the Reports dashboard: messages by platform/status, new customers (30d), automation executions, AI usage, messages-per-day (last 14 days), average first-response time (minutes), employee performance (outbound messages sent). Cached in-process for 30s (Section 39) since these are the heaviest read queries in the app.

## AI (optional)
- `POST /api/ai/suggest-reply` — `{ conversationId }` → `{ suggestion, confident }` (400 if AI disabled). Uses the org's `aiSystemPromptExtra` from Settings if set.
- `POST /api/ai/extract-intent` — `{ conversationId }` → structured `{ intent, product, questions[], confident }` from the customer's latest message (Section 23's worked example)

## Real-time (Section 40)
- `GET /api/realtime` — Server-Sent Events stream (`text/event-stream`), scoped to the caller's organization. Emits `message.received`, `notification.created`, and `ai.suggestion` events the instant a webhook is ingested, so the Inbox updates without a manual refresh. Falls back to a 20s poll if the browser/proxy blocks SSE.

## Webhooks (called by the platforms, not the frontend)
- `GET|POST /api/webhooks/whatsapp`
- `GET|POST /api/webhooks/messenger`
- `GET|POST /api/webhooks/instagram`
- `GET|POST /api/webhooks/tiktok`

## Mock Mode
- `POST /api/mock/trigger` — `{ platform }` → simulates one inbound message end-to-end (disabled when `APP_MODE=live`)

## OpenAPI / Swagger

Full OpenAPI 3.0 spec: `docs/openapi.yaml` (documents every route above,
including request/response schemas, auth, and webhook signature
verification behavior). It's also served live and browsable:

- Spec (YAML): `GET /api/docs/openapi`
- Interactive Swagger UI: `/api-docs` (run `npm run dev` and open
  `http://localhost:3000/api-docs`)

## Rate limiting & CSRF

Every `/api/*` route passes through `src/middleware.ts`: a sliding-window
rate limiter (10 req/min/IP on login, 300 req/min/IP on webhooks, 120
req/min/IP elsewhere) plus an Origin-based CSRF check on state-changing
requests to non-webhook routes. See `SECURITY.md`.
