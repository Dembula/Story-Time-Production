"use client";

import { useEffect, useState } from "react";
import { Clock, CheckCircle, XCircle, MessageCircle, MapPin, Calendar, Users } from "lucide-react";
import Link from "next/link";

interface LocationBooking {
  id: string;
  status: string;
  note: string | null;
  shootType: string | null;
  startDate: string | null;
  endDate: string | null;
  crewSize: number | null;
  createdAt: string;
  location: { id: string; name: string; type: string; city: string | null; dailyRate: number | null };
  requester: { id: string; name: string | null; email: string | null };
  _count: { messages: number };
}

export default function LocationBookingsPage() {
  const [bookings, setBookings] = useState<LocationBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    fetch("/api/location-bookings").then((r) => r.json()).then(setBookings).finally(() => setLoading(false));
  }, []);

  async function handleStatus(id: string, status: string) {
    await fetch("/api/location-bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  }

  const filtered = filter === "ALL" ? bookings : bookings.filter((b) => b.status === filter);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <main className="max-w-7xl mx-auto px-6 md:px-12 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Booking Requests</h1>
        <p className="text-slate-400 text-sm">{bookings.length} total requests from film creators</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["ALL", "PENDING", "APPROVED", "DECLINED", "CANCELLED"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === s ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 border border-slate-700/50"
            }`}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()} ({s === "ALL" ? bookings.length : bookings.filter((b) => b.status === s).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-10 text-center">
          <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No bookings found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <div key={b.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-white font-medium">{b.location.name} — {b.location.type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      b.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" :
                      b.status === "APPROVED" ? "bg-green-500/10 text-green-400" :
                      b.status === "CANCELLED" ? "bg-slate-500/10 text-slate-400" :
                      "bg-red-500/10 text-red-400"
                    }`}>{b.status}</span>
                  </div>
                  <p className="text-sm text-slate-400">
                    From: <span className="text-orange-400">{b.requester.name || b.requester.email}</span>
                    {b.shootType && <span className="text-slate-500"> · Shoot: {b.shootType}</span>}
                  </p>
                  {b.note && <p className="text-sm text-slate-500 mt-1 italic">&quot;{b.note}&quot;</p>}
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
                    {b.startDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {b.startDate} — {b.endDate || "TBD"}</span>}
                    {b.crewSize != null && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Crew: {b.crewSize}</span>}
                    {b.location.dailyRate != null && <span>Rate: ${b.location.dailyRate}/day</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {b._count.messages} messages · {new Date(b.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {b.status === "PENDING" && (
                    <>
                      <button onClick={() => handleStatus(b.id, "APPROVED")} className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleStatus(b.id, "DECLINED")} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <Link href={`/location-owner/messages?bookingId=${b.id}`} className="p-2 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition">
                    <MessageCircle className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
