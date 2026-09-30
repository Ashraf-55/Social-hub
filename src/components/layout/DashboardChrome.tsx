"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { NotificationBell } from "./NotificationBell";

export function DashboardChrome({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface)] px-4">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-muted)] md:hidden"
            aria-label="فتح القائمة"
          >
            ☰
          </button>
          <span className="hidden md:block" /> {/* spacer to keep the bell end-aligned on desktop */}
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
