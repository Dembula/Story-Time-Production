"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Send, MessageCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Msg {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string | null; role: string };
}

interface Request {
  id: string;
  status: string;
  note: string | null;
  equipment: { companyName: string; category: string };
  requester: { id: string; name: string | null; email: string | null };
  _count: { messages: number };
}

export default function EquipmentMessagesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <MessagesContent />
    </Suspense>
  );
}

function MessagesContent() {
  const params = useSearchParams();
  const requestId = params.get("requestId");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [activeReqId, setActiveReqId] = useState<string | null>(requestId);
  const [newMsg, setNewMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/equipment-requests").then((r) => r.json()).then((reqs) => {
      setRequests(reqs);
      if (!activeReqId && reqs.length > 0) setActiveReqId(reqs[0].id);
      setLoading(false);
    });
  }, [activeReqId]);

  useEffect(() => {
    if (!activeReqId) return;
    fetch(`/api/messages?requestId=${activeReqId}`).then((r) => r.json()).then(setMessages);
  }, [activeReqId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeReq = requests.find((r) => r.id === activeReqId);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMsg.trim() || !activeReq) return;

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: newMsg,
        receiverId: activeReq.requester.id,
        requestId: activeReqId,
      }),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      setNewMsg("");
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <main className="max-w-7xl mx-auto px-6 md:px-12 py-10">
      <div className="mb-6">
        <Link href="/equipment-company/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-4 transition">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-white">Messages</h1>
        <p className="text-slate-400 text-sm">Communicate with film creators about equipment requests</p>
      </div>

      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-280px)]">
        <div className="col-span-4 bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-y-auto">
          <div className="p-4 border-b border-slate-700/50">
            <h2 className="text-sm font-medium text-slate-300">Request Threads</h2>
          </div>
          {requests.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">No request threads yet</div>
          ) : (
            requests.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveReqId(r.id)}
                className={`w-full text-left p-4 border-b border-slate-700/30 transition ${
                  activeReqId === r.id ? "bg-orange-500/10 border-l-2 border-l-orange-500" : "hover:bg-slate-700/30"
                }`}
              >
                <p className="text-white text-sm font-medium truncate">{r.equipment.category} — {r.equipment.companyName}</p>
                <p className="text-xs text-slate-400">{r.requester.name || r.requester.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    r.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" :
                    r.status === "APPROVED" ? "bg-green-500/10 text-green-400" :
                    "bg-red-500/10 text-red-400"
                  }`}>{r.status}</span>
                  <span className="text-xs text-slate-500">{r._count.messages} msgs</span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="col-span-8 bg-slate-800/50 border border-slate-700/50 rounded-xl flex flex-col">
          {activeReq ? (
            <>
              <div className="p-4 border-b border-slate-700/50">
                <p className="text-white font-medium">{activeReq.equipment.category} — {activeReq.equipment.companyName}</p>
                <p className="text-xs text-slate-400">with {activeReq.requester.name || activeReq.requester.email}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center text-slate-500 text-sm py-10">
                    <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No messages yet. Start the conversation.
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender.role === "EQUIPMENT_COMPANY" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-xl px-4 py-2.5 ${
                      m.sender.role === "EQUIPMENT_COMPANY"
                        ? "bg-orange-500/20 text-orange-100"
                        : "bg-slate-700/50 text-slate-200"
                    }`}>
                      <p className="text-xs font-medium mb-1 opacity-70">{m.sender.name || "Unknown"}</p>
                      <p className="text-sm">{m.body}</p>
                      <p className="text-xs opacity-50 mt-1">{new Date(m.createdAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={sendMessage} className="p-4 border-t border-slate-700/50 flex gap-3">
                <input
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm"
                />
                <button type="submit" className="px-4 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex items-center justify-center flex-1 text-slate-500 text-sm">
              Select a request thread to view messages
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
