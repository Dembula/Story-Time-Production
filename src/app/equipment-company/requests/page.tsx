"use client";

import { useEffect, useState } from "react";
import { Clock, CheckCircle, XCircle, MessageCircle, Package } from "lucide-react";

interface EquipmentRequest {
  id: string;
  status: string;
  note: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  equipment: { companyName: string; category: string; description: string | null };
  requester: { id: string; name: string | null; email: string | null };
  _count: { messages: number };
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<EquipmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    fetch("/api/equipment-requests").then((r) => r.json()).then(setRequests).finally(() => setLoading(false));
  }, []);

  async function handleStatus(id: string, status: string) {
    await fetch("/api/equipment-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  const filtered = filter === "ALL" ? requests : requests.filter((r) => r.status === filter);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <main className="max-w-7xl mx-auto px-6 md:px-12 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Equipment Requests</h1>
        <p className="text-slate-400 text-sm">{requests.length} total requests from film creators</p>
      </div>

      <div className="flex gap-2">
        {["ALL", "PENDING", "APPROVED", "DECLINED"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === s ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 border border-slate-700/50"
            }`}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()} ({s === "ALL" ? requests.length : requests.filter((r) => r.status === s).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-10 text-center">
          <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No requests found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-white font-medium">{r.equipment.companyName} — {r.equipment.category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" :
                      r.status === "APPROVED" ? "bg-green-500/10 text-green-400" :
                      "bg-red-500/10 text-red-400"
                    }`}>{r.status}</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    From: <span className="text-orange-400">{r.requester.name || r.requester.email}</span>
                  </p>
                  {r.note && <p className="text-sm text-slate-500 mt-1 italic">&quot;{r.note}&quot;</p>}
                  {r.startDate && <p className="text-xs text-slate-500 mt-1">Dates: {r.startDate} — {r.endDate || "TBD"}</p>}
                  <p className="text-xs text-slate-500 mt-1">
                    {r._count.messages} messages &middot; {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.status === "PENDING" && (
                    <>
                      <button onClick={() => handleStatus(r.id, "APPROVED")} className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleStatus(r.id, "DECLINED")} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <a href={`/equipment-company/messages?requestId=${r.id}`} className="p-2 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition">
                    <MessageCircle className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
