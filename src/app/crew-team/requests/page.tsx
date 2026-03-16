"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Send, ArrowLeft, Check, X } from "lucide-react";

type RequestRow = { id: string; projectName: string | null; message: string | null; status: string; createdAt: string; creator: { id: string; name: string | null; email: string | null } };

export default function CrewTeamRequestsPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/crew-team/requests").then((r) => r.json()).then((arr) => { setRequests(Array.isArray(arr) ? arr : []); setLoading(false); });
  }, []);

  async function updateStatus(requestId: string, status: string) {
    setUpdating(requestId);
    const res = await fetch("/api/crew-team/requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, status }) });
    if (res.ok) setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status } : r)));
    setUpdating(null);
  }

  if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/crew-team/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6"><ArrowLeft className="w-4 h-4" /> Back</Link>
      <h1 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2"><Send className="w-7 h-7 text-orange-500" /> Requests from creators</h1>
      {requests.length === 0 ? <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-8 text-center text-slate-500">No requests yet.</div> : (
        <div className="space-y-4">
          {requests.map((r) => (
            <div key={r.id} className="p-5 rounded-2xl bg-slate-800/30 border border-slate-700/50">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <p className="font-semibold text-white">{r.projectName || "Project"}</p>
                  <p className="text-sm text-slate-400">{r.creator?.name || r.creator?.email}</p>
                  {r.message && <p className="text-sm text-slate-500 mt-2">{r.message}</p>}
                  <p className="text-xs text-slate-600 mt-2">{new Date(r.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${r.status === "PENDING" ? "bg-amber-500/20 text-amber-400" : r.status === "ACCEPTED" ? "bg-green-500/20 text-green-400" : "bg-slate-700 text-slate-400"}`}>{r.status}</span>
                  {r.status === "PENDING" && (
                    <>
                      <button onClick={() => updateStatus(r.id, "ACCEPTED")} disabled={updating === r.id} className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50"><Check className="w-4 h-4" /></button>
                      <button onClick={() => updateStatus(r.id, "DECLINED")} disabled={updating === r.id} className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"><X className="w-4 h-4" /></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
