"use client";

import { useEffect, useState } from "react";
import { Calendar, User, CheckCircle, XCircle } from "lucide-react";

type Booking = {
  id: string;
  eventDate: string | null;
  headCount: number | null;
  status: string;
  note: string | null;
  creator: { name: string | null; email: string | null };
};

export function CateringBookingsClient() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/catering-bookings").then((r) => r.json()).then((b) => setBookings(Array.isArray(b) ? b : [])).finally(() => setLoading(false));
  }, []);

  async function handleStatus(id: string, status: string) {
    setUpdating(id);
    const res = await fetch("/api/catering-bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    setUpdating(null);
  }

  if (loading) return <div className="p-8 flex justify-center"><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold text-white mb-8">Bookings</h1>
      {bookings.length === 0 ? (
        <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-12 text-center text-slate-500">No bookings yet.</div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => (
            <div key={b.id} className="rounded-xl bg-slate-800/30 border border-slate-700/50 p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <p className="font-medium text-white flex items-center gap-2"><User className="w-4 h-4 text-slate-400" /> {b.creator.name || b.creator.email || "—"}</p>
                  <p className="text-sm text-slate-400 flex items-center gap-2"><Calendar className="w-3 h-3" /> {b.eventDate ? new Date(b.eventDate).toLocaleDateString() : "—"} {b.headCount ? ` · ${b.headCount} people` : ""}</p>
                  {b.note && <p className="text-sm text-slate-500 mt-1">{b.note}</p>}
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${b.status === "PENDING" ? "bg-amber-500/20 text-amber-400" : b.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-600/50 text-slate-400"}`}>{b.status}</span>
                {b.status === "PENDING" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleStatus(b.id, "APPROVED")}
                      disabled={updating === b.id}
                      className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50"
                      title="Approve"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatus(b.id, "DECLINED")}
                      disabled={updating === b.id}
                      className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                      title="Decline"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
