import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { cached } from "@/lib/cache";

const REPORTS_CACHE_TTL_MS = 30_000; // 30s: fresh enough for a dashboard, cheap enough to matter

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = session.organizationId;

  const report = await cached(`reports:${orgId}`, REPORTS_CACHE_TTL_MS, () => computeReports(orgId));
  return NextResponse.json(report, { headers: { "Cache-Control": "private, max-age=30" } });
}

async function computeReports(orgId: string) {
  const [byPlatform, byStatus, newCustomers30d, automationExecs, aiRequestsTotal, aiRequestsFailed, perDay, employeeMessages]: [
    { platform: string; _count: number }[],
    { status: string; _count: number }[],
    number,
    number,
    number,
    number,
    { day: string; count: bigint }[],
    { sentByUserId: string | null; _count: number }[]
  ] = await Promise.all([
      prisma.conversation.groupBy({ by: ["platform"], where: { organizationId: orgId }, _count: true }),
      prisma.conversation.groupBy({ by: ["status"], where: { organizationId: orgId }, _count: true }),
      prisma.customer.count({ where: { organizationId: orgId, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } }),
      prisma.automationExecution.count({ where: { automation: { organizationId: orgId } } }),
      prisma.aIRequest.count(),
      prisma.aIRequest.count({ where: { success: false } }),
      // Messages received per day, last 14 days (Section 29: "Conversations per day")
      prisma.$queryRaw<{ day: string; count: bigint }[]>`
        SELECT to_char(date_trunc('day', m."createdAt"), 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS count
        FROM "Message" m
        JOIN "Conversation" c ON c.id = m."conversationId"
        WHERE c."organizationId" = ${orgId} AND m."createdAt" >= NOW() - INTERVAL '14 days'
        GROUP BY 1 ORDER BY 1 ASC
      `.catch(() => [] as { day: string; count: bigint }[]),
      // Outbound messages sent per employee (Section 29: "Employee performance")
      prisma.message.groupBy({
        by: ["sentByUserId"],
        where: { direction: "OUTBOUND", sentByUserId: { not: null }, conversation: { organizationId: orgId } },
        _count: true
      })
    ]);

  // Average first-response time: time between an inbound message and the
  // next outbound message in the same conversation (Section 29: "Response time").
  const avgResponse = await prisma.$queryRaw<{ avg_minutes: number | null }[]>`
    SELECT AVG(EXTRACT(EPOCH FROM (o."createdAt" - i."createdAt")) / 60.0) AS avg_minutes
    FROM "Message" i
    JOIN "Conversation" c ON c.id = i."conversationId"
    JOIN LATERAL (
      SELECT o2."createdAt" FROM "Message" o2
      WHERE o2."conversationId" = i."conversationId" AND o2.direction = 'OUTBOUND' AND o2."createdAt" > i."createdAt"
      ORDER BY o2."createdAt" ASC LIMIT 1
    ) o ON true
    WHERE i.direction = 'INBOUND' AND c."organizationId" = ${orgId}
  `.catch(() => [{ avg_minutes: null }]);

  const employeeIds = employeeMessages.map((e: { sentByUserId: string | null }) => e.sentByUserId).filter(Boolean) as string[];
  const employees = await prisma.user.findMany({ where: { id: { in: employeeIds } }, select: { id: true, name: true } });
  const employeeNameMap: Record<string, string> = Object.fromEntries(employees.map((e: { id: string; name: string }) => [e.id, e.name]));

  return {
    byPlatform: byPlatform.map((r: { platform: string; _count: number }) => ({ label: r.platform, value: r._count })),
    byStatus: byStatus.map((r: { status: string; _count: number }) => ({ label: r.status, value: r._count })),
    newCustomers30d,
    automationExecutions: automationExecs,
    aiUsage: { total: aiRequestsTotal, failed: aiRequestsFailed },
    messagesPerDay: perDay.map((r: { day: string; count: bigint }) => ({ day: r.day, count: Number(r.count) })),
    avgResponseMinutes: avgResponse[0]?.avg_minutes != null ? Math.round(Number(avgResponse[0].avg_minutes) * 10) / 10 : null,
    employeePerformance: employeeMessages.map((e: { sentByUserId: string | null; _count: number }) => ({
      employeeId: e.sentByUserId,
      name: e.sentByUserId ? employeeNameMap[e.sentByUserId] ?? "—" : "—",
      messagesSent: e._count
    }))
  };
}
