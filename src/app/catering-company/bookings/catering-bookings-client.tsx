"use client";

import { useEffect, useState } from "react";
import { Calendar, User } from "lucide-react";

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

  useEffect(() => {
    fetch("/api/catering-bookings").then((r) => r.json()).then((b) => setBookings(Array.isArray(b) ? b : [])).finally(() => setLoading(false));
  }, []);

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
                <span className={`px-2 py-1 rounded text-xs font-medium ${b.status === "PENDING" ? "bg-amber-500/20 text-amber-400" : "bg-slate-600/50 text-slate-400"}`}>{b.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
