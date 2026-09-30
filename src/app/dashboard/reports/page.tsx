"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface ReportsData {
  byPlatform: { label: string; value: number }[];
  byStatus: { label: string; value: number }[];
  newCustomers30d: number;
  automationExecutions: number;
  aiUsage: { total: number; failed: number };
  messagesPerDay: { day: string; count: number }[];
  avgResponseMinutes: number | null;
  employeePerformance: { employeeId: string; name: string; messagesSent: number }[];
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) return <div className="p-6 text-sm text-[var(--text-muted)]">جارِ تحميل التقارير...</div>;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">Reports</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="عملاء جدد (30 يوم)" value={data.newCustomers30d} />
        <StatCard label="تنفيذات Automation" value={data.automationExecutions} />
        <StatCard label="طلبات AI" value={data.aiUsage.total} sub={data.aiUsage.failed > 0 ? `${data.aiUsage.failed} فشلت` : undefined} />
        <StatCard label="متوسط وقت الرد" value={data.avgResponseMinutes != null ? `${data.avgResponseMinutes} د` : "—"} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="الرسائل يوميًا (آخر 14 يوم)">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.messagesPerDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ec" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="المحادثات حسب المنصة">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byPlatform}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ec" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="المحادثات حسب الحالة">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.byStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ec" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="أداء الموظفين (رسائل مُرسلة)">
          {data.employeePerformance.length === 0 ? (
            <p className="flex h-[220px] items-center justify-center text-sm text-[var(--text-muted)]">لا توجد بيانات كافية بعد.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.employeePerformance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ec" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Bar dataKey="messagesSent" fill="#4f46e5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm p-4">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-red-500">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm p-4">
      <h2 className="mb-3 text-sm font-medium text-[var(--text-primary)]">{title}</h2>
      {children}
    </div>
  );
}
