"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { PlatformBadge } from "@/components/inbox/PlatformBadge";

interface ConversationListItem {
  id: string;
  platform: string;
  status: string;
  priority: string;
  unreadCount: number;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  customer: { id: string; name: string | null; phone: string | null };
  assignedEmployee: { id: string; name: string } | null;
  tags: { tag: { id: string; name: string } }[];
}

interface MessageItem {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  content: string | null;
  createdAt: string;
  aiGenerated?: boolean;
}

interface NoteItem {
  id: string;
  content: string;
  createdAt: string;
  author: { name: string };
}

interface ConversationDetail {
  aiMode: "AI" | "HUMAN" | "HYBRID";
  pendingAiSuggestion: string | null;
  notes: NoteItem[];
  tags: { tag: { id: string; name: string } }[];
}

interface EmployeeOption {
  id: string;
  name: string;
}

const PLATFORMS = ["whatsapp", "messenger", "instagram", "tiktok"];
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--text-muted)]">جارِ التحميل...</div>}>
      <InboxPageInner />
    </Suspense>
  );
}

function InboxPageInner() {
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [mockLoading, setMockLoading] = useState(false);
  const [mockText, setMockText] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [intentResult, setIntentResult] = useState<{ intent: string; product?: string; questions: string[]; confident: boolean } | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const loadConversations = useCallback(async () => {
    const params = new URLSearchParams();
    if (platformFilter) params.set("platform", platformFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("q", search);
    const res = await fetch(`/api/conversations?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations);
    }
  }, [platformFilter, statusFilter, search]);

  useEffect(() => {
    fetch("/api/employees").then((r) => r.ok && r.json()).then((d) => d && setEmployees(d.employees));
  }, []);

  useEffect(() => {
    loadConversations();

    // Real-time updates (Section 40): the server pushes an SSE event the
    // instant a webhook ingests a new message or creates a notification,
    // so the list refreshes immediately instead of waiting for a poll.
    const source = new EventSource("/api/realtime");
    source.onmessage = () => {
      loadConversations();
      setSelectedId((current) => {
        if (current) openConversation(current);
        return current;
      });
    };
    source.onerror = () => {
      // EventSource auto-reconnects on its own; nothing to do here.
    };

    // Slow polling fallback in case SSE is blocked by a proxy/network.
    const interval = setInterval(loadConversations, 20000);

    return () => {
      source.close();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadConversations]);

  // Deep-link support: /dashboard/inbox?conversation=<id>, used by the
  // Customer profile page's conversation history links (Section 13).
  useEffect(() => {
    const conversationId = searchParams.get("conversation");
    if (conversationId) {
      openConversation(conversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function openConversation(id: string) {
    setSelectedId(id);
    setLoading(true);
    setIntentResult(null);
    setIntentError(null);
    const res = await fetch(`/api/conversations/${id}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.conversation.messages);
      setHasMoreMessages(Boolean(data.conversation.hasMoreMessages));
      setDetail({
        aiMode: data.conversation.aiMode,
        pendingAiSuggestion: data.conversation.pendingAiSuggestion,
        notes: data.conversation.notes,
        tags: data.conversation.tags
      });
    }
    setLoading(false);
    loadConversations();
  }

  // Section 39 (Performance): the thread opens with only the most recent
  // page of messages; this lazy-loads one older page on demand instead of
  // ever fetching a conversation's entire history at once.
  async function loadOlderMessages() {
    if (!selectedId || messages.length === 0) return;
    setLoadingOlder(true);
    const oldestId = messages[0].id;
    const res = await fetch(`/api/conversations/${selectedId}/messages?before=${oldestId}`);
    if (res.ok) {
      const data = await res.json();
      setMessages((prev) => [...data.messages, ...prev]);
      setHasMoreMessages(Boolean(data.hasMore));
    }
    setLoadingOlder(false);
  }

  async function sendMessage() {
    if (!selectedId || !draft.trim()) return;
    const content = draft;
    setDraft("");
    const res = await fetch(`/api/conversations/${selectedId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
    if (res.ok) {
      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      if (!data.delivered) {
        alert("تم حفظ الرسالة لكن الإرسال الفعلي فشل: " + data.error);
      }
    }
  }

  async function updateStatus(status: string) {
    if (!selectedId) return;
    await fetch(`/api/conversations/${selectedId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    loadConversations();
  }

  async function updatePriority(priority: string) {
    if (!selectedId) return;
    await fetch(`/api/conversations/${selectedId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority })
    });
    loadConversations();
  }

  async function markUnread() {
    if (!selectedId) return;
    await fetch(`/api/conversations/${selectedId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unread: true })
    });
    loadConversations();
  }

  async function assignEmployee(employeeId: string | null) {
    if (!selectedId) return;
    await fetch(`/api/conversations/${selectedId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId })
    });
    loadConversations();
  }

  async function setAiMode(aiMode: string) {
    if (!selectedId) return;
    await fetch(`/api/conversations/${selectedId}/ai-mode`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiMode })
    });
    openConversation(selectedId);
  }

  async function analyzeIntent() {
    if (!selectedId) return;
    setIntentLoading(true);
    setIntentError(null);
    const res = await fetch("/api/ai/extract-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selectedId })
    });
    const data = await res.json();
    if (res.ok) {
      setIntentResult(data.result);
    } else {
      setIntentError(data.error ?? "فشل التحليل");
    }
    setIntentLoading(false);
  }

  async function resolveAiSuggestion(action: "approve" | "discard", editedContent?: string) {
    if (!selectedId) return;
    const res = await fetch(`/api/conversations/${selectedId}/ai-suggestion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, editedContent })
    });
    if (res.ok) openConversation(selectedId);
  }

  async function addNote() {
    if (!selectedId || !noteDraft.trim()) return;
    const res = await fetch(`/api/conversations/${selectedId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: noteDraft })
    });
    if (res.ok) {
      setNoteDraft("");
      openConversation(selectedId);
    }
  }

  async function addTag() {
    if (!selectedId || !tagDraft.trim()) return;
    const res = await fetch(`/api/conversations/${selectedId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tagDraft })
    });
    if (res.ok) {
      setTagDraft("");
      openConversation(selectedId);
      loadConversations();
    }
  }

  async function removeTag(tagId: string) {
    if (!selectedId) return;
    await fetch(`/api/conversations/${selectedId}/tags`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId })
    });
    openConversation(selectedId);
    loadConversations();
  }

  async function triggerMock(platform: string) {
    setMockLoading(true);
    await fetch("/api/mock/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, content: mockText.trim() || undefined, customerKey: "tester" })
    });
    setMockText("");
    await loadConversations();
    setMockLoading(false);
  }

  const selected = conversations.find((c) => c.id === selectedId);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-col gap-2 border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Inbox</h1>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <input
            value={mockText}
            onChange={(e) => setMockText(e.target.value)}
            placeholder='اكتب هنا رسالة العميل التجريبي، مثلاً: "عايز أعرف سعر التوصيل" — أو سيبه فاضي لرسالة عشوائية'
            className="w-full flex-1 rounded-md border border-[var(--border-strong)] bg-[var(--bg-app)] px-3 py-1.5 text-sm focus:border-[var(--accent)] focus:outline-none md:w-auto"
          />
          <div className="flex shrink-0 items-center gap-2 overflow-x-auto">
            <span className="shrink-0 text-xs text-[var(--text-muted)]">ابعتها كأنها جاية من:</span>
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => triggerMock(p)}
                disabled={mockLoading}
                className="shrink-0 rounded border border-[var(--border-strong)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list — full width on mobile, hidden once a conversation
            is open there (Section 38: a real mobile layout, not a shrunk desktop one) */}
        <div className={`${selectedId ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-e border-[var(--border)] bg-[var(--bg-surface)] md:w-72`}>
          <div className="space-y-2 border-b border-[var(--border)] p-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم، الهاتف، أو نص الرسالة..."
              className="w-full rounded-md border border-[var(--border-strong)] px-2 py-1.5 text-sm focus:outline-none"
            />
            <div className="flex gap-2">
              <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="flex-1 rounded-md border border-[var(--border-strong)] px-2 py-1 text-xs">
                <option value="">كل المنصات</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="flex-1 rounded-md border border-[var(--border-strong)] px-2 py-1 text-xs">
                <option value="">كل الحالات</option>
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 && (
              <p className="p-4 text-center text-sm text-[var(--text-muted)]">لا توجد محادثات بعد. جرّب زر Mock Mode بالأعلى.</p>
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c.id)}
                className={`block w-full border-b border-[var(--border)] p-3 text-start hover:bg-[var(--bg-muted)] ${selectedId === c.id ? "bg-[var(--bg-muted)]" : ""}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium">{c.customer.name ?? c.customer.phone ?? "عميل"}</span>
                  {c.unreadCount > 0 && (
                    <span className="rounded-full bg-[var(--accent)] px-1.5 text-[10px] text-white">{c.unreadCount}</span>
                  )}
                </div>
                <div className="mb-1 flex items-center gap-1.5">
                  <PlatformBadge platform={c.platform} />
                  {c.priority !== "NORMAL" && (
                    <span className={`rounded px-1.5 text-[10px] ${c.priority === "URGENT" ? "bg-red-100 text-red-700" : c.priority === "HIGH" ? "bg-orange-100 text-orange-700" : "bg-[var(--bg-muted)] text-[var(--text-muted)]"}`}>
                      {c.priority}
                    </span>
                  )}
                  {c.assignedEmployee && <span className="text-[10px] text-[var(--text-muted)]">→ {c.assignedEmployee.name}</span>}
                </div>
                <p className="truncate text-xs text-[var(--text-muted)]">{c.lastMessagePreview ?? "—"}</p>
                {c.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <span key={t.tag.id} className="rounded bg-[var(--bg-muted)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">{t.tag.name}</span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation thread — takes over the full screen on mobile once
            a conversation is selected, instead of squeezing next to the list */}
        <div className={`${selectedId ? "flex" : "hidden md:flex"} flex-1 flex-col bg-[var(--bg-muted)]`}>
          {!selected ? (
            <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-muted)]">اختر محادثة لعرضها</div>
          ) : (
            <>
              <div className="flex flex-col gap-2 border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedId(null)}
                    className="rounded border border-[var(--border-strong)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] md:hidden"
                    aria-label="رجوع لقائمة المحادثات"
                  >
                    ← رجوع
                  </button>
                  <div>
                    <div className="text-sm font-medium">{selected.customer.name ?? selected.customer.phone}</div>
                    <PlatformBadge platform={selected.platform} />
                  </div>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto text-xs">
                  {["open", "pending", "resolved", "archived"].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(s.toUpperCase())}
                      className={`shrink-0 rounded border px-2 py-1 ${selected.status.toLowerCase() === s ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border-strong)] text-[var(--text-secondary)]"}`}
                    >
                      {s}
                    </button>
                  ))}
                  <button onClick={markUnread} className="shrink-0 rounded border border-[var(--border-strong)] px-2 py-1 text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]">
                    تعليم كغير مقروءة
                  </button>
                  <button onClick={() => setShowDetails((s) => !s)} className="shrink-0 rounded border border-[var(--border-strong)] px-2 py-1 text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]">
                    {showDetails ? "إخفاء التفاصيل" : "التفاصيل"}
                  </button>
                </div>
              </div>

              <div className="flex flex-1 overflow-hidden">
                <div className="flex flex-1 flex-col">
                  <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {hasMoreMessages && (
                      <div className="text-center">
                        <button
                          onClick={loadOlderMessages}
                          disabled={loadingOlder}
                          className="rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] disabled:opacity-50"
                        >
                          {loadingOlder ? "جارِ التحميل..." : "تحميل رسائل أقدم"}
                        </button>
                      </div>
                    )}
                    {loading && <p className="text-center text-xs text-[var(--text-muted)]">جارِ التحميل...</p>}
                    {messages.map((m) => (
                      <div key={m.id} className={`flex ${m.direction === "OUTBOUND" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-md rounded-lg px-3 py-2 text-sm ${m.direction === "OUTBOUND" ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border)]"}`}>
                          {m.aiGenerated && <div className="mb-0.5 text-[10px] opacity-60">🤖 AI</div>}
                          {m.content}
                        </div>
                      </div>
                    ))}

                    {detail?.pendingAiSuggestion && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <div className="mb-1 text-xs font-medium text-blue-700">🤖 اقتراح AI (Hybrid Mode) بانتظار موافقتك:</div>
                        <p className="mb-2 text-sm text-[var(--text-primary)]">{detail.pendingAiSuggestion}</p>
                        <div className="flex gap-2">
                          <button onClick={() => resolveAiSuggestion("approve")} className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">
                            إرسال كما هو
                          </button>
                          <button onClick={() => setDraft(detail.pendingAiSuggestion ?? "")} className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700">
                            تعديل قبل الإرسال
                          </button>
                          <button onClick={() => resolveAiSuggestion("discard")} className="rounded border border-[var(--border-strong)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                            تجاهل
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 border-t border-[var(--border)] bg-[var(--bg-surface)] p-3">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="اكتب ردًا..."
                      className="flex-1 rounded-md border border-[var(--border-strong)] px-3 py-2 text-sm focus:outline-none"
                    />
                    <button onClick={sendMessage} className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm text-white hover:bg-[var(--accent-hover)]">
                      إرسال
                    </button>
                  </div>
                </div>

                {/* Details panel: assignment, priority, AI mode, tags, notes (Section 14/24) */}
                {showDetails && (
                  <div className="fixed inset-0 z-40 space-y-4 overflow-y-auto bg-[var(--bg-surface)] p-3 text-sm md:static md:z-auto md:w-72 md:shrink-0 md:border-s md:border-[var(--border)]">
                    <button
                      onClick={() => setShowDetails(false)}
                      className="mb-1 rounded border border-[var(--border-strong)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] md:hidden"
                    >
                      × إغلاق
                    </button>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">الموظف المسؤول</label>
                      <select
                        value={selected.assignedEmployee?.id ?? ""}
                        onChange={(e) => assignEmployee(e.target.value || null)}
                        className="w-full rounded-md border border-[var(--border-strong)] px-2 py-1.5 text-xs"
                      >
                        <option value="">غير معيّن</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">الأولوية</label>
                      <select
                        value={selected.priority}
                        onChange={(e) => updatePriority(e.target.value)}
                        className="w-full rounded-md border border-[var(--border-strong)] px-2 py-1.5 text-xs"
                      >
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">وضع AI (Section 24)</label>
                      <select
                        value={detail?.aiMode ?? "HUMAN"}
                        onChange={(e) => setAiMode(e.target.value)}
                        className="w-full rounded-md border border-[var(--border-strong)] px-2 py-1.5 text-xs"
                      >
                        <option value="HUMAN">Human — الموظف يرد</option>
                        <option value="AI">AI — رد تلقائي</option>
                        <option value="HYBRID">Hybrid — اقتراح يحتاج موافقة</option>
                      </select>
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-xs font-medium text-[var(--text-muted)]">تحليل نية العميل (Section 23)</label>
                        <button
                          onClick={analyzeIntent}
                          disabled={intentLoading}
                          className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                        >
                          {intentLoading ? "جارِ التحليل..." : "تحليل آخر رسالة"}
                        </button>
                      </div>
                      {intentError && <p className="text-xs text-red-500">{intentError}</p>}
                      {intentResult && (
                        <div className="rounded-md border border-[var(--border)] bg-[var(--bg-muted)] p-2 text-xs">
                          <div>
                            <span className="text-[var(--text-muted)]">Intent:</span> <span className="font-medium">{intentResult.intent}</span>
                          </div>
                          {intentResult.product && (
                            <div>
                              <span className="text-[var(--text-muted)]">Product:</span> {intentResult.product}
                            </div>
                          )}
                          {intentResult.questions.length > 0 && (
                            <div>
                              <span className="text-[var(--text-muted)]">Questions:</span> {intentResult.questions.join(" · ")}
                            </div>
                          )}
                          {!intentResult.confident && <div className="mt-1 text-amber-600">⚠ AI غير متأكد تمامًا</div>}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">Tags</label>
                      <div className="mb-2 flex flex-wrap gap-1">
                        {detail?.tags.map((t) => (
                          <span key={t.tag.id} className="flex items-center gap-1 rounded bg-[var(--bg-muted)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]">
                            {t.tag.name}
                            <button onClick={() => removeTag(t.tag.id)} className="text-[var(--text-muted)] hover:text-red-500">×</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <input
                          value={tagDraft}
                          onChange={(e) => setTagDraft(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addTag()}
                          placeholder="اسم Tag جديد"
                          className="flex-1 rounded-md border border-[var(--border-strong)] px-2 py-1 text-xs"
                        />
                        <button onClick={addTag} className="rounded bg-[var(--accent)] px-2 py-1 text-xs text-white">+</button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">ملاحظات داخلية</label>
                      <div className="mb-2 space-y-2">
                        {detail?.notes.map((n) => (
                          <div key={n.id} className="rounded border border-[var(--border)] bg-[var(--bg-muted)] p-2 text-xs">
                            <p className="text-[var(--text-primary)]">{n.content}</p>
                            <p className="mt-1 text-[10px] text-[var(--text-muted)]">{n.author.name} — {new Date(n.createdAt).toLocaleString("ar-EG")}</p>
                          </div>
                        ))}
                        {detail?.notes.length === 0 && <p className="text-xs text-[var(--text-muted)]">لا توجد ملاحظات.</p>}
                      </div>
                      <textarea
                        value={noteDraft}
                        onChange={(e) => setNoteDraft(e.target.value)}
                        placeholder="أضف ملاحظة داخلية (لا يراها العميل)..."
                        rows={2}
                        className="w-full rounded-md border border-[var(--border-strong)] px-2 py-1 text-xs"
                      />
                      <button onClick={addNote} className="mt-1 w-full rounded bg-[var(--accent)] px-2 py-1 text-xs text-white">إضافة ملاحظة</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
