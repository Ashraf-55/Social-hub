import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MessagesByPlatformChart } from "@/components/ui/MessagesByPlatformChart";

export default async function DashboardHomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const orgId = session.organizationId;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [total, unread, activeCustomers, resolved, messagesToday, byPlatform]: [number, number, number, number, number, { platform: string; _count: number }[]] = await Promise.all([
    prisma.conversation.count({ where: { organizationId: orgId } }),
    prisma.conversation.count({ where: { organizationId: orgId, unreadCount: { gt: 0 } } }),
    prisma.customer.count({ where: { organizationId: orgId } }),
    prisma.conversation.count({ where: { organizationId: orgId, status: "RESOLVED" } }),
    prisma.message.count({ where: { conversation: { organizationId: orgId }, createdAt: { gte: startOfToday } } }),
    prisma.conversation.groupBy({ by: ["platform"], where: { organizationId: orgId }, _count: true })
  ]);

  const cards = [
    { label: "Total Conversations", value: total },
    { label: "Unread Messages", value: unread },
    { label: "Active Customers", value: activeCustomers },
    { label: "Resolved Conversations", value: resolved },
    { label: "Messages Today", value: messagesToday }
  ];

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-semibold">Dashboard</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm p-4">
            <div className="text-2xl font-semibold">{c.value}</div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm p-4">
        <h2 className="mb-3 text-sm font-medium text-[var(--text-primary)]">Messages by Platform</h2>
        <MessagesByPlatformChart data={byPlatform.map((row) => ({ platform: row.platform, count: row._count }))} />
      </div>
    </div>
  );
}
