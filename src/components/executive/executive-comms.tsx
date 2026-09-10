"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Plus, Send } from "lucide-react";
import { StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";

type Thread = {
  id: string;
  subject?: string | null;
  kind?: string;
  updatedAt: string;
  messageCount?: number;
  lastMessagePreview?: string | null;
};

type Message = {
  id: string;
  body?: string;
  plaintext?: string;
  sender?: { id: string; name: string | null; email: string | null };
  priority?: string;
  createdAt: string;
};

export function ExecutiveComms() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [threadSubject, setThreadSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");

  async function loadThreads() {
    const r = await fetch("/api/executive/comms");
    const data = (await r.json()) as { threads?: Thread[]; error?: string };
    if (!r.ok) throw new Error(data.error ?? "Failed to load comms");
    setThreads(data.threads ?? []);
    return data.threads ?? [];
  }

  async function loadMessages(threadId: string) {
    const r = await fetch(`/api/executive/comms?threadId=${encodeURIComponent(threadId)}`);
    const data = (await r.json()) as { messages?: Message[]; error?: string };
    if (!r.ok) throw new Error(data.error ?? "Failed to load messages");
    setMessages(data.messages ?? []);
  }

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const list = await loadThreads();
        setError(null);
        if (list[0]?.id) {
          setSelectedThreadId(list[0].id);
          await loadMessages(list[0].id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load comms");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function selectThread(threadId: string) {
    setSelectedThreadId(threadId);
    try {
      await loadMessages(threadId);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messages");
    }
  }

  async function handleCreateThread(e: React.FormEvent) {
    e.preventDefault();
    if (!threadSubject.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/executive/comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_thread",
          subject: threadSubject.trim(),
          kind: "GROUP",
        }),
      });
      const data = (await r.json()) as { thread?: Thread; error?: string };
      if (!r.ok) throw new Error(data.error ?? "Failed to create thread");
      setThreadSubject("");
      setComposerOpen(false);
      const list = await loadThreads();
      const newId = data.thread?.id ?? list[0]?.id;
      if (newId) {
        setSelectedThreadId(newId);
        await loadMessages(newId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create thread");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedThreadId || !messageBody.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/executive/comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_message",
          threadId: selectedThreadId,
          body: messageBody.trim(),
        }),
      });
      const data = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(data.error ?? "Failed to send message");
      setMessageBody("");
      await loadMessages(selectedThreadId);
      await loadThreads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <StoryTimeLoadingCenter />;

  const active = threads.find((t) => t.id === selectedThreadId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300/80">
            Executive suite
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-white">
            Leadership comms
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Encrypted C-suite threads for decisions, briefings, and cross-office coordination.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setComposerOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-orange-400"
        >
          <Plus className="h-4 w-4" />
          New thread
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {composerOpen ? (
        <form
          onSubmit={(e) => void handleCreateThread(e)}
          className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.06] p-4"
        >
          <label className="block">
            <span className="mb-1 block text-xs text-orange-200/80">Thread subject</span>
            <input
              value={threadSubject}
              onChange={(e) => setThreadSubject(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500/40"
              placeholder="e.g. Content freeze for festival week"
              autoFocus
            />
          </label>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !threadSubject.trim()}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid min-h-[520px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40 shadow-[0_20px_60px_rgba(0,0,0,0.3)] lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="border-b border-white/8 bg-slate-900/40 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
            <MessageSquare className="h-4 w-4 text-orange-300" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Inbox</p>
          </div>
          {threads.length === 0 ? (
            <p className="px-4 py-8 text-sm text-slate-500">No threads yet — start one above.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto p-2">
              {threads.map((thread) => {
                const isActive = thread.id === selectedThreadId;
                return (
                  <li key={thread.id}>
                    <button
                      type="button"
                      onClick={() => void selectThread(thread.id)}
                      className={`mb-1 w-full rounded-xl px-3 py-3 text-left transition ${
                        isActive
                          ? "bg-orange-500/15 ring-1 ring-orange-500/30"
                          : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="block truncate text-sm font-medium text-white">
                        {thread.subject ?? "Untitled thread"}
                      </span>
                      <span className="mt-1 block truncate text-xs text-slate-500">
                        {thread.lastMessagePreview ||
                          new Date(thread.updatedAt).toLocaleString("en-ZA")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="flex min-h-[420px] flex-col">
          <div className="border-b border-white/8 px-5 py-4">
            <h2 className="font-display text-lg text-white">
              {active?.subject ?? "Select a thread"}
            </h2>
            {active ? (
              <p className="mt-1 text-xs text-slate-500">
                Updated {new Date(active.updatedAt).toLocaleString("en-ZA")}
                {active.messageCount != null ? ` · ${active.messageCount} messages` : ""}
              </p>
            ) : null}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {selectedThreadId && messages.length === 0 ? (
              <p className="text-sm text-slate-500">No messages yet — send the first note.</p>
            ) : null}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="rounded-2xl border border-white/8 bg-gradient-to-br from-slate-900/80 to-slate-950/90 px-4 py-3"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-orange-100/90">
                    {msg.sender?.name ?? msg.sender?.email ?? "Executive"}
                  </span>
                  <span>{new Date(msg.createdAt).toLocaleString("en-ZA")}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                  {msg.body ?? msg.plaintext ?? "—"}
                </p>
              </div>
            ))}
          </div>

          {selectedThreadId ? (
            <form
              onSubmit={(e) => void handleSendMessage(e)}
              className="flex gap-2 border-t border-white/8 bg-slate-950/50 p-4"
            >
              <input
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Write to the executive thread…"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none focus:border-orange-500/40"
              />
              <button
                type="submit"
                disabled={submitting || !messageBody.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            </form>
          ) : null}
        </section>
      </div>
    </div>
  );
}
