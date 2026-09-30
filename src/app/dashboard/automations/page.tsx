"use client";

import { useEffect, useState } from "react";

interface AutomationRow {
  id: string;
  name: string;
  enabled: boolean;
  conditions: any;
  actions: any[];
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<AutomationRow[]>([]);
  const [name, setName] = useState("");
  const [contains, setContains] = useState("");
  const [replyText, setReplyText] = useState("");

  async function load() {
    const res = await fetch("/api/automations");
    if (res.ok) setAutomations((await res.json()).automations);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name || !contains || !replyText) return;
    await fetch("/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        triggerType: "new_message",
        conditions: { contains },
        actions: [{ type: "send_reply", text: replyText }],
        enabled: true
      })
    });
    setName("");
    setContains("");
    setReplyText("");
    load();
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-semibold">Automations</h1>

      <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm p-4">
        <h2 className="mb-3 text-sm font-medium">قاعدة جديدة: رد تلقائي عند وجود كلمة معينة</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم القاعدة" className="rounded-md border border-[var(--border-strong)] px-3 py-2 text-sm" />
          <input value={contains} onChange={(e) => setContains(e.target.value)} placeholder='الرسالة تحتوي على... (مثال: price)' className="rounded-md border border-[var(--border-strong)] px-3 py-2 text-sm" />
          <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="نص الرد التلقائي" className="rounded-md border border-[var(--border-strong)] px-3 py-2 text-sm" />
          <button onClick={create} className="rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white hover:bg-[var(--accent-hover)]">إنشاء</button>
        </div>
      </div>

      <div className="space-y-2">
        {automations.length === 0 && <p className="text-sm text-[var(--text-muted)]">لا توجد Automations بعد.</p>}
        {automations.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm p-3 text-sm">
            <div>
              <div className="font-medium">{a.name}</div>
              <div className="text-xs text-[var(--text-muted)]">
                WHEN new_message IF contains &quot;{a.conditions?.contains}&quot; THEN send_reply
              </div>
            </div>
            <span className={`rounded px-2 py-0.5 text-xs ${a.enabled ? "bg-green-100 text-green-700" : "bg-[var(--bg-muted)] text-[var(--text-muted)]"}`}>
              {a.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
