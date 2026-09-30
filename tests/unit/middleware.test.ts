import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { checkLimit, isSameOrigin } from "@/middleware";

describe("rate limiter (Section 32)", () => {
  it("allows requests up to the limit, then blocks", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(checkLimit(key, 5, 60_000)).toBe(true);
    }
    expect(checkLimit(key, 5, 60_000)).toBe(false);
  });

  it("resets after the window elapses", async () => {
    const key = `test-${Math.random()}`;
    expect(checkLimit(key, 1, 10)).toBe(true);
    expect(checkLimit(key, 1, 10)).toBe(false);
    await new Promise((r) => setTimeout(r, 15));
    expect(checkLimit(key, 1, 10)).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(checkLimit(a, 1, 60_000)).toBe(true);
    expect(checkLimit(b, 1, 60_000)).toBe(true); // not blocked by a's usage
  });
});

describe("CSRF same-origin check (Section 32)", () => {
  function makeRequest(url: string, origin?: string) {
    const headers: Record<string, string> = {};
    if (origin) headers.origin = origin;
    return new NextRequest(url, { headers });
  }

  it("allows a request whose Origin matches the request host", () => {
    const req = makeRequest("https://app.example.com/api/automations", "https://app.example.com");
    expect(isSameOrigin(req)).toBe(true);
  });

  it("blocks a request whose Origin is a different host", () => {
    const req = makeRequest("https://app.example.com/api/automations", "https://evil.example.com");
    expect(isSameOrigin(req)).toBe(false);
  });

  it("always allows webhook routes regardless of Origin (platform servers, not browsers)", () => {
    const req = makeRequest("https://app.example.com/api/webhooks/whatsapp", "https://anything.example.com");
    expect(isSameOrigin(req)).toBe(true);
  });
});
