"use client";

import { StoryTimeLoader, StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";
import { Suspense, useCallback, useEffect, useState } from "react";
import { BackButton } from "@/components/layout/back-button";
import {
  CreatorProjectContextBanner,
  useCreatorProjectContext,
  usePrefillProjectName,
} from "@/components/creator/creator-project-context";
import { fetchMarketplaceList, postMarketplaceJson } from "@/lib/creator-marketplace-fetch";
import { MapPin, Users, ChevronDown, ChevronUp, MessageCircle, CheckCircle, Calendar, CreditCard } from "lucide-react";
import { formatZar } from "@/lib/format-currency-zar";
import { useMarketplacePay } from "@/lib/hooks/use-marketplace-pay";
import { MarketplaceCheckoutModal } from "@/components/marketplace/marketplace-checkout-modal";
import { MarketplaceFeeBreakdown } from "@/components/marketplace/marketplace-fee-breakdown";
import { SecureImage } from "@/components/files/secure-image";

const LOCATION_TYPES = ["Studio", "House", "Warehouse", "Outdoor", "Office", "Historical", "Restaurant", "Other"];

type Location = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  capacity: number | null;
  dailyRate: number | null;
  amenities: string | null;
  photoUrls: string | null;
  photos?: string[];
  previewImageUrl?: string | null;
  rules: string | null;
  availability: string | null;
  contactUrl: string | null;
  company: { id: string; name: string | null } | null;
  _count: { bookings: number };
  profile?: {
    dailyRate?: number | null;
    hourlyRate?: number | null;
    permitRequirements?: string | null;
    restrictions?: string | null;
    logistics?: string | null;
  };
};

type Booking = {
  id: string;
  status: string;
  note: string | null;
  shootType: string | null;
  startDate: string | null;
  endDate: string | null;
  crewSize: number | null;
  createdAt: string;
  paymentTransactionId: string | null;
  payQuote?: { baseAmount: number; feeAmount: number; totalAmount: number } | null;
  location: { id: string; name: string; type: string; city: string | null; dailyRate: number | null; company: { id: string; name: string | null } };
  owner: { id: string; name: string | null; email: string | null };
  _count: { messages: number };
};

function CreatorLocationsPageContent() {
  const { projectId, projectTitle } = useCreatorProjectContext({
    phase: "PRE_PRODUCTION",
    toolSlug: "location-marketplace",
  });
  const [locations, setLocations] = useState<Location[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"browse" | "bookings">("browse");
  const [filterType, setFilterType] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bookingForId, setBookingForId] = useState<string | null>(null);
  const [bookForm, setBookForm] = useState({ shootType: "", startDate: "", endDate: "", crewSize: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [quoteProfiles, setQuoteProfiles] = useState<Record<string, {
    dailyRate: number | null;
    hourlyRate: number | null;
    estimate: { days: number; subtotal: number } | null;
  }>>({});
  const [quoteLoadingId, setQuoteLoadingId] = useState<string | null>(null);
  const marketplacePay = useMarketplacePay({
    onPaid: () => {
      fetch("/api/location-bookings")
        .then((r) => r.json())
        .then((bks) => setBookings(Array.isArray(bks) ? bks : []));
    },
  });

  async function payBooking(bookingId: string) {
    setPayingId(bookingId);
    try {
      const result = await marketplacePay.pay(`/api/location-bookings/${bookingId}/pay`);
      if (result?.mode === "wallet") {
        setBookings((prev) =>
          prev.map((x) => (x.id === bookingId ? { ...x, paymentTransactionId: result.data.transactionId ?? "paid" } : x)),
        );
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPayingId(null);
    }
  }

  const prefillNote = useCallback(
    (title: string) => {
      setBookForm((f) => {
        if (f.note.trim()) return f;
        return { ...f, note: `Booking for project: ${title}` };
      });
    },
    [],
  );
  usePrefillProjectName(projectTitle, prefillNote);

  async function loadQuoteProfile(locationId: string, startDate?: string, endDate?: string) {
    setQuoteLoadingId(locationId);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const q = params.toString() ? `?${params}` : "";
      const res = await fetch(`/api/locations/${locationId}/quote-profile${q}`);
      if (res.ok) {
        const data = await res.json();
        setQuoteProfiles((prev) => ({ ...prev, [locationId]: data }));
      }
    } finally {
      setQuoteLoadingId(null);
    }
  }

  useEffect(() => {
    if (!expandedId || bookingForId !== expandedId) return;
    const { startDate, endDate } = bookForm;
    if (!startDate || !endDate) return;
    const timer = setTimeout(() => void loadQuoteProfile(expandedId, startDate, endDate), 400);
    return () => clearTimeout(timer);
  }, [expandedId, bookingForId, bookForm.startDate, bookForm.endDate]);

  useEffect(() => {
    Promise.all([
      fetchMarketplaceList<Location>("/api/locations"),
      fetch("/api/location-bookings").then(async (r) => {
        const data = await r.json();
        if (r.status === 503 && data.error) throw new Error(data.error);
        return Array.isArray(data) ? data : [];
      }),
    ])
      .then(([locsRes, bks]) => {
        setLocations(locsRes.data);
        if (locsRes.error) setSetupError(locsRes.error);
        setBookings(bks);
        setLoading(false);
      })
      .catch((err) => {
        setSetupError(err?.message || "Failed to load. Run: npm run refresh, then restart the dev server.");
        setLoading(false);
      });
  }, []);

  const cities = [...new Set(locations.map((l) => l.city).filter(Boolean))] as string[];
  const filtered = locations.filter((l) => {
    if (filterType && l.type !== filterType) return false;
    if (filterCity && l.city !== filterCity) return false;
    return true;
  });

  async function submitBooking(locationId: string) {
    setSubmitting(true);
    setSubmitError("");
    const note =
      bookForm.note ||
      (projectTitle ? `Booking for project: ${projectTitle}` : null);
    const { data: newBooking, error } = await postMarketplaceJson<Booking & { paymentTransactionId?: string | null }>(
      "/api/location-bookings",
      {
        locationId,
        shootType: bookForm.shootType || null,
        startDate: bookForm.startDate || null,
        endDate: bookForm.endDate || null,
        crewSize: bookForm.crewSize ? parseInt(bookForm.crewSize, 10) : null,
        note,
        projectId: projectId ?? null,
        projectTitle: projectTitle ?? null,
      },
    );
    setSubmitting(false);
    if (error || !newBooking) {
      setSubmitError(error || "Could not send booking request");
      return;
    }
    setBookings((prev) => [
      { ...newBooking, paymentTransactionId: newBooking.paymentTransactionId ?? null, _count: { messages: 0 } },
      ...prev,
    ]);
    setBookingForId(null);
    setBookForm({ shootType: "", startDate: "", endDate: "", crewSize: "", note: projectTitle ? `Booking for project: ${projectTitle}` : "" });
    setSuccess("Booking request sent!");
    setTimeout(() => setSuccess(""), 3000);
  }

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <StoryTimeLoader size="sm" hideTrack />
      </div>
    );

  if (setupError)
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <BackButton fallback="/creator/dashboard" />
        <div className="mt-6 p-6 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
          <p className="font-medium mb-2">Location features not loaded</p>
          <p className="text-sm text-slate-300">{setupError}</p>
        </div>
      </div>
    );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <BackButton
        fallback={
          projectId ? `/creator/pre/location-marketplace?projectId=${encodeURIComponent(projectId)}` : "/creator/dashboard"
        }
      />
      <CreatorProjectContextBanner phase="PRE_PRODUCTION" toolSlug="location-marketplace" accent="cyan" />
      {submitError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{submitError}</div>
      )}
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white mb-2 tracking-tight flex items-center gap-3">
            <MapPin className="w-8 h-8 text-orange-500" />
            Location Repository
          </h1>
          <p className="text-slate-400">Browse locations with photos. Message owners for free, then confirm payment once your booking is approved.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab("browse")} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "browse" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>
            Browse Locations
          </button>
          <button onClick={() => setTab("bookings")} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "bookings" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>
            My Bookings ({bookings.length})
          </button>
        </div>
      </div>

      {success && (
        <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> {success}
        </div>
      )}

      {tab === "browse" && (
        <>
          <div className="flex flex-wrap gap-3 mb-6">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm">
              <option value="">All types</option>
              {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm">
              <option value="">All cities</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((loc) => {
              const gallery = loc.photos?.length ? loc.photos : loc.photoUrls?.split(/[\n,]/).map((s) => s.trim()).filter((s) => s.startsWith("http")) ?? [];
              const hero = loc.previewImageUrl || gallery[0];
              const isExpanded = expandedId === loc.id;
              const showBookForm = bookingForId === loc.id;
              const quote = quoteProfiles[loc.id];
              return (
                <div key={loc.id} className="rounded-2xl bg-slate-800/30 border border-slate-700/50 overflow-hidden hover:border-orange-500/30 transition">
                  {gallery.length >= 2 ? (
                    <div className="grid grid-cols-2 gap-0.5 bg-slate-900">
                      {gallery.slice(0, 4).map((url, i) => (
                        <img key={`${loc.id}-${i}`} src={url} alt="" className={`w-full object-cover ${gallery.length === 2 ? "h-40" : "h-28"}`} />
                      ))}
                    </div>
                  ) : hero ? (
                    <SecureImage fileRef={hero} alt="" className="w-full h-40 object-cover" />
                  ) : (
                    <div className="h-32 flex items-center justify-center bg-slate-800/60"><MapPin className="w-10 h-10 text-slate-600" /></div>
                  )}
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-semibold text-white">{loc.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">{loc.type}</span>
                    </div>
                    {loc.city && <p className="text-sm text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> {loc.city}{loc.province ? `, ${loc.province}` : ""}</p>}
                    {loc.description && <p className="text-sm text-slate-400 line-clamp-2">{loc.description}</p>}
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                      {loc.capacity != null && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {loc.capacity} max</span>}
                    </div>
                    <button onClick={() => {
                      const next = isExpanded ? null : loc.id;
                      setExpandedId(next);
                      if (next && !quoteProfiles[next]) void loadQuoteProfile(next);
                    }} className="flex items-center gap-1 text-sm text-orange-400 hover:text-orange-300">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} {isExpanded ? "Less" : "More details"}
                    </button>
                    {isExpanded && (
                      <div className="pt-3 border-t border-slate-700/50 space-y-2 text-sm">
                        {gallery.length > 1 && (
                          <div className="flex gap-2 overflow-x-auto pb-2">
                            {gallery.slice(0, 6).map((url) => (
                              <img key={url} src={url} alt="" className="h-16 w-24 shrink-0 rounded-lg object-cover" />
                            ))}
                          </div>
                        )}
                        {loc.amenities && <p><span className="text-slate-500">Amenities:</span> {loc.amenities}</p>}
                        {loc.profile?.permitRequirements && <p><span className="text-slate-500">Permits:</span> {loc.profile.permitRequirements}</p>}
                        {loc.profile?.logistics && <p><span className="text-slate-500">Logistics:</span> {loc.profile.logistics}</p>}
                        {(loc.profile?.restrictions || loc.rules) && <p><span className="text-slate-500">Rules:</span> {loc.profile?.restrictions || loc.rules}</p>}
                        {loc.availability && <p><span className="text-slate-500">Availability:</span> {loc.availability}</p>}
                        {quoteLoadingId === loc.id && <p className="text-slate-500 text-xs">Loading rates…</p>}
                        {quote && (
                          <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3 text-sm text-slate-300 space-y-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Quote profile</p>
                            {quote.dailyRate != null && <p>Daily: {formatZar(quote.dailyRate)}</p>}
                            {quote.hourlyRate != null && <p>Hourly: {formatZar(quote.hourlyRate)}</p>}
                            {quote.estimate && quote.estimate.subtotal > 0 && (
                              <p className="text-orange-300">Est. {quote.estimate.days} day(s): {formatZar(quote.estimate.subtotal)}</p>
                            )}
                            {!quote.dailyRate && !quote.hourlyRate && (
                              <p className="text-slate-500">Message the owner for a custom quote.</p>
                            )}
                          </div>
                        )}
                        {loc.contactUrl && <a href={loc.contactUrl} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Contact / Website</a>}
                      </div>
                    )}
                    {!showBookForm ? (
                      <button onClick={() => setBookingForId(loc.id)} className="w-full py-2.5 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition">
                        Request to book
                      </button>
                    ) : (
                      <div className="pt-3 border-t border-slate-700/50 space-y-2">
                        <input value={bookForm.shootType} onChange={(e) => setBookForm({ ...bookForm, shootType: e.target.value })} placeholder="Shoot type (e.g. Film, Commercial)" className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" />
                        <div className="grid grid-cols-2 gap-2">
                          <input type="date" value={bookForm.startDate} onChange={(e) => setBookForm({ ...bookForm, startDate: e.target.value })} className="px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" />
                          <input type="date" value={bookForm.endDate} onChange={(e) => setBookForm({ ...bookForm, endDate: e.target.value })} className="px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" />
                        </div>
                        <input type="number" min={1} value={bookForm.crewSize} onChange={(e) => setBookForm({ ...bookForm, crewSize: e.target.value })} placeholder="Crew size" className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" />
                        <textarea value={bookForm.note} onChange={(e) => setBookForm({ ...bookForm, note: e.target.value })} placeholder="Message to owner" rows={2} className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" />
                        <div className="flex gap-2">
                          <button onClick={() => { setBookingForId(null); setBookForm({ shootType: "", startDate: "", endDate: "", crewSize: "", note: "" }); }} className="flex-1 py-2 rounded-lg border border-slate-600 text-slate-400 text-sm">Cancel</button>
                          <button onClick={() => submitBooking(loc.id)} disabled={submitting} className="flex-1 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50">Send request</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-10 text-center">
              <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No locations match your filters.</p>
            </div>
          )}
        </>
      )}

      {tab === "bookings" && (
        <div className="space-y-3">
          {bookings.map((b) => (
            <div key={b.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-white font-medium">{b.location.name} — {b.location.type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    b.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" :
                    b.status === "APPROVED" ? "bg-green-500/10 text-green-400" :
                    b.status === "CANCELLED" ? "bg-slate-500/10 text-slate-400" :
                    "bg-red-500/10 text-red-400"
                  }`}>{b.status}</span>
                  {b.paymentTransactionId ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">Paid</span>
                  ) : null}
                </div>
                <p className="text-sm text-slate-400">{b.location.company?.name && <span>{b.location.company.name} · </span>}{b.location.city}</p>
                {b.startDate && <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> {b.startDate} — {b.endDate || "TBD"}</p>}
                <p className="text-xs text-slate-500 mt-1">{b._count.messages} messages</p>
                {b.status === "APPROVED" && !b.paymentTransactionId && b.payQuote ? (
                  <MarketplaceFeeBreakdown
                    baseAmount={b.payQuote.baseAmount}
                    feeAmount={b.payQuote.feeAmount}
                    totalAmount={b.payQuote.totalAmount}
                  />
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 justify-end">
                <a
                  href={`/creator/messages?tab=locations&bookingId=${b.id}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/30 text-sm hover:bg-orange-500/20 transition"
                >
                  <MessageCircle className="w-4 h-4" /> Message
                </a>
                {b.status === "APPROVED" && !b.paymentTransactionId && (
                  <button
                    type="button"
                    disabled={payingId === b.id || !b.payQuote}
                    onClick={() => payBooking(b.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-sm font-medium hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4" />{" "}
                    {payingId === b.id
                      ? "Processing…"
                      : b.payQuote
                        ? `Pay ${formatZar(b.payQuote.totalAmount)}`
                        : "Confirm & pay"}
                  </button>
                )}
              </div>
            </div>
          ))}
          {bookings.length === 0 && (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-10 text-center">
              <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No bookings yet. Browse locations and send a request to book.</p>
            </div>
          )}
        </div>
      )}
      <MarketplaceCheckoutModal
        open={marketplacePay.checkoutOpen}
        checkoutUrl={marketplacePay.checkoutUrl}
        onClose={marketplacePay.closeCheckout}
        title="Location booking checkout"
      />
    </div>
  );
}

export default function CreatorLocationsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
      <CreatorLocationsPageContent />
    </Suspense>
  );
}
