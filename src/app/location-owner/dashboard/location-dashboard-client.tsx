"use client";

import { StoryTimeLoader, StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatZar } from "@/lib/format-currency-zar";
import { firstPhotoUrl } from "@/lib/marketplace-media";
import { readCompanyApiJson } from "@/lib/casting-agency-client";
import { MapPin, MessageCircle, Clock, CheckCircle, XCircle, TrendingUp, DollarSign, Wallet, Home } from "lucide-react";
import { OpsMetricCard, OpsPageHeader, OpsQuickActions, OpsSection } from "@/components/ecosystem/ops-shell";
import { StakeholderEcosystemHome } from "@/components/ecosystem/stakeholder-ecosystem-home";

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

interface ListingPreview {
  id: string;
  name: string;
  type: string;
  city: string | null;
  dailyRate: number | null;
  photoUrls: string | null;
}

export function LocationDashboardClient() {
  const [bookings, setBookings] = useState<LocationBooking[]>([]);
  const [listings, setListings] = useState<ListingPreview[]>([]);
  const [metrics, setMetrics] = useState({
    listings: 0,
    totalBookings: 0,
    pending: 0,
    settledRevenue: 0,
    pipelineEstimate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/location-bookings").then((r) => r.json()),
      fetch("/api/location-owner/overview").then((r) =>
        readCompanyApiJson<{
          metrics: typeof metrics;
          listings: ListingPreview[];
          recentBookings: LocationBooking[];
        }>(r),
      ),
    ])
      .then(([b, overview]) => {
        setBookings(Array.isArray(b) ? b : []);
        if (overview.error) setError(overview.error);
        if (overview.data?.metrics) setMetrics(overview.data.metrics);
        setListings(overview.data?.listings ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <StoryTimeLoader size="sm" hideTrack />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-6 py-10 md:px-12">
      <OpsPageHeader
        title="Location operations"
        subtitle="Property galleries, shoot bookings, and settled revenue — your locations hub for film and TV productions."
      />
      {error && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">{error}</div>}

      <StakeholderEcosystemHome portalPrefix="/location-owner" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <OpsMetricCard label="Properties" value={metrics.listings || listings.length} icon={MapPin} accent="cyan" />
        <OpsMetricCard label="Bookings" value={bookings.length} icon={TrendingUp} accent="orange" />
        <OpsMetricCard label="Pending" value={pending} icon={Clock} accent="amber" />
        <OpsMetricCard label="Approved" value={approved} icon={CheckCircle} accent="emerald" />
        <OpsMetricCard label="Settled revenue" value={formatZar(metrics.settledRevenue, { maximumFractionDigits: 0 })} icon={DollarSign} accent="emerald" />
        <OpsMetricCard label="Pipeline (est.)" value={formatZar(metrics.pipelineEstimate, { maximumFractionDigits: 0 })} icon={Wallet} accent="violet" />
      </div>

      <OpsQuickActions
        items={[
          { href: "/location-owner/listings", label: "Manage properties", description: "Photos, rates, and amenities" },
          { href: "/location-owner/deals", label: "Booking pipeline", description: "All deals in one timeline" },
          { href: "/location-owner/bookings", label: "Booking inbox", description: "Approve shoot requests" },
          { href: "/location-owner/messages", label: "Messages", description: "Creator conversations" },
          { href: "/location-owner/wallet", label: "Wallet", description: "Payouts and balances" },
        ]}
      />

      <OpsSection title="Property gallery preview">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {listings.length === 0 ? (
            <p className="col-span-full text-sm text-slate-500">Add listings with photos so creators can preview your spaces.</p>
          ) : (
            listings.map((loc) => {
              const thumb = firstPhotoUrl(loc.photoUrls);
              return (
                <Link
                  key={loc.id}
                  href="/location-owner/listings"
                  className="overflow-hidden rounded-xl border border-slate-700/50 bg-slate-800/30 hover:border-orange-500/30"
                >
                  {thumb ? (
                    <img src={thumb} alt="" className="h-28 w-full object-cover" />
                  ) : (
                    <div className="flex h-28 items-center justify-center bg-slate-800/60">
                      <Home className="h-8 w-8 text-slate-600" />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="font-medium text-white">{loc.name}</p>
                    <p className="text-xs text-slate-400">
                      {loc.type}
                      {loc.city ? ` · ${loc.city}` : ""}
                      {loc.dailyRate != null ? ` · ${formatZar(loc.dailyRate)}/day` : ""}
                    </p>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </OpsSection>

      <OpsSection title="Recent bookings">
        {bookings.length === 0 ? (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-10 text-center">
            <MapPin className="mx-auto mb-3 h-12 w-12 text-slate-600" />
            <p className="text-slate-400">No booking requests yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.slice(0, 10).map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-3">
                      <span className="font-medium text-white">
                        {r.location.name} — {r.location.type}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.status === "PENDING"
                            ? "bg-yellow-500/10 text-yellow-400"
                            : r.status === "APPROVED"
                              ? "bg-green-500/10 text-green-400"
                              : r.status === "CANCELLED"
                                ? "bg-slate-500/10 text-slate-400"
                                : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400">
                      Requested by <span className="text-orange-400">{r.requester.name || r.requester.email}</span>
                    </p>
                    {r.note && <p className="mt-1 text-sm text-slate-500">&quot;{r.note}&quot;</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status === "PENDING" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStatus(r.id, "APPROVED")}
                          className="rounded-lg bg-green-500/10 p-2 text-green-400 transition hover:bg-green-500/20"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatus(r.id, "DECLINED")}
                          className="rounded-lg bg-red-500/10 p-2 text-red-400 transition hover:bg-red-500/20"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <Link
                      href={`/location-owner/messages?bookingId=${r.id}`}
                      className="rounded-lg bg-orange-500/10 p-2 text-orange-400 transition hover:bg-orange-500/20"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </OpsSection>
    </main>
  );
}
