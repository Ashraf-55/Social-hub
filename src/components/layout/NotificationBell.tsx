"use client";

import { useEffect, useRef, useState } from "react";

interface NotificationRow {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  NEW_MESSAGE: "رسالة جديدة",
  NEW_CUSTOMER: "عميل جديد",
  CONVERSATION_ASSIGNED: "تم تعيين محادثة",
  AI_ESCALATION: "تصعيد من AI",
  INTEGRATION_ERROR: "خطأ في تكامل",
  AUTOMATION_FAILED: "فشل Automation"
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
  }

  useEffect(() => {
    load();

    const source = new EventSource("/api/realtime");
    source.onmessage = (evt) => {
      try {
        const parsed = JSON.parse(evt.data);
        if (parsed.type === "notification.created") load();
      } catch {
        /* ignore malformed/heartbeat frames */
      }
    };

    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      source.close();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true })
    });
    load();
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--bg-muted)]" aria-label="Notifications">
        🔔
        {unreadCount > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 z-50 mt-2 w-80 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-lg">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <span className="text-sm font-medium">الإشعارات</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
                تعليم الكل كمقروء
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && <p className="p-4 text-center text-xs text-[var(--text-muted)]">لا توجد إشعارات بعد.</p>}
            {notifications.map((n) => (
              <div key={n.id} className={`border-b border-gray-50 px-3 py-2 text-xs ${n.read ? "text-[var(--text-muted)]" : "text-[var(--text-primary)]"}`}>
                <div className="font-medium">{TYPE_LABEL[n.type] ?? n.type}</div>
                <div>{n.message}</div>
                <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">{new Date(n.createdAt).toLocaleString("ar-EG")}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
