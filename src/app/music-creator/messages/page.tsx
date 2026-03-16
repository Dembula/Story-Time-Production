"use client";

import { Suspense } from "react";
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { MessageSquare, Send, Music, Film, Clock } from "lucide-react";

interface SyncRequest {
  id: string; status: string; note: string | null; projectName: string | null;
  createdAt: string;
  track: { title: string };
  requester: { id: string; name: string | null; email: string | null };
  musicCreator: { id: string; name: string | null };
  _count: { messages: number };
}

interface Msg {
  id: string; body: string; createdAt: string;
  sender: { id: string; name: string | null };
  receiver: { id: string; name: string | null };
}

function MessagesContent() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("syncRequestId");
  const [requests, setRequests] = useState<SyncRequest[]>([]);
  const [active, setActive] = useState<string | null>(initialId);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/sync-requests").then((r) => r.json()).then((data) => {
      setRequests(data);
      if (!active && data.length > 0) setActive(data[0].id);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!active) return;
    fetch(`/api/music-messages?syncRequestId=${active}`).then((r) => r.json()).then(setMessages);
  }, [active]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendMessage() {
    if (!newMsg.trim() || !active) return;
    const req = requests.find((r) => r.id === active);
    if (!req) return;
    setSending(true);
    const res = await fetch("/api/music-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newMsg, receiverId: req.requester.id, syncRequestId: active }),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages((prev) => [...prev, { ...msg, sender: msg.sender, receiver: { id: req.requester.id, name: req.requester.name } }]);
      setNewMsg("");
    }
    setSending(false);
  }

  const activeReq = requests.find((r) => r.id === active);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3"><MessageSquare className="w-8 h-8 text-cyan-500" /> Messages</h1>
        <p className="text-slate-400">Communicate with film creators about sync requests and future collaborations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: "60vh" }}>
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700/50"><h3 className="text-white font-medium text-sm">Conversations ({requests.length})</h3></div>
          <div className="divide-y divide-slate-700/30 max-h-[60vh] overflow-y-auto">
            {requests.map((r) => (
              <button key={r.id} onClick={() => setActive(r.id)} className={`w-full text-left p-4 hover:bg-slate-800/40 transition ${active === r.id ? "bg-slate-800/50 border-l-2 border-l-pink-500" : ""}`}>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-white text-sm font-medium truncate">{r.requester.name || r.requester.email}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" : r.status === "APPROVED" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>{r.status}</span>
                </div>
                <p className="text-xs text-slate-500 truncate"><Music className="w-3 h-3 inline" /> {r.track.title}</p>
                {r.projectName && <p className="text-xs text-slate-500 truncate"><Film className="w-3 h-3 inline" /> {r.projectName}</p>}
              </button>
            ))}
            {requests.length === 0 && <p className="p-4 text-sm text-slate-500">No conversations yet.</p>}
          </div>
        </div>

        <div className="lg:col-span-2 bg-slate-800/30 border border-slate-700/50 rounded-xl flex flex-col overflow-hidden">
          {activeReq ? (
            <>
              <div className="p-4 border-b border-slate-700/50 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center text-white text-xs font-bold">
                  {(activeReq.requester.name || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{activeReq.requester.name}</p>
                  <p className="text-xs text-slate-500">{activeReq.track.title} · {activeReq.projectName || "No project"}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {messages.map((m) => {
                  const isMine = m.sender.id !== activeReq.requester.id;
                  return (
                    <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[70%] p-3 rounded-xl ${isMine ? "bg-pink-500/20 text-pink-100" : "bg-slate-700/50 text-slate-300"}`}>
                        <p className="text-sm">{m.body}</p>
                        <p className="text-[10px] text-slate-500 mt-1">{new Date(m.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEnd} />
              </div>

              <div className="p-4 border-t border-slate-700/50">
                <div className="flex gap-2">
                  <input value={newMsg} onChange={(e) => setNewMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} placeholder="Type a message..." className="flex-1 px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500" />
                  <button onClick={sendMessage} disabled={sending || !newMsg.trim()} className="px-4 py-2.5 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition disabled:opacity-50"><Send className="w-4 h-4" /></button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center"><p className="text-slate-500 text-sm">Select a conversation</p></div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MusicMessagesPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" /></div>}><MessagesContent /></Suspense>;
}
