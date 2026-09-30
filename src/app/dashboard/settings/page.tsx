"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SettingsData {
  business: { name: string; contactEmail: string | null; contactPhone: string | null; timezone: string };
  ai: { envEnabled: boolean; systemPromptExtra: string | null; defaultAiMode: string };
  automation: { enabled: boolean; n8nConnected: boolean };
  notifications: { muted: string[] };
  summary: { appMode: string; integrationsConnected: number; employeeCount: number; role: string };
  recentAuditLogs: { id: string; action: string; target: string | null; actor: string; createdAt: string }[];
}

const NOTIFICATION_LABELS: Record<string, string> = {
  NEW_MESSAGE: "رسالة جديدة",
  NEW_CUSTOMER: "عميل جديد",
  CONVERSATION_ASSIGNED: "تعيين محادثة",
  AI_ESCALATION: "تصعيد AI",
  INTEGRATION_ERROR: "خطأ تكامل",
  AUTOMATION_FAILED: "فشل Automation"
};

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/settings");
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function save(section: string, patch: Record<string, unknown>) {
    setSaving(section);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    setSaving(null);
    if (res.ok) {
      setSavedFlash(section);
      setTimeout(() => setSavedFlash(null), 2000);
      load();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "فشل الحفظ");
    }
  }

  if (!data) return <div className="p-6 text-sm text-[var(--text-muted)]">جارِ التحميل...</div>;
  const isAdmin = data.summary.role === "ADMIN";

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      {!isAdmin && (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
          بعض الإعدادات هنا متاحة للـ Admin فقط للتعديل — أنت تراها للعرض.
        </div>
      )}

      {/* Business Information */}
      <Section title="Business Information">
        <BusinessInfoForm data={data.business} isAdmin={isAdmin} saving={saving === "business"} saved={savedFlash === "business"} onSave={(patch) => save("business", patch)} />
      </Section>

      {/* Social Integrations */}
      <Section title="Social Integrations">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-secondary)]">
            {data.summary.integrationsConnected} منصة متصلة · وضع التشغيل: <b>{data.summary.appMode === "mock" ? "Mock" : "Live"}</b>
          </span>
          <Link href="/dashboard/integrations" className="rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-xs hover:bg-[var(--bg-muted)]">
            إدارة الـ Integrations →
          </Link>
        </div>
      </Section>

      {/* AI Settings */}
      <Section title="AI Settings">
        <div className="mb-3 text-xs text-[var(--text-muted)]">
          حالة AI على مستوى السيرفر:{" "}
          <b className={data.ai.envEnabled ? "text-green-600" : "text-[var(--text-muted)]"}>{data.ai.envEnabled ? "مفعّل" : "معطّل (OPENAI_API_KEY / AI_ENABLED في .env)"}</b>
        </div>
        <AiSettingsForm data={data.ai} isAdmin={isAdmin && data.ai.envEnabled} saving={saving === "ai"} saved={savedFlash === "ai"} onSave={(patch) => save("ai", patch)} />
      </Section>

      {/* Automation Settings */}
      <Section title="Automation Settings">
        <div className="flex items-center justify-between text-sm">
          <div>
            <div className="text-[var(--text-primary)]">تشغيل الـ Automation Rules في المؤسسة</div>
            <div className="text-xs text-[var(--text-muted)]">n8n: {data.automation.n8nConnected ? "متصل" : "غير متصل (اختياري)"}</div>
          </div>
          <div className="flex items-center gap-3">
            <ToggleSwitch checked={data.automation.enabled} disabled={!isAdmin} onChange={(v) => save("automation", { automationsEnabled: v })} />
            <Link href="/dashboard/automations" className="rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-xs hover:bg-[var(--bg-muted)]">
              القواعد →
            </Link>
          </div>
        </div>
      </Section>

      {/* Notification Settings */}
      <Section title="Notification Settings">
        <p className="mb-2 text-xs text-[var(--text-muted)]">أوقف تصعيد أنواع معينة من الإشعارات (لن تظهر في الجرس أو الـ Real-time).</p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(NOTIFICATION_LABELS).map(([type, label]) => {
            const muted = data.notifications.muted.includes(type);
            return (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={!muted}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? data.notifications.muted.filter((t) => t !== type)
                      : [...data.notifications.muted, type];
                    save("notifications", { mutedNotificationTypes: next });
                  }}
                />
                {label}
              </label>
            );
          })}
        </div>
      </Section>

      {/* Employees */}
      <Section title="Employees">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-secondary)]">{data.summary.employeeCount} موظف نشط</span>
          <Link href="/dashboard/employees" className="rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-xs hover:bg-[var(--bg-muted)]">
            إدارة الموظفين →
          </Link>
        </div>
      </Section>

      {/* Security */}
      <Section title="Security">
        <div className="space-y-2 text-sm">
          <div className="text-[var(--text-secondary)]">
            دورك الحالي: <b>{data.summary.role}</b>
          </div>
          <div>
            <div className="mb-1 text-xs font-medium text-[var(--text-muted)]">آخر نشاط (Audit Log)</div>
            <div className="space-y-1">
              {data.recentAuditLogs.length === 0 && <p className="text-xs text-[var(--text-muted)]">لا يوجد نشاط مسجّل بعد.</p>}
              {data.recentAuditLogs.map((l) => (
                <div key={l.id} className="text-xs text-[var(--text-muted)]">
                  <b>{l.actor}</b> — {l.action} {l.target ? `(${l.target})` : ""} — {new Date(l.createdAt).toLocaleString("ar-EG")}
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            HTTPS، Rate Limiting، CSRF، تشفير التوكنات، وحماية كلمات المرور كلها مفعّلة على مستوى الكود — راجع SECURITY.md للتفاصيل الكاملة.
          </p>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm p-4">
      <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
      {children}
    </div>
  );
}

function ToggleSwitch({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? "bg-[var(--accent)]" : "bg-gray-300"}`}
    >
      <span
        className="absolute top-0.5 h-4 w-4 rounded-full bg-[var(--bg-surface)] shadow transition-all"
        style={{ insetInlineStart: checked ? "18px" : "2px" }}
      />
    </button>
  );
}

function BusinessInfoForm({
  data,
  isAdmin,
  saving,
  saved,
  onSave
}: {
  data: SettingsData["business"];
  isAdmin: boolean;
  saving: boolean;
  saved: boolean;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [email, setEmail] = useState(data.contactEmail ?? "");
  const [phone, setPhone] = useState(data.contactPhone ?? "");
  const [timezone, setTimezone] = useState(data.timezone);

  return (
    <div className="space-y-3">
      <Field label="اسم المؤسسة">
        <input value={data.name} disabled className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-muted)] px-2 py-1.5 text-sm text-[var(--text-muted)]" />
      </Field>
      <Field label="بريد التواصل">
        <input value={email} disabled={!isAdmin} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-[var(--border-strong)] px-2 py-1.5 text-sm" />
      </Field>
      <Field label="هاتف التواصل">
        <input value={phone} disabled={!isAdmin} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border border-[var(--border-strong)] px-2 py-1.5 text-sm" />
      </Field>
      <Field label="المنطقة الزمنية">
        <input value={timezone} disabled={!isAdmin} onChange={(e) => setTimezone(e.target.value)} className="w-full rounded-md border border-[var(--border-strong)] px-2 py-1.5 text-sm" />
      </Field>
      {isAdmin && (
        <button
          onClick={() => onSave({ contactEmail: email || null, contactPhone: phone || null, timezone })}
          disabled={saving}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {saving ? "جارِ الحفظ..." : saved ? "تم الحفظ ✓" : "حفظ"}
        </button>
      )}
    </div>
  );
}

function AiSettingsForm({
  data,
  isAdmin,
  saving,
  saved,
  onSave
}: {
  data: SettingsData["ai"];
  isAdmin: boolean;
  saving: boolean;
  saved: boolean;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [prompt, setPrompt] = useState(data.systemPromptExtra ?? "");
  const [mode, setMode] = useState(data.defaultAiMode);

  return (
    <div className="space-y-3">
      <Field label="Default AI Mode للمحادثات الجديدة">
        <select value={mode} disabled={!isAdmin} onChange={(e) => setMode(e.target.value)} className="w-full rounded-md border border-[var(--border-strong)] px-2 py-1.5 text-sm">
          <option value="HUMAN">Human — الموظف يرد</option>
          <option value="AI">AI — رد تلقائي</option>
          <option value="HYBRID">Hybrid — اقتراح يحتاج موافقة</option>
        </select>
      </Field>
      <Field label="تعليمات إضافية للـ AI (Business-specific)">
        <textarea
          value={prompt}
          disabled={!isAdmin}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="مثال: دايمًا رد باللهجة المصرية. متوعدش بتوصيل في نفس اليوم."
          className="w-full rounded-md border border-[var(--border-strong)] px-2 py-1.5 text-sm"
        />
      </Field>
      {isAdmin && (
        <button
          onClick={() => onSave({ defaultAiMode: mode, aiSystemPromptExtra: prompt || null })}
          disabled={saving}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {saving ? "جارِ الحفظ..." : saved ? "تم الحفظ ✓" : "حفظ"}
        </button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">{label}</label>
      {children}
    </div>
  );
}
