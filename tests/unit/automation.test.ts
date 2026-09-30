import { describe, it, expect } from "vitest";

// Small pure-function extraction mirroring the "contains" condition logic in
// src/services/automation.service.ts, kept here so it can be unit-tested
// without a database connection.
function matchesContains(content: string | undefined, needle: string): boolean {
  return Boolean(content?.toLowerCase().includes(needle.toLowerCase()));
}

describe("automation condition matching", () => {
  it("matches case-insensitively", () => {
    expect(matchesContains("What is the PRICE?", "price")).toBe(true);
  });

  it("does not match unrelated content", () => {
    expect(matchesContains("Is there delivery?", "price")).toBe(false);
  });

  it("handles undefined content safely", () => {
    expect(matchesContains(undefined, "price")).toBe(false);
  });
});
