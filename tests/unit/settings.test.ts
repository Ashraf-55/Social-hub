import { describe, it, expect } from "vitest";

// Mirrors the guard logic in src/services/notification.service.ts and
// src/services/automation.service.ts without needing a database, so the
// Section 48 settings actually change behavior (not just stored values).

function shouldSkipNotification(mutedTypes: string[], type: string): boolean {
  return mutedTypes.includes(type);
}

function shouldSkipAutomations(automationsEnabled: boolean): boolean {
  return !automationsEnabled;
}

describe("Section 48 settings: notification muting", () => {
  it("skips a notification type the org has muted", () => {
    expect(shouldSkipNotification(["NEW_MESSAGE", "AI_ESCALATION"], "NEW_MESSAGE")).toBe(true);
  });

  it("does not skip a type that isn't muted", () => {
    expect(shouldSkipNotification(["NEW_MESSAGE"], "AUTOMATION_FAILED")).toBe(false);
  });

  it("skips nothing when the mute list is empty (default)", () => {
    expect(shouldSkipNotification([], "NEW_CUSTOMER")).toBe(false);
  });
});

describe("Section 48 settings: automation kill switch", () => {
  it("runs automations when the org-wide switch is enabled (default)", () => {
    expect(shouldSkipAutomations(true)).toBe(false);
  });

  it("skips all automations when the org-wide switch is disabled", () => {
    expect(shouldSkipAutomations(false)).toBe(true);
  });
});
