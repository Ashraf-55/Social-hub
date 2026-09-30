"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/inbox", label: "Inbox" },
  { href: "/dashboard/customers", label: "Customers" },
  { href: "/dashboard/automations", label: "Automations" },
  { href: "/dashboard/integrations", label: "Integrations" },
  { href: "/dashboard/employees", label: "Employees" },
  { href: "/dashboard/reports", label: "Reports" },
  { href: "/dashboard/settings", label: "Settings" }
];

/**
 * Section 38: on mobile this must behave like a real mobile nav (an
 * off-canvas drawer you open/close), not a permanently-visible 224px
 * column stealing width from the page underneath. `open`/`onClose` are
 * only meaningful below the `md` breakpoint — at `md:` and up the sidebar
 * is always visible in its normal static position regardless of `open`.
 */
export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Backdrop, mobile only, shown while the drawer is open */}
      {open && <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={onClose} aria-hidden="true" />}

      <aside
        className={`fixed inset-y-0 start-0 z-50 flex h-screen w-64 shrink-0 flex-col bg-[var(--sidebar-bg)] transition-transform duration-200 md:static md:z-auto md:w-56 md:translate-x-0 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--sidebar-border)] px-4 py-4">
          <span className="text-base font-semibold text-[var(--sidebar-text-active)]">Social Hub</span>
          <button onClick={onClose} className="rounded p-1 text-[var(--sidebar-text)] hover:bg-[var(--sidebar-bg-hover)] md:hidden" aria-label="إغلاق القائمة">
            ×
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? "bg-[var(--accent)] text-white" : "text-[var(--sidebar-text)] hover:bg-[var(--sidebar-bg-hover)] hover:text-[var(--sidebar-text-active)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--sidebar-border)] p-2">
          <button onClick={logout} className="w-full rounded-md px-3 py-2 text-start text-sm text-[var(--sidebar-text)] hover:bg-[var(--sidebar-bg-hover)] hover:text-[var(--sidebar-text-active)]">
            تسجيل الخروج
          </button>
        </div>
      </aside>
    </>
  );
}
