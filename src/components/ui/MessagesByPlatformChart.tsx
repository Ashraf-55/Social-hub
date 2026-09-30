"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export function MessagesByPlatformChart({ data }: { data: { platform: string; count: number }[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">لا توجد بيانات بعد. جرّب Mock Mode من صفحة Inbox.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e6ec" />
        <XAxis dataKey="platform" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
