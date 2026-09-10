"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";

type Thread = {
  id: string;
  subject?: string | null;
  kind?: string;
  department?: string | null;
  updatedAt: string;
  unreadCount?: number;
  messageCount?: number;
  lastMessagePreview?: string | null;
};

type Message = {
  id: string;
  threadId?: string;
  body?: string;
  plaintext?: string;
  sender?: { id: string; name: string | null; email: string | null };
  priority?: string;
  createdAt: string;
};

type CommsResponse = {
  threads?: Thread[];
  messages?: Message[];
  error?: string;
};

export default function ExecutiveCommsPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [threadForm, setThreadForm] = useState({ subject: "", kind: "GROUP" });
  const [messageBody, setMessageBody] = useState("");

  async function loadThreads() {
    const r = await fetch("/api/executive/comms");
    const data = (await r.json()) as CommsResponse;
    if (!r.ok) throw new Error(data.error ?? "Failed to load comms");
    setThreads(data.threads ?? []);
    return data.threads ?? [];
  }

  async function loadMessages(threadId: string) {
    const r = await fetch(`/api/executive/comms?threadId=${encodeURIComponent(threadId)}`);
    const data = (await r.json()) as CommsResponse;
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
    if (!threadForm.subject.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/executive/comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_thread",
          subject: threadForm.subject.trim(),
          kind: threadForm.kind,
        }),
      });
      const data = (await r.json()) as { thread?: Thread; error?: string };
      if (!r.ok) throw new Error(data.error ?? "Failed to create thread");
      setThreadForm({ subject: "", kind: "GROUP" });
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-white md:text-3xl">
          <MessageSquare className="h-6 w-6 text-orange-400" />
          Executive comms
        </h1>
        <p className="mt-1 text-sm text-slate-400">Secure leadership threads and briefings.</p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}

      <form
        onSubmit={(e) => void handleCreateThread(e)}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-white/8 bg-slate-900/40 p-4"
      >
        <label className="min-w-[200px] flex-1">
          <span className="mb-1 block text-xs text-slate-500">New thread subject</span>
          <input
            value={threadForm.subject}
            onChange={(e) => setThreadForm((f) => ({ ...f, subject: e.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-orange-500/40"
            placeholder="Weekly ops sync"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm text-orange-200 transition disabled:opacity-50 [@media(hover:hover)]:bg-orange-500/20"
        >
          Create thread
        </button>
      </form>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-xl border border-white/8 bg-slate-900/40 p-3">
          <p className="mb-2 px-2 text-xs uppercase tracking-wider text-slate-500">Threads</p>
          {threads.length === 0 ? (
            <p className="px-2 text-sm text-slate-500">No threads yet.</p>
          ) : (
            <ul className="space-y-1">
              {threads.map((thread) => {
                const active = thread.id === selectedThreadId;
                return (
                  <li key={thread.id}>
                    <button
                      type="button"
                      onClick={() => void selectThread(thread.id)}
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                        active
                          ? "bg-orange-500/15 text-orange-100"
                          : "text-slate-300 [@media(hover:hover)]:bg-white/5"
                      }`}
                    >
                      <span className="block truncate font-medium">{thread.subject ?? "Untitled thread"}</span>
                      <span className="mt-0.5 block text-[10px] text-slate-500">
                        {new Date(thread.updatedAt).toLocaleString("en-ZA")}
                        {thread.messageCount != null ? ` · ${thread.messageCount} messages` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="flex min-h-[360px] flex-col rounded-xl border border-white/8 bg-slate-900/40">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {selectedThreadId && messages.length === 0 ? (
              <p className="text-sm text-slate-500">No messages in this thread yet.</p>
            ) : null}
            {messages.map((msg) => (
              <div key={msg.id} className="rounded-lg border border-white/6 bg-slate-950/50 p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-300">
                    {msg.sender?.name ?? msg.sender?.email ?? "Executive"}
                  </span>
                  <span>{new Date(msg.createdAt).toLocaleString("en-ZA")}</span>
                  {msg.priority && msg.priority !== "NORMAL" ? (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">{msg.priority}</span>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-200">{msg.body ?? msg.plaintext ?? "—"}</p>
              </div>
            ))}
          </div>
          {selectedThreadId ? (
            <form
              onSubmit={(e) => void handleSendMessage(e)}
              className="flex gap-2 border-t border-white/8 p-4"
            >
              <input
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Write a message…"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-orange-500/40"
              />
              <button
                type="submit"
                disabled={submitting || !messageBody.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500/90 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            </form>
          ) : (
            <p className="border-t border-white/8 p-4 text-sm text-slate-500">Select a thread to view messages.</p>
          )}
        </section>
      </div>
    </div>
  );
}
