import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword, createSessionToken, verifySessionToken } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { randomUUID } from "crypto";

let dbAvailable = false;
let orgId = "";
let adminId = "";
let employeeId = "";

try {
  await prisma.$queryRaw`SELECT 1`;
  dbAvailable = true;
} catch {
  dbAvailable = false;
}

describe.skipIf(!dbAvailable)("authentication & authorization (integration, requires PostgreSQL)", () => {
  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: `Auth Test Org ${randomUUID()}` } });
    orgId = org.id;

    const admin = await prisma.user.create({
      data: {
        organizationId: orgId,
        name: "Admin",
        email: `admin-${randomUUID()}@test.local`,
        passwordHash: await hashPassword("correct-horse-battery-staple"),
        role: "ADMIN"
      }
    });
    adminId = admin.id;

    const employee = await prisma.user.create({
      data: {
        organizationId: orgId,
        name: "Employee",
        email: `employee-${randomUUID()}@test.local`,
        passwordHash: await hashPassword("another-password-123"),
        role: "EMPLOYEE",
        permissions: { create: [{ permission: "VIEW_INBOX" }] }
      }
    });
    employeeId = employee.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("hashes passwords and verifies them correctly (and rejects wrong passwords)", async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: adminId } });
    expect(await verifyPassword("correct-horse-battery-staple", admin.passwordHash)).toBe(true);
    expect(await verifyPassword("wrong-password", admin.passwordHash)).toBe(false);
  });

  it("issues a JWT session token that round-trips through verification", async () => {
    const token = await createSessionToken({ userId: adminId, organizationId: orgId, role: "ADMIN", email: "admin@test.local" });
    const payload = await verifySessionToken(token);
    expect(payload?.userId).toBe(adminId);
    expect(payload?.role).toBe("ADMIN");
  });

  it("rejects a tampered session token", async () => {
    const token = await createSessionToken({ userId: adminId, organizationId: orgId, role: "ADMIN", email: "admin@test.local" });
    const tampered = token.slice(0, -2) + "xx";
    const payload = await verifySessionToken(tampered);
    expect(payload).toBeNull();
  });

  it("ADMIN implicitly has every permission", async () => {
    expect(await hasPermission(adminId, "ADMIN", "MANAGE_EMPLOYEES")).toBe(true);
  });

  it("EMPLOYEE only has explicitly granted permissions", async () => {
    expect(await hasPermission(employeeId, "EMPLOYEE", "VIEW_INBOX")).toBe(true);
    expect(await hasPermission(employeeId, "EMPLOYEE", "MANAGE_EMPLOYEES")).toBe(false);
  });
});

if (!dbAvailable) {
  describe("authentication & authorization (integration)", () => {
    it.skip("skipped: no reachable DATABASE_URL in this environment", () => {});
  });
}
