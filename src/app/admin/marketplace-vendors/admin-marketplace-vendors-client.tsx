"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";

type VendorData = {
  equipmentCompanies: Array<{
    id: string;
    name: string | null;
    email: string | null;
    professionalName: string | null;
    listingCount?: number;
    requestCount?: number;
  }>;
  cateringCompanies: Array<{
    id: string;
    companyName: string;
    user: { id?: string; email: string | null; name?: string | null };
    bookingCount?: number;
    forecastCount?: number;
  }>;
  inventoryTagCount: number;
  mealForecastCount: number;
  requestStats: Array<{ status: string; _count: { _all: number } }>;
  bookingStats: Array<{ status: string; _count: { _all: number } }>;
  recentEquipment: Array<{
    id: string;
    status: string;
    equipment: { companyName: string };
    requester: { name: string | null };
    company?: { id: string };
  }>;
  recentCatering: Array<{
    id: string;
    status: string;
    cateringCompany: { id?: string; companyName: string };
    creator: { name: string | null };
  }>;
  error?: string;
};

export function AdminMarketplaceVendorsClient() {
  const [data, setData] = useState<VendorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/admin/marketplace-vendors")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "Failed to load");
        setData(json);
      })
      .catch((e: Error) =>
        setData({
          equipmentCompanies: [],
          cateringCompanies: [],
          inventoryTagCount: 0,
          mealForecastCount: 0,
          requestStats: [],
          bookingStats: [],
          recentEquipment: [],
          recentCatering: [],
          error: e.message,
        }),
      )
      .finally(() => setLoading(false));
  }, []);

  const needle = q.trim().toLowerCase();
  const equipment = useMemo(() => {
    if (!data) return [];
    if (!needle) return data.equipmentCompanies;
    return data.equipmentCompanies.filter(
      (c) =>
        (c.professionalName || "").toLowerCase().includes(needle) ||
        (c.name || "").toLowerCase().includes(needle) ||
        (c.email || "").toLowerCase().includes(needle),
    );
  }, [data, needle]);

  const catering = useMemo(() => {
    if (!data) return [];
    if (!needle) return data.cateringCompanies;
    return data.cateringCompanies.filter(
      (c) =>
        c.companyName.toLowerCase().includes(needle) ||
        (c.user.email || "").toLowerCase().includes(needle) ||
        (c.user.name || "").toLowerCase().includes(needle),
    );
  }, [data, needle]);

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center text-slate-400">Loading vendor oversight…</div>;
  }

  if (!data || data.error) {
    return <div className="p-8 text-center text-red-400">{data?.error ?? "Failed to load"}</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Equipment & catering oversight</h1>
          <p className="mt-1 text-sm text-slate-400">
            Open a company dossier for listings, RFID inventory, bookings, and forecasts.
          </p>
        </div>
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search vendors…"
            className="w-full rounded-lg border border-slate-700 bg-slate-900/60 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Equipment companies" value={data.equipmentCompanies.length} />
        <Stat label="Catering companies" value={data.cateringCompanies.length} />
        <Stat label="RFID tags" value={data.inventoryTagCount} />
        <Stat label="Meal forecasts" value={data.mealForecastCount} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatsBreakdown title="Equipment requests by status" rows={data.requestStats} />
        <StatsBreakdown title="Catering bookings by status" rows={data.bookingStats} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <VendorDirectory
          title="Equipment companies"
          rows={equipment.map((c) => ({
            id: c.id,
            href: `/admin/marketplace-vendors/equipment/${c.id}`,
            name: c.professionalName ?? c.name ?? "—",
            email: c.email,
            meta: `${c.listingCount ?? 0} listings · ${c.requestCount ?? 0} requests`,
          }))}
        />
        <VendorDirectory
          title="Catering companies"
          rows={catering.map((c) => ({
            id: c.id,
            href: `/admin/marketplace-vendors/catering/${c.id}`,
            name: c.companyName,
            email: c.user.email,
            meta: `${c.bookingCount ?? 0} bookings · ${c.forecastCount ?? 0} forecasts`,
          }))}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 p-4">
          <h2 className="text-sm font-semibold text-white">Recent equipment requests</h2>
          <ul className="mt-3 space-y-2 text-xs">
            {data.recentEquipment.length === 0 && <li className="text-slate-500">None</li>}
            {data.recentEquipment.map((r) => (
              <li key={r.id} className="flex justify-between border-b border-slate-800/50 pb-2 text-slate-300">
                {r.company?.id ? (
                  <Link href={`/admin/marketplace-vendors/equipment/${r.company.id}`} className="hover:text-orange-300">
                    {r.equipment.companyName} · {r.requester.name ?? "Creator"}
                  </Link>
                ) : (
                  <span>
                    {r.equipment.companyName} · {r.requester.name ?? "Creator"}
                  </span>
                )}
                <span className="text-slate-500">{r.status}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-slate-800 p-4">
          <h2 className="text-sm font-semibold text-white">Recent catering bookings</h2>
          <ul className="mt-3 space-y-2 text-xs">
            {data.recentCatering.length === 0 && <li className="text-slate-500">None</li>}
            {data.recentCatering.map((b) => (
              <li key={b.id} className="flex justify-between border-b border-slate-800/50 pb-2 text-slate-300">
                {b.cateringCompany.id ? (
                  <Link
                    href={`/admin/marketplace-vendors/catering/${b.cateringCompany.id}`}
                    className="hover:text-orange-300"
                  >
                    {b.cateringCompany.companyName} · {b.creator.name ?? "Creator"}
                  </Link>
                ) : (
                  <span>
                    {b.cateringCompany.companyName} · {b.creator.name ?? "Creator"}
                  </span>
                )}
                <span className="text-slate-500">{b.status}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function StatsBreakdown({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ status: string; _count: { _all: number } }>;
}) {
  return (
    <div className="rounded-xl border border-slate-800 p-4">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <ul className="mt-2 space-y-1 text-xs text-slate-400">
        {rows.length === 0 && <li>None</li>}
        {rows.map((r) => (
          <li key={r.status} className="flex justify-between">
            <span>{r.status}</span>
            <span>{r._count._all}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VendorDirectory({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ id: string; href: string; name: string; email: string | null; meta?: string }>;
}) {
  return (
    <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-800 p-4">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <ul className="mt-2 space-y-1 text-xs">
        {rows.length === 0 && <li className="text-slate-500">None</li>}
        {rows.slice(0, 50).map((r) => (
          <li key={r.id}>
            <Link href={r.href} className="flex items-start justify-between gap-2 py-1.5 text-slate-300 hover:text-orange-300">
              <span>
                <span className="block">{r.name}</span>
                <span className="text-slate-500">{r.email ?? "—"}{r.meta ? ` · ${r.meta}` : ""}</span>
              </span>
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
