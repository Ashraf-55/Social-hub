# Architecture

```
src/
  app/                 Next.js App Router
    api/               Route Handlers (REST-ish JSON API)
      webhooks/        One route per platform: whatsapp, messenger, instagram, tiktok
      auth/ conversations/ customers/ integrations/ automations/ employees/ reports/ ai/ mock/
    dashboard/          Authenticated UI pages (Inbox, Customers, Integrations, ...)
    login/
  components/          UI components (layout, inbox)
  modules/
    platforms/         Adapter Pattern: SocialPlatformAdapter interface + one class per platform + registry
    automation/         (automation logic actually lives in services/automation.service.ts)
    ai/                 Optional AI service (OpenAI)
    mock/               Mock Mode simulator
  services/            Core business logic (webhook ingestion, automation engine, n8n dispatch, notifications)
  lib/                 Cross-cutting: prisma client, auth/session, permissions, crypto, config
  types/               Shared TypeScript types (UnifiedMessage, etc.)
prisma/
  schema.prisma        Full SQL schema (PostgreSQL)
  seed.ts
```

## Core idea: Unified Message + Adapter Pattern

Nothing outside `src/modules/platforms/` ever touches a raw WhatsApp/Meta/TikTok
payload. Every platform implements the same `SocialPlatformAdapter` interface
(`src/modules/platforms/adapter.ts`):

```ts
interface SocialPlatformAdapter {
  isConfigured(): boolean;
  connect(): Promise<ConnectionStatus>;
  disconnect(): Promise<void>;
  sendMessage(input): Promise<SendMessageResult>;
  verifyWebhook(request): Promise<UnifiedWebhookVerification>;
  parseWebhookPayload(payload): UnifiedMessage[];
}
```

A webhook route (`src/app/api/webhooks/<platform>/route.ts`) only ever:
1. calls `adapter.verifyWebhook(request)`,
2. calls `adapter.parseWebhookPayload(payload)` to get `UnifiedMessage[]`,
3. hands them to `services/webhook.service.ts` (`ingestWebhookEvent`), which
   is 100% platform-agnostic: dedup, customer upsert, conversation upsert,
   message persistence, automation trigger, n8n dispatch.

Adding a new platform (Telegram, Email, Live Chat...) means: write one new
adapter class implementing the interface, register it in
`src/modules/platforms/registry.ts`, and add one webhook route. Nothing else
in the system changes.

## Request flow (inbound message)

```
Platform → POST /api/webhooks/<platform>
         → adapter.verifyWebhook()          (signature / hub.challenge)
         → adapter.parseWebhookPayload()    (→ UnifiedMessage[])
         → webhook.service.ingestWebhookEvent()
             → WebhookEvent dedup (unique platform+externalEventId)
             → Customer upsert
             → Conversation upsert
             → Message persisted
             → automation.service.runAutomationsForMessage()  (in-app rules)
             → n8n.service.dispatchToN8n()                    (optional, external workflows)
             → Notification created
```

## Request flow (outbound reply)

```
Employee types in Inbox UI
  → POST /api/conversations/:id/messages
    → getAdapter(conversation.platform).sendMessage()
    → Message persisted (OUTBOUND)
    → AuditLog entry
```

## Multi-tenant (Section 47)

Every domain model carries `organizationId`. All queries in `services/` and
`api/` routes filter by `session.organizationId`, so converting to a real
multi-business SaaS later is a matter of onboarding flows, not a schema
rewrite.

## Real-time updates

The Inbox currently uses short-interval polling (`GET /api/conversations`
every 5s) as a simple, dependency-free baseline that already satisfies
"new message appears without manual refresh". Swapping this for WebSockets/
SSE (Section 40) is a drop-in replacement at the `loadConversations()` call
site in `src/app/dashboard/inbox/page.tsx` — see the "Known gaps" note in
the final report for why it wasn't done in this pass.
