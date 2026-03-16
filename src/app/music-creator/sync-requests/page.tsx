"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Music, CheckCircle, XCircle, Clock, MessageSquare, Film, DollarSign,
  Users, ChevronDown, ChevronUp, Send,
} from "lucide-react";

interface SyncRequest {
  id: string; status: string; note: string | null; projectName: string | null;
  projectType: string | null; usageType: string | null; budget: number | null;
  createdAt: string;
  track: { id: string; title: string; artistName: string; genre: string | null; coverUrl: string | null };
  requester: { id: string; name: string | null; email: string | null };
  musicCreator: { id: string; name: string | null };
  _count: { messages: number };
}

export default function SyncRequestsPage() {
  const [requests, setRequests] = useState<SyncRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sync-requests").then((r) => r.json()).then(setRequests).finally(() => setLoading(false));
  }, []);

  async function handleAction(id: string, status: string) {
    setActionLoading(id);
    const res = await fetch("/api/sync-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: id, status }),
    });
    if (res.ok) setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    setActionLoading(null);
  }

  const filtered = requests.filter((r) => filter === "ALL" || r.status === filter);
  const pending = requests.filter((r) => r.status === "PENDING").length;
  const approved = requests.filter((r) => r.status === "APPROVED").length;
  const totalBudget = requests.filter((r) => r.status === "PENDING").reduce((s, r) => s + (r.budget || 0), 0);

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3"><Users className="w-8 h-8 text-pink-500" /> Sync Requests</h1>
        <p className="text-slate-400">Film creators who want to use your music. Review, approve, or decline their requests.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4"><p className="text-xs text-slate-400">Total Requests</p><p className="text-2xl font-bold text-white">{requests.length}</p></div>
        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4"><p className="text-xs text-yellow-400">Pending</p><p className="text-2xl font-bold text-yellow-400">{pending}</p></div>
        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4"><p className="text-xs text-green-400">Approved</p><p className="text-2xl font-bold text-green-400">{approved}</p></div>
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4"><p className="text-xs text-orange-400">Potential Revenue</p><p className="text-2xl font-bold text-orange-400">${totalBudget.toFixed(0)}</p></div>
      </div>

      <div className="flex gap-2">
        {["ALL", "PENDING", "APPROVED", "DECLINED"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 rounded-lg text-xs font-medium transition ${filter === f ? "bg-pink-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>{f === "ALL" ? `All (${requests.length})` : `${f} (${requests.filter((r) => r.status === f).length})`}</button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((r) => (
          <div key={r.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="p-5 cursor-pointer hover:bg-slate-800/70 transition" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
              <div className="flex items-center gap-4">
                {r.track.coverUrl && <img src={r.track.coverUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-medium">{r.requester.name || r.requester.email}</p>
                    <span className="text-xs text-slate-500">wants to use</span>
                    <p className="text-pink-400 font-medium">&quot;{r.track.title}&quot;</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" : r.status === "APPROVED" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>{r.status}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    {r.projectName && <span><Film className="w-3 h-3 inline" /> {r.projectName}</span>}
                    {r.projectType && <span>· {r.projectType}</span>}
                    {r.budget && <span>· Budget: ${r.budget}</span>}
                    <span>· {new Date(r.createdAt).toLocaleDateString()}</span>
                    {r._count.messages > 0 && <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {r._count.messages} messages</span>}
                  </div>
                </div>
                {expanded === r.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>

            {expanded === r.id && (
              <div className="border-t border-slate-700/50 p-5 bg-slate-900/30 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white">Request Details</h4>
                    <div className="text-sm space-y-1">
                      <p><span className="text-slate-500">Creator:</span> <span className="text-slate-300">{r.requester.name} ({r.requester.email})</span></p>
                      <p><span className="text-slate-500">Project:</span> <span className="text-slate-300">{r.projectName || "—"}</span></p>
                      <p><span className="text-slate-500">Type:</span> <span className="text-slate-300">{r.projectType || "—"}</span></p>
                      <p><span className="text-slate-500">Usage:</span> <span className="text-slate-300">{r.usageType || "—"}</span></p>
                      <p><span className="text-slate-500">Budget:</span> <span className="text-orange-400 font-medium">{r.budget ? `$${r.budget}` : "Not specified"}</span></p>
                    </div>
                    {r.note && <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30"><p className="text-xs text-slate-500 mb-1">Message from creator:</p><p className="text-sm text-slate-300">{r.note}</p></div>}
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-white">Track</h4>
                    <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/30 flex items-center gap-3">
                      {r.track.coverUrl && <img src={r.track.coverUrl} alt="" className="w-10 h-10 rounded object-cover" />}
                      <div><p className="text-white text-sm font-medium">{r.track.title}</p><p className="text-xs text-slate-500">{r.track.artistName} · {r.track.genre}</p></div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  {r.status === "PENDING" && (
                    <>
                      <button onClick={() => handleAction(r.id, "APPROVED")} disabled={actionLoading === r.id} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 transition text-sm disabled:opacity-50"><CheckCircle className="w-3.5 h-3.5" /> Approve</button>
                      <button onClick={() => handleAction(r.id, "DECLINED")} disabled={actionLoading === r.id} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition text-sm disabled:opacity-50"><XCircle className="w-3.5 h-3.5" /> Decline</button>
                    </>
                  )}
                  <Link href={`/music-creator/messages?syncRequestId=${r.id}`} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition text-sm">
                    <MessageSquare className="w-3.5 h-3.5" /> Message Creator
                  </Link>
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-10 text-center"><Music className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-slate-400">No sync requests found.</p></div>}
      </div>
    </div>
  );
}
