"use client";

import { useEffect, useState } from "react";
import { MapPin, DollarSign, Users, Calendar, MessageCircle, Building2, Film } from "lucide-react";

interface Listing {
  id: string;
  name: string;
  type: string;
  city: string | null;
  capacity: number | null;
  dailyRate: number | null;
  company: { id: string; name: string | null; email: string | null } | null;
  _count: { bookings: number };
}

interface Booking {
  id: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  crewSize: number | null;
  createdAt: string;
  location: { id: string; name: string; type: string; city: string | null; dailyRate: number | null };
  requester: { id: string; name: string | null; email: string | null };
  owner: { id: string; name: string | null; email: string | null };
}

interface Data {
  listings: Listing[];
  bookings: Booking[];
  ownerCount: number;
}

export function AdminLocationsClient() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "listings" | "bookings">("overview");

  useEffect(() => {
    fetch("/api/admin/locations").then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading || !data) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const pending = data.bookings.filter((b) => b.status === "PENDING").length;
  const approved = data.bookings.filter((b) => b.status === "APPROVED").length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3">
          <MapPin className="w-8 h-8 text-orange-500" /> Location Repository
        </h1>
        <p className="text-slate-400">Overview of all location listings, bookings, and location owners</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Total Listings</p>
          <p className="text-2xl font-bold text-white">{data.listings.length}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Location Owners</p>
          <p className="text-2xl font-bold text-white">{data.ownerCount}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Total Bookings</p>
          <p className="text-2xl font-bold text-white">{data.bookings.length}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Pending / Approved</p>
          <p className="text-2xl font-bold text-white">{pending} / {approved}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(["overview", "listings", "bookings"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${tab === t ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Building2 className="w-5 h-5 text-orange-400" /> Recent Listings</h2>
            {data.listings.length === 0 ? <p className="text-slate-500 text-sm">No listings yet.</p> : (
              <ul className="space-y-2">
                {data.listings.slice(0, 8).map((l) => (
                  <li key={l.id} className="flex items-center justify-between text-sm">
                    <span className="text-white">{l.name}</span>
                    <span className="text-slate-500">{l.type} · {l.company?.name || "—"} · {l._count.bookings} bookings</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Calendar className="w-5 h-5 text-orange-400" /> Recent Bookings</h2>
            {data.bookings.length === 0 ? <p className="text-slate-500 text-sm">No bookings yet.</p> : (
              <ul className="space-y-2">
                {data.bookings.slice(0, 8).map((b) => (
                  <li key={b.id} className="flex items-center justify-between text-sm">
                    <span className="text-white">{b.location.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${b.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" : b.status === "APPROVED" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>{b.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "listings" && (
        <div className="space-y-3">
          {data.listings.map((l) => (
            <div key={l.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-white font-medium">{l.name}</h3>
                <p className="text-sm text-slate-400">{l.type}{l.city ? ` · ${l.city}` : ""} {l.capacity != null ? ` · Capacity ${l.capacity}` : ""} {l.dailyRate != null ? ` · $${l.dailyRate}/day` : ""}</p>
                <p className="text-xs text-slate-500 mt-1">Owner: {l.company?.name || "—"} ({l.company?.email}) · {l._count.bookings} bookings</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "bookings" && (
        <div className="space-y-3">
          {data.bookings.map((b) => (
            <div key={b.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-white font-medium">{b.location.name} — {b.location.type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" : b.status === "APPROVED" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>{b.status}</span>
                </div>
                <p className="text-sm text-slate-400">Requester: {b.requester.name || b.requester.email} · Owner: {b.owner.name || b.owner.email}</p>
                {b.startDate && <p className="text-xs text-slate-500 mt-1">{b.startDate} — {b.endDate || "TBD"}{b.crewSize != null ? ` · Crew: ${b.crewSize}` : ""}</p>}
                <p className="text-xs text-slate-500">{new Date(b.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
