"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PlatformBadge } from "@/components/inbox/PlatformBadge";

interface CustomerDetail {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  whatsappNumber: string | null;
  facebookId: string | null;
  instagramId: string | null;
  tiktokId: string | null;
  notes: string | null;
  createdAt: string;
  lastInteraction: string | null;
  tags: { tag: { id: string; name: string } }[];
  conversations: {
    id: string;
    platform: string;
    status: string;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    assignedEmployee: { id: string; name: string } | null;
  }[];
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch(`/api/customers/${params.id}`);
    if (res.ok) {
      const data = await res.json();
      setCustomer(data.customer);
      setNotesDraft(data.customer.notes ?? "");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function saveNotes() {
    setSaving(true);
    await fetch(`/api/customers/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesDraft })
    });
    setSaving(false);
  }

  if (loading) return <div className="p-6 text-sm text-[var(--text-muted)]">جارِ التحميل...</div>;
  if (!customer) return <div className="p-6 text-sm text-[var(--text-muted)]">العميل غير موجود.</div>;

  const identities = [
    { label: "WhatsApp", value: customer.whatsappNumber },
    { label: "Facebook", value: customer.facebookId },
    { label: "Instagram", value: customer.instagramId },
    { label: "TikTok", value: customer.tiktokId }
  ].filter((i) => i.value);

  return (
    <div className="p-6">
      <Link href="/dashboard/customers" className="mb-4 inline-block text-xs text-[var(--text-muted)] hover:underline">
        ← رجوع لقائمة العملاء
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Profile */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm p-4 lg:col-span-1">
          <h1 className="text-lg font-semibold">{customer.name ?? "عميل بدون اسم"}</h1>
          <div className="mt-3 space-y-1 text-sm text-[var(--text-secondary)]">
            <div>📞 {customer.phone ?? "—"}</div>
            <div>✉️ {customer.email ?? "—"}</div>
            <div className="text-xs text-[var(--text-muted)]">
              أول تفاعل: {new Date(customer.createdAt).toLocaleDateString("ar-EG")} · آخر تفاعل:{" "}
              {customer.lastInteraction ? new Date(customer.lastInteraction).toLocaleString("ar-EG") : "—"}
            </div>
          </div>

          <div className="mt-4">
            <h2 className="mb-1 text-xs font-medium text-[var(--text-muted)]">حسابات مربوطة</h2>
            <div className="space-y-1">
              {identities.length === 0 && <p className="text-xs text-[var(--text-muted)]">لا توجد بيانات هوية بعد.</p>}
              {identities.map((i) => (
                <div key={i.label} className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">{i.label}</span>
                  <span dir="ltr">{i.value}</span>
                </div>
              ))}
            </div>
          </div>

          {customer.tags.length > 0 && (
            <div className="mt-4">
              <h2 className="mb-1 text-xs font-medium text-[var(--text-muted)]">Tags</h2>
              <div className="flex flex-wrap gap-1">
                {customer.tags.map((t) => (
                  <span key={t.tag.id} className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
                    {t.tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <h2 className="mb-1 text-xs font-medium text-[var(--text-muted)]">ملاحظات</h2>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-[var(--border-strong)] p-2 text-xs focus:border-[var(--accent)] focus:outline-none"
              placeholder="ملاحظات داخلية عن هذا العميل..."
            />
            <button
              onClick={saveNotes}
              disabled={saving}
              className="mt-2 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {saving ? "جارِ الحفظ..." : "حفظ الملاحظات"}
            </button>
          </div>
        </div>

        {/* Conversation history across all platforms */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-medium text-[var(--text-primary)]">تاريخ المحادثات ({customer.conversations.length})</h2>
          <div className="space-y-2">
            {customer.conversations.length === 0 && <p className="text-sm text-[var(--text-muted)]">لا توجد محادثات بعد.</p>}
            {customer.conversations.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/inbox?conversation=${c.id}`}
                className="flex items-center justify-between rounded-md border border-[var(--border)] p-3 text-sm hover:bg-[var(--bg-muted)]"
              >
                <div className="flex items-center gap-2">
                  <PlatformBadge platform={c.platform} />
                  <span className="text-[var(--text-secondary)]">{c.lastMessagePreview ?? "—"}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                  {c.assignedEmployee && <span>👤 {c.assignedEmployee.name}</span>}
                  <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5">{c.status}</span>
                  <span>{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleDateString("ar-EG") : "—"}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
