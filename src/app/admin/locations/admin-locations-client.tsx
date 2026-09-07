"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Calendar, Building2, Search, ExternalLink } from "lucide-react";
import { StoryTimeLoader } from "@/components/ui/storytime-loader";

interface Listing {
  id: string;
  name: string;
  type: string;
  city: string | null;
  capacity: number | null;
  dailyRate: number | null;
  company: { id: string; name: string | null; email: string | null } | null;
  companyId?: string | null;
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

interface OwnerSummary {
  id: string;
  name: string | null;
  email: string | null;
  listingCount: number;
  bookingCount: number;
  lastActivityAt: string | null;
}

interface Data {
  listings: Listing[];
  bookings: Booking[];
  ownerCount: number;
  owners?: OwnerSummary[];
}

export function AdminLocationsClient() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "owners" | "listings" | "bookings">("overview");
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/admin/locations").then((r) => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  const owners = useMemo(() => {
    const list = data?.owners || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (o) =>
        (o.name || "").toLowerCase().includes(needle) ||
        (o.email || "").toLowerCase().includes(needle),
    );
  }, [data, q]);

  if (loading || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <StoryTimeLoader size="sm" hideTrack />
      </div>
    );
  }

  const pending = data.bookings.filter((b) => b.status === "PENDING").length;
  const approved = data.bookings.filter((b) => b.status === "APPROVED").length;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-8">
      <div>
        <h1 className="mb-2 flex items-center gap-3 text-3xl font-semibold text-white">
          <MapPin className="h-8 w-8 text-orange-500" /> Location Repository
        </h1>
        <p className="text-slate-400">Open an owner dossier for listings, managers, and booking history</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <p className="text-xs text-slate-400">Total Listings</p>
          <p className="text-2xl font-bold text-white">{data.listings.length}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <p className="text-xs text-slate-400">Location Owners</p>
          <p className="text-2xl font-bold text-white">{data.ownerCount}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <p className="text-xs text-slate-400">Total Bookings</p>
          <p className="text-2xl font-bold text-white">{data.bookings.length}</p>
        </div>
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
          <p className="text-xs text-slate-400">Pending / Approved</p>
          <p className="text-2xl font-bold text-white">
            {pending} / {approved}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["overview", "owners", "listings", "bookings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${tab === t ? "bg-orange-500 text-white" : "border border-slate-700/50 bg-slate-800/50 text-slate-400"}`}
          >
            {t}
          </button>
        ))}
        <div className="relative ml-auto min-w-[200px] max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search owners…"
            className="w-full rounded-lg border border-slate-700 bg-slate-900/60 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <Building2 className="h-5 w-5 text-orange-400" /> Owners
            </h2>
            {owners.length === 0 ? (
              <p className="text-sm text-slate-500">No owners yet.</p>
            ) : (
              <ul className="space-y-2">
                {owners.slice(0, 8).map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/locations/${o.id}`} className="flex items-center justify-between text-sm hover:text-orange-300">
                      <span className="text-white">{o.name || o.email}</span>
                      <span className="text-slate-500">
                        {o.listingCount} listings · {o.bookingCount} bookings
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <Calendar className="h-5 w-5 text-orange-400" /> Recent Bookings
            </h2>
            {data.bookings.length === 0 ? (
              <p className="text-sm text-slate-500">No bookings yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.bookings.slice(0, 8).map((b) => (
                  <li key={b.id} className="flex items-center justify-between text-sm">
                    <Link href={`/admin/locations/${b.owner.id}`} className="text-white hover:text-orange-300">
                      {b.location.name}
                    </Link>
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${b.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" : b.status === "APPROVED" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}
                    >
                      {b.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {tab === "owners" && (
        <div className="space-y-3">
          {owners.map((o) => (
            <Link
              key={o.id}
              href={`/admin/locations/${o.id}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 transition hover:border-orange-500/40"
            >
              <div>
                <h3 className="font-medium text-white">{o.name || o.email}</h3>
                <p className="text-sm text-slate-400">{o.email}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {o.listingCount} listings · {o.bookingCount} bookings
                  {o.lastActivityAt ? ` · Last ${new Date(o.lastActivityAt).toLocaleDateString()}` : ""}
                </p>
              </div>
              <ExternalLink className="h-4 w-4 text-slate-500" />
            </Link>
          ))}
        </div>
      )}

      {tab === "listings" && (
        <div className="space-y-3">
          {data.listings.map((l) => (
            <div
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-700/50 bg-slate-800/50 p-5"
            >
              <div>
                <h3 className="font-medium text-white">{l.name}</h3>
                <p className="text-sm text-slate-400">
                  {l.type}
                  {l.city ? ` · ${l.city}` : ""} {l.capacity != null ? ` · Capacity ${l.capacity}` : ""}{" "}
                  {l.dailyRate != null ? ` · R${l.dailyRate}/day` : ""}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Owner: {l.company?.name || "—"} ({l.company?.email}) · {l._count.bookings} bookings
                </p>
              </div>
              {l.company?.id && (
                <Link href={`/admin/locations/${l.company.id}`} className="text-xs text-orange-400 hover:underline">
                  Open owner dossier
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "bookings" && (
        <div className="space-y-3">
          {data.bookings.map((b) => (
            <div
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-700/50 bg-slate-800/50 p-5"
            >
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-white">
                    {b.location.name} — {b.location.type}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${b.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" : b.status === "APPROVED" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}
                  >
                    {b.status}
                  </span>
                </div>
                <p className="text-sm text-slate-400">
                  Requester: {b.requester.name || b.requester.email} · Owner: {b.owner.name || b.owner.email}
                </p>
                {b.startDate && (
                  <p className="mt-1 text-xs text-slate-500">
                    {b.startDate} — {b.endDate || "TBD"}
                    {b.crewSize != null ? ` · Crew: ${b.crewSize}` : ""}
                  </p>
                )}
              </div>
              <Link href={`/admin/locations/${b.owner.id}`} className="text-xs text-orange-400 hover:underline">
                Owner dossier
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
