import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { ingestWebhookEvent } from "@/services/webhook.service";
import { randomUUID } from "crypto";

/**
 * Real integration test: exercises the full webhook pipeline (dedup ->
 * customer upsert -> conversation creation -> message persistence ->
 * automation trigger) against an actual PostgreSQL database via Prisma.
 *
 * Requires a reachable DATABASE_URL (e.g. `docker compose up postgres` and
 * `npx prisma migrate deploy` first). Skips itself — rather than failing —
 * when no database is reachable, which is the case in the sandbox this
 * project was authored in (network egress there blocks Prisma's engine
 * download; see the final report). Run `npm test` locally/in CI with a real
 * Postgres to actually execute these assertions.
 */
let dbAvailable = false;
let orgId = "";

try {
  await prisma.$queryRaw`SELECT 1`;
  dbAvailable = true;
} catch {
  dbAvailable = false;
}

describe.skipIf(!dbAvailable)("webhook ingestion (integration, requires PostgreSQL)", () => {
  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: `Test Org ${randomUUID()}` } });
    orgId = org.id;
    await prisma.socialIntegration.create({
      data: { organizationId: orgId, platform: "WHATSAPP", status: "CONNECTED", externalAccountName: "Test WA" }
    });
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("creates a customer, conversation and message from a new inbound event", async () => {
    const externalEventId = randomUUID();
    const result = await ingestWebhookEvent({
      platform: "whatsapp",
      externalEventId,
      rawPayload: { test: true },
      messages: [
        {
          platform: "whatsapp",
          externalMessageId: randomUUID(),
          customerExternalId: "2010000000",
          customerDisplayName: "Test Customer",
          direction: "inbound",
          type: "text",
          content: "عايز أعرف السعر",
          timestamp: new Date()
        }
      ]
    });

    expect(result.processed).toBe(1);
    expect(result.duplicates).toBe(0);

    const customer = await prisma.customer.findFirst({ where: { organizationId: orgId, whatsappNumber: "2010000000" } });
    expect(customer).not.toBeNull();

    const conversation = await prisma.conversation.findFirst({ where: { customerId: customer!.id } });
    expect(conversation).not.toBeNull();
    expect(conversation!.lastMessagePreview).toContain("عايز أعرف السعر");

    const messages = await prisma.message.findMany({ where: { conversationId: conversation!.id } });
    expect(messages).toHaveLength(1);
  });

  it("does not duplicate a message when the same externalEventId is replayed (Section 31)", async () => {
    const externalEventId = randomUUID();
    const payload = {
      platform: "whatsapp" as const,
      externalEventId,
      rawPayload: { test: true },
      messages: [
        {
          platform: "whatsapp" as const,
          externalMessageId: randomUUID(),
          customerExternalId: "2010000001",
          direction: "inbound" as const,
          type: "text" as const,
          content: "hello",
          timestamp: new Date()
        }
      ]
    };

    const first = await ingestWebhookEvent(payload);
    expect(first.processed).toBe(1);

    const second = await ingestWebhookEvent(payload);
    expect(second.duplicates).toBe(1);
    expect(second.processed).toBe(0);

    const customer = await prisma.customer.findFirst({ where: { organizationId: orgId, whatsappNumber: "2010000001" } });
    const messages = await prisma.message.findMany({ where: { conversation: { customerId: customer!.id } } });
    expect(messages).toHaveLength(1); // not 2
  });
});

if (!dbAvailable) {
  describe("webhook ingestion (integration)", () => {
    it.skip("skipped: no reachable DATABASE_URL in this environment", () => {});
  });
}
