# n8n Integration

n8n is an **optional** automation layer (Section 5). The core app (auth,
inbox, database, messaging) works fully without it.

## Setup

Via `docker-compose.yml`: `docker compose up n8n` (default admin/admin — change
`N8N_BASIC_AUTH_PASSWORD` before exposing it publicly). Or use n8n Cloud.

In `.env`:
```env
N8N_BASE_URL=https://your-n8n-host
N8N_WEBHOOK_SECRET=some-long-random-string
```

## How events reach n8n

`src/services/n8n.service.ts` POSTs to `${N8N_BASE_URL}/webhook/social-hub`
with header `X-Webhook-Secret` and body:
```json
{ "eventType": "message.received", "data": { "organizationId": "...", "conversationId": "...", "customerId": "...", "message": { ...UnifiedMessage } }, "sentAt": "..." }
```

Create a matching Webhook node in n8n listening on path `social-hub`, check
the secret header, then branch on `eventType`.

## What to build in n8n vs. in the app

- **In n8n**: notifications to Slack/email, CRM sync, lead scoring, anything
  that changes often or is business-specific.
- **In the app** (`src/services/automation.service.ts`): the fast, simple
  rules directly tied to core data (auto-reply, tagging, assignment) — these
  need low latency and direct DB access, so they stay server-side.

## Sending results back

If an n8n workflow needs to trigger an action in the app (e.g. send a
message after an AI step), have it call the app's own authenticated API
(e.g. `POST /api/conversations/:id/messages`) with a service-to-service
token you set up — this project does not yet include a dedicated n8n→app
callback endpoint; add one under `/api/automations/n8n-callback` if needed,
protected by `N8N_WEBHOOK_SECRET`.
