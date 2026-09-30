import { describe, it, expect } from "vitest";

// Mirrors the externalEventId derivation used in each
// src/app/api/webhooks/<platform>/route.ts so the dedup key logic is
// covered without spinning up a Next.js request/Prisma.
function deriveExternalEventId(payload: any, fallback: string): string {
  const entryId = payload?.entry?.[0]?.id ?? "unknown";
  const msgId =
    payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id ??
    payload?.entry?.[0]?.messaging?.[0]?.message?.mid ??
    fallback;
  return `${entryId}:${msgId}`;
}

describe("webhook duplicate-event key (Section 31)", () => {
  it("produces the same key for the same WhatsApp payload sent twice", () => {
    const payload = {
      entry: [{ id: "acct1", changes: [{ value: { messages: [{ id: "wamid.ABC123" }] } }] }]
    };
    const key1 = deriveExternalEventId(payload, "fallback-1");
    const key2 = deriveExternalEventId(payload, "fallback-2");
    expect(key1).toBe(key2);
    expect(key1).toBe("acct1:wamid.ABC123");
  });

  it("produces the same key for the same Messenger/Instagram payload sent twice", () => {
    const payload = { entry: [{ id: "page1", messaging: [{ message: { mid: "mid.XYZ" } }] }] };
    expect(deriveExternalEventId(payload, "a")).toBe(deriveExternalEventId(payload, "b"));
  });

  it("falls back to a random id (no dedup guarantee) when the payload has no message id", () => {
    const payload = { entry: [{ id: "acct1" }] };
    const key1 = deriveExternalEventId(payload, "random-1");
    const key2 = deriveExternalEventId(payload, "random-2");
    expect(key1).not.toBe(key2);
  });
});
