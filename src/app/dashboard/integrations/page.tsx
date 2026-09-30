"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface IntegrationRow {
  platform: string;
  status: string;
  accountName: string | null;
  lastWebhookAt: string | null;
  lastError: string | null;
  configured: boolean;
  mockMode: boolean;
}

const OAUTH_PLATFORMS = new Set(["messenger", "instagram"]);

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--text-muted)]">جارِ التحميل...</div>}>
      <IntegrationsPageInner />
    </Suspense>
  );
}

function IntegrationsPageInner() {
  const [rows, setRows] = useState<IntegrationRow[]>([]);
  const [mode, setMode] = useState<"mock" | "live">("mock");
  const [busy, setBusy] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  const oauthError = searchParams.get("oauth_error");
  const oauthSuccess = searchParams.get("oauth_success");

  async function load() {
    const res = await fetch("/api/integrations");
    if (res.ok) {
      const data = await res.json();
      setRows(data.integrations);
      setMode(data.mode);
    }
  }

  useEffect(() => {
    load();
    if (oauthError || oauthSuccess) {
      const timeout = setTimeout(() => router.replace("/dashboard/integrations"), 6000);
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect(platform: string) {
    if (OAUTH_PLATFORMS.has(platform) && mode === "live") {
      // Real Meta OAuth (Section 17) — full page navigation, not a fetch call.
      window.location.href = `/api/integrations/oauth/${platform}/start`;
      return;
    }
    setBusy(platform);
    await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform })
    });
    await load();
    setBusy(null);
  }

  async function disconnect(platform: string) {
    setBusy(platform);
    await fetch("/api/integrations/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform })
    });
    await load();
    setBusy(null);
  }

  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Integrations</h1>
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        الوضع الحالي: <span className="font-medium">{mode === "mock" ? "Mock Mode (بدون حسابات حقيقية)" : "Live Mode"}</span>
      </p>

      {oauthSuccess && (
        <div className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">تم ربط {oauthSuccess} بنجاح عبر OAuth ✅</div>
      )}
      {oauthError && <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">فشل الربط: {oauthError}</div>}

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.platform} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm p-4">
            <div>
              <div className="font-medium capitalize">{row.platform}</div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                {row.status === "CONNECTED" ? (
                  <span className="text-green-600">Connected{row.accountName ? ` — ${row.accountName}` : ""}</span>
                ) : row.status === "ERROR" || row.status === "TOKEN_EXPIRED" ? (
                  <span className="text-red-600">⚠ {row.lastError ?? row.status}</span>
                ) : (
                  <span className="text-[var(--text-muted)]">Not Connected</span>
                )}
              </div>
              {mode === "live" && OAUTH_PLATFORMS.has(row.platform) && row.status !== "CONNECTED" && (
                <div className="mt-1 text-xs text-[var(--text-muted)]">سيتم فتح صفحة تسجيل دخول Meta الرسمية (OAuth) لاختيار الـ Page.</div>
              )}
              {row.platform === "whatsapp" && !row.configured && mode === "live" && (
                <div className="mt-1 text-xs text-amber-600">
                  WhatsApp يستخدم System User Token (وليس OAuth عادي) — أضف WHATSAPP_ACCESS_TOKEN وWHATSAPP_PHONE_NUMBER_ID في .env. راجع INTEGRATIONS.md.
                </div>
              )}
              {row.platform === "tiktok" && (
                <div className="mt-1 text-xs text-amber-600">يحتاج موافقة Business Messaging API من TikTok قبل الربط — راجع INTEGRATIONS.md.</div>
              )}
            </div>

            <div className="flex gap-2">
              {row.status === "CONNECTED" ? (
                <button
                  onClick={() => disconnect(row.platform)}
                  disabled={busy === row.platform}
                  className="rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] disabled:opacity-50"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => connect(row.platform)}
                  disabled={busy === row.platform || (row.platform === "tiktok" && mode === "live")}
                  className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                >
                  {mode === "mock" ? "Connect (Mock)" : OAUTH_PLATFORMS.has(row.platform) ? "Connect with Meta (OAuth)" : "Connect"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
