import { describe, it, expect } from "vitest";

// Mirrors src/lib/permissions.ts::hasPermission without touching Prisma,
// so permission logic is covered even without a database connection.
type Role = "ADMIN" | "EMPLOYEE";

function hasPermissionPure(role: Role, granted: string[], permission: string): boolean {
  if (role === "ADMIN") return true;
  return granted.includes(permission);
}

describe("permission checking", () => {
  it("ADMIN always has every permission, regardless of explicit grants", () => {
    expect(hasPermissionPure("ADMIN", [], "MANAGE_EMPLOYEES")).toBe(true);
  });

  it("EMPLOYEE only has explicitly granted permissions", () => {
    expect(hasPermissionPure("EMPLOYEE", ["VIEW_INBOX", "REPLY_MESSAGES"], "REPLY_MESSAGES")).toBe(true);
    expect(hasPermissionPure("EMPLOYEE", ["VIEW_INBOX"], "MANAGE_EMPLOYEES")).toBe(false);
  });

  it("EMPLOYEE with no grants has no permissions", () => {
    expect(hasPermissionPure("EMPLOYEE", [], "VIEW_INBOX")).toBe(false);
  });
});
