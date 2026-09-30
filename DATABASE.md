# Database

PostgreSQL + Prisma. Full schema: `prisma/schema.prisma`.

## Setup

```bash
npx prisma migrate dev --name init
npm run db:seed
```

## Key models

- `Organization` — multi-tenant root; every other business model carries `organizationId`.
- `User` (+ `UserPermission`) — ADMIN / EMPLOYEE, fine-grained permissions for EMPLOYEE.
- `Customer` — one row per end-customer, with per-platform external ids (`whatsappNumber`, `facebookId`, `instagramId`, `tiktokId`). Only fields a given platform's API actually exposes are populated.
- `SocialIntegration` / `SocialAccount` — per-organization, per-platform connection status + (encrypted) tokens.
- `Conversation` / `Message` / `MessageAttachment` — the unified inbox data. `Message.platform` + `externalMessageId` trace back to the source event.
- `Tag` / `ConversationTag`, `ConversationNote` — inbox organization.
- `Automation` / `AutomationExecution` — in-app automation rules (Section 21) and their run history.
- `AIRequest` — every AI call logged (kind, input, output, success) for auditability.
- `WebhookEvent` — `@@unique([platform, externalEventId])` is the duplicate-webhook guard (Section 31).
- `Notification`, `AuditLog` — Section 26 / 36.

## Indexes

Applied on the fields queried most: `Message.externalMessageId`,
`Message.createdAt`, `Conversation` by `(organizationId, platform)` and
`(organizationId, status)`, `Customer.phone`/`email`, `WebhookEvent.processed`.

## Why not SQLite

Per the original requirement, PostgreSQL only — `DATABASE_URL` must be a
`postgresql://` connection string. Prisma's SQLite provider is not used
anywhere in this schema.
