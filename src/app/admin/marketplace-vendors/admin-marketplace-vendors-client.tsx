"use client";

import { useEffect, useState } from "react";

type VendorData = {
  equipmentCompanies: Array<{ id: string; name: string | null; email: string | null; professionalName: string | null }>;
  cateringCompanies: Array<{ id: string; companyName: string; user: { email: string | null } }>;
  inventoryTagCount: number;
  mealForecastCount: number;
  requestStats: Array<{ status: string; _count: { _all: number } }>;
  bookingStats: Array<{ status: string; _count: { _all: number } }>;
  recentEquipment: Array<{ id: string; status: string; equipment: { companyName: string }; requester: { name: string | null } }>;
  recentCatering: Array<{ id: string; status: string; cateringCompany: { companyName: string }; creator: { name: string | null } }>;
  error?: string;
};

export function AdminMarketplaceVendorsClient() {
  const [data, setData] = useState<VendorData | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <div className="flex min-h-[40vh] items-center justify-center text-slate-400">Loading vendor oversight…</div>;
  }

  if (!data || data.error) {
    return <div className="p-8 text-center text-red-400">{data?.error ?? "Failed to load"}</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Equipment & catering oversight</h1>
        <p className="mt-1 text-sm text-slate-400">Platform-wide view of vendor companies, RFID inventory, and meal forecasts.</p>
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
        <VendorDirectory title="Equipment companies" rows={data.equipmentCompanies.map((c) => ({ name: c.professionalName ?? c.name ?? "—", email: c.email }))} />
        <VendorDirectory title="Catering companies" rows={data.cateringCompanies.map((c) => ({ name: c.companyName, email: c.user.email }))} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 p-4">
          <h2 className="text-sm font-semibold text-white">Recent equipment requests</h2>
          <ul className="mt-3 space-y-2 text-xs">
            {data.recentEquipment.length === 0 && <li className="text-slate-500">None</li>}
            {data.recentEquipment.map((r) => (
              <li key={r.id} className="flex justify-between border-b border-slate-800/50 pb-2 text-slate-300">
                <span>{r.equipment.companyName} · {r.requester.name ?? "Creator"}</span>
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
                <span>{b.cateringCompany.companyName} · {b.creator.name ?? "Creator"}</span>
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

function VendorDirectory({ title, rows }: { title: string; rows: Array<{ name: string; email: string | null }> }) {
  return (
    <div className="rounded-xl border border-slate-800 p-4 max-h-64 overflow-y-auto">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <ul className="mt-2 space-y-1 text-xs">
        {rows.length === 0 && <li className="text-slate-500">None</li>}
        {rows.slice(0, 50).map((r, i) => (
          <li key={`${r.name}-${i}`} className="flex justify-between text-slate-300">
            <span>{r.name}</span>
            <span className="text-slate-500">{r.email ?? "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
