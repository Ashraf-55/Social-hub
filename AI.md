# AI Module (Optional)

`src/modules/ai/ai.service.ts` wraps the OpenAI SDK. If `OPENAI_API_KEY` is
missing or `AI_ENABLED` is not `"true"`, every function returns a neutral
"disabled" result and nothing else in the app breaks (Section 6).

## Enable it

```env
OPENAI_API_KEY=sk-...
AI_ENABLED=true
```

## Functions

- `suggestReply(history)` → `{ reply, confident }`. Confidence is a simple
  heuristic (checks whether the model itself expressed uncertainty) — for
  production, consider a stricter check (e.g. a second classification call,
  or requiring the model to output a structured confidence field).
- `classifyMessage(content)` → `{ intent, entities, confident }`
- `summarizeConversation(messages)` → string

Every call is logged to the `AIRequest` table (kind, input, output,
success/error) for auditability, per Section 35 (without ever logging
access tokens).

## Human Handoff (Section 24-25)

`Conversation.aiMode` is `AI | HUMAN | HYBRID`:
- **HUMAN** (default): employees reply manually; `/api/ai/suggest-reply` is
  available as an assist button but never auto-sends.
- **AI**: wire `webhook.service.ts`'s ingestion to call `suggestReply` and
  auto-send when `confident === true`; on `confident === false`, fall back
  to the "transferring to a human agent" message instead of guessing
  (already implemented in the `/api/ai/suggest-reply` response shape).
- **HYBRID**: UI shows the AI suggestion in the composer for the employee to
  edit/approve before sending (not yet wired into the Inbox UI — see final
  report).
