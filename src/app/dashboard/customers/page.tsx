"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface CustomerRow {
  id: string;
  name: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  instagramId: string | null;
  facebookId: string | null;
  lastInteraction: string | null;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers);
      }
      setLoading(false);
    }, 250); // debounce search input

    return () => clearTimeout(timeout);
  }, [q]);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Customers</h1>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث بالاسم أو الهاتف أو الإيميل..."
          className="w-72 rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-sm focus:border-[var(--accent)] focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--bg-muted)] text-start text-xs text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-2 text-start">Name</th>
              <th className="px-4 py-2 text-start">Phone</th>
              <th className="px-4 py-2 text-start">WhatsApp</th>
              <th className="px-4 py-2 text-start">Instagram</th>
              <th className="px-4 py-2 text-start">Facebook</th>
              <th className="px-4 py-2 text-start">Last Interaction</th>
            </tr>
          </thead>
          <tbody>
            {!loading && customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[var(--text-muted)]">
                  {q ? "لا نتائج مطابقة." : "لا يوجد عملاء بعد."}
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                <td className="p-0">
                  <Link href={`/dashboard/customers/${c.id}`} className="block px-4 py-2 hover:bg-[var(--bg-muted)]">
                    {c.name ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-2 text-[var(--text-muted)]">{c.phone ?? "—"}</td>
                <td className="px-4 py-2 text-[var(--text-muted)]">{c.whatsappNumber ?? "—"}</td>
                <td className="px-4 py-2 text-[var(--text-muted)]">{c.instagramId ?? "—"}</td>
                <td className="px-4 py-2 text-[var(--text-muted)]">{c.facebookId ?? "—"}</td>
                <td className="px-4 py-2 text-[var(--text-muted)]">
                  {c.lastInteraction ? new Date(c.lastInteraction).toLocaleString("ar-EG") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
