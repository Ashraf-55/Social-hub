"use client";

import { useEffect, useState } from "react";

interface EmployeeRow {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
  active: boolean;
  permissions: { permission: string }[];
}

const ALL_PERMISSIONS = [
  "VIEW_INBOX", "REPLY_MESSAGES", "VIEW_CUSTOMERS", "EDIT_CUSTOMERS",
  "MANAGE_AUTOMATION", "MANAGE_INTEGRATIONS", "MANAGE_EMPLOYEES", "VIEW_REPORTS", "MANAGE_SETTINGS"
];

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<string[]>(["VIEW_INBOX", "REPLY_MESSAGES"]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/employees");
    if (res.ok) setEmployees((await res.json()).employees);
  }

  useEffect(() => {
    load();
  }, []);

  function togglePerm(p: string) {
    setPermissions((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function create() {
    setError(null);
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role: "EMPLOYEE", permissions })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "فشل إنشاء الموظف");
      return;
    }
    setName(""); setEmail(""); setPassword("");
    load();
  }

  async function toggleActive(emp: EmployeeRow) {
    await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !emp.active })
    });
    load();
  }

  async function updatePermissions(emp: EmployeeRow, newPerms: string[]) {
    await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions: newPerms })
    });
    load();
  }

  return (
    <div className="p-6">
      <h1 className="mb-6 text-xl font-semibold">Employees</h1>

      <div className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm p-4">
        <h2 className="mb-3 text-sm font-medium">إضافة موظف جديد</h2>
        {error && <div className="mb-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" className="rounded-md border border-[var(--border-strong)] px-3 py-2 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد الإلكتروني" className="rounded-md border border-[var(--border-strong)] px-3 py-2 text-sm" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="كلمة مرور مؤقتة" className="rounded-md border border-[var(--border-strong)] px-3 py-2 text-sm" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ALL_PERMISSIONS.map((p) => (
            <label key={p} className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
              <input type="checkbox" checked={permissions.includes(p)} onChange={() => togglePerm(p)} />
              {p}
            </label>
          ))}
        </div>
        <button onClick={create} className="mt-3 rounded-md bg-[var(--accent)] px-3 py-2 text-sm text-white hover:bg-[var(--accent-hover)]">إضافة</button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--bg-muted)] text-xs text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-2 text-start">Name</th>
              <th className="px-4 py-2 text-start">Email</th>
              <th className="px-4 py-2 text-start">Role</th>
              <th className="px-4 py-2 text-start">Active</th>
              <th className="px-4 py-2 text-start">Permissions</th>
              <th className="px-4 py-2 text-start"></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-b border-[var(--border)] align-top">
                <td className="px-4 py-2">{e.name}</td>
                <td className="px-4 py-2">{e.email}</td>
                <td className="px-4 py-2">{e.role}</td>
                <td className="px-4 py-2">
                  <span className={e.active ? "text-green-600" : "text-[var(--text-muted)]"}>{e.active ? "✔ نشط" : "✘ معطّل"}</span>
                </td>
                <td className="px-4 py-2">
                  {e.role === "ADMIN" ? (
                    <span className="text-xs text-[var(--text-muted)]">كل الصلاحيات (Admin)</span>
                  ) : editingId === e.id ? (
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_PERMISSIONS.map((p) => {
                        const has = e.permissions.some((x) => x.permission === p);
                        return (
                          <label key={p} className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                            <input
                              type="checkbox"
                              checked={has}
                              onChange={() => {
                                const current = e.permissions.map((x) => x.permission);
                                const next = has ? current.filter((x) => x !== p) : [...current, p];
                                updatePermissions(e, next);
                              }}
                            />
                            {p}
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">{e.permissions.map((p) => p.permission).join(", ") || "بدون صلاحيات"}</span>
                  )}
                </td>
                <td className="space-x-2 px-4 py-2 text-end">
                  {e.role !== "ADMIN" && (
                    <button onClick={() => setEditingId(editingId === e.id ? null : e.id)} className="text-xs text-blue-600 hover:underline">
                      {editingId === e.id ? "تم" : "تعديل الصلاحيات"}
                    </button>
                  )}
                  <button onClick={() => toggleActive(e)} className="ms-3 text-xs text-red-600 hover:underline">
                    {e.active ? "تعطيل" : "تفعيل"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
