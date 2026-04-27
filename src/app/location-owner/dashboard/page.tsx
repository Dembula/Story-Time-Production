"use client";

import { useCallback, useEffect, useState } from "react";
import { formatZar } from "@/lib/format-currency-zar";
import type { LucideIcon } from "lucide-react";
import { MapPin, MessageCircle, Clock, CheckCircle, XCircle, TrendingUp, DollarSign, Wallet } from "lucide-react";
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
  paymentTransactionId: string | null;
  location: { id: string; name: string; type: string; city: string | null; dailyRate: number | null };
  requester: { id: string; name: string | null; email: string | null };
  _count: { messages: number };
}

interface LocationListing {
  id: string;
  name: string;
  type: string;
  city: string | null;
  dailyRate: number | null;
}

interface LocationOwnerFinancialSnapshot {
  settledRevenue: number;
  pipelineEstimate: number;
  settledTransactionCount: number;
  approvedAwaitingPaymentCount: number;
  recentSettlements: { id: string; amount: number; createdAt: string; referenceId: string }[];
  reporting?: {
    settledWindow: string;
    pipelineWindow: string;
  };
}

export default function LocationOwnerDashboard() {
  const [bookings, setBookings] = useState<LocationBooking[]>([]);
  const [listings, setListings] = useState<LocationListing[]>([]);
  const [financials, setFinancials] = useState<LocationOwnerFinancialSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const [subChecked, setSubChecked] = useState(false);
  useEffect(() => {
    fetch("/api/company-subscription").then((r) => r.json()).then((data) => {
      if (!data?.subscription?.id || data.subscription.status !== "ACTIVE") {
        window.location.href = "/company/onboarding/subscription";
        return;
      }
      setSubChecked(true);
    });
  }, []);

  const refreshData = useCallback(() => {
    if (!subChecked) return;
    setLoading(true);
    Promise.all([
      fetch("/api/location-bookings").then((r) => r.json()),
      fetch("/api/locations").then((r) => r.json()),
      fetch("/api/location-owner/financials").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([b, l, fin]) => {
        setBookings(Array.isArray(b) ? b : []);
        setListings(Array.isArray(l) ? l : []);
        setFinancials(fin && typeof fin.settledRevenue === "number" ? fin : null);
      })
      .finally(() => setLoading(false));
  }, [subChecked]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const pending = bookings.filter((r) => r.status === "PENDING").length;
  const approved = bookings.filter((r) => r.status === "APPROVED").length;

  async function handleStatus(id: string, status: string) {
    await fetch("/api/location-bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setBookings((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    refreshData();
  }

  if (!subChecked || loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  const settled = financials?.settledRevenue ?? 0;
  const pipeline = financials?.pipelineEstimate ?? 0;

  return (
    <main className="max-w-7xl mx-auto px-6 md:px-12 py-10 space-y-10">
      <div>
        <h1 className="text-3xl font-bold text-white mb-1">Location Dashboard</h1>
        <p className="text-slate-400 text-sm">
          Manage your properties and shoot bookings. Settled revenue is all-time completed location booking transactions (not month-scoped); pipeline is unpaid approved bookings estimated from rates — same ledger rules as catering.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {(
          [
            { label: "Listings", value: listings.length, icon: MapPin, color: "text-blue-400" },
            { label: "Total Bookings", value: bookings.length, icon: TrendingUp, color: "text-orange-400" },
            { label: "Pending", value: pending, icon: Clock, color: "text-yellow-400" },
            { label: "Approved", value: approved, icon: CheckCircle, color: "text-green-400" },
            { label: "Revenue (settled)", value: formatZar(settled, { maximumFractionDigits: 0 }), icon: DollarSign, color: "text-emerald-400" },
            {
              label: "Pipeline (est.)",
              value: formatZar(pipeline, { maximumFractionDigits: 0 }),
              icon: Wallet,
              color: "text-cyan-400",
              sub: financials ? `${financials.approvedAwaitingPaymentCount} unpaid approved` : undefined,
            },
          ] satisfies { label: string; value: string | number; icon: LucideIcon; color: string; sub?: string }[]
        ).map((s) => (
          <div key={s.label} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-slate-400 uppercase tracking-wider">{s.label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
            {s.sub ? <p className="text-[11px] text-slate-500 mt-1">{s.sub}</p> : null}
          </div>
        ))}
      </div>

      {financials && financials.recentSettlements.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Recent settlements</h2>
          <ul className="space-y-2 text-sm">
            {financials.recentSettlements.slice(0, 8).map((t) => (
              <li key={t.id} className="flex justify-between rounded-lg border border-slate-700/50 bg-slate-800/30 px-4 py-2">
                <span className="text-emerald-400 font-medium">{formatZar(t.amount)}</span>
                <span className="text-slate-500">{new Date(t.createdAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-orange-400" /> Recent Bookings
        </h2>
        {bookings.length === 0 ? (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-10 text-center">
            <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No booking requests yet.</p>
            <p className="text-xs text-slate-500 mt-1">Film creators can book your locations from the Locations repository.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.slice(0, 10).map((r) => (
              <div key={r.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="text-white font-medium">{r.location.name} — {r.location.type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" :
                        r.status === "APPROVED" ? "bg-green-500/10 text-green-400" :
                        r.status === "CANCELLED" ? "bg-slate-500/10 text-slate-400" :
                        "bg-red-500/10 text-red-400"
                      }`}>{r.status}</span>
                      {r.paymentTransactionId ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">Paid</span>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-400">
                      Requested by <span className="text-orange-400">{r.requester.name || r.requester.email}</span>
                      {r.shootType && <span className="text-slate-500"> · {r.shootType}</span>}
                    </p>
                    {r.note && <p className="text-sm text-slate-500 mt-1">&quot;{r.note}&quot;</p>}
                    {r.startDate && (
                      <p className="text-xs text-slate-500 mt-1">
                        {r.startDate} — {r.endDate || "TBD"}
                        {r.crewSize != null && ` · Crew: ${r.crewSize}`}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      {r._count.messages} message{r._count.messages !== 1 ? "s" : ""} · {new Date(r.createdAt).toLocaleDateString()}
                      {r.status === "APPROVED" && !r.paymentTransactionId && r.location.dailyRate != null && (
                        <span className="text-cyan-500/90"> · Est. booking value {formatZar(
                          (() => {
                            if (!r.startDate || !r.endDate) return r.location.dailyRate ?? 0;
                            const start = new Date(r.startDate).getTime();
                            const end = new Date(r.endDate).getTime();
                            if (Number.isNaN(start) || Number.isNaN(end) || end < start) return r.location.dailyRate ?? 0;
                            const days = Math.max(1, Math.ceil((end - start) / (24 * 60 * 60 * 1000)));
                            return days * (r.location.dailyRate ?? 0);
                          })(),
                          { maximumFractionDigits: 0 },
                        )}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status === "PENDING" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStatus(r.id, "APPROVED")}
                          className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatus(r.id, "DECLINED")}
                          className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <Link
                      href={`/location-owner/messages?bookingId=${r.id}`}
                      className="p-2 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
