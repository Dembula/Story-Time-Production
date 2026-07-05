"use client";

import { StoryTimeLoader } from "@/components/ui/storytime-loader";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BackButton } from "@/components/layout/back-button";
import {
  CreatorProjectContextBanner,
  useCreatorProjectContext,
} from "@/components/creator/creator-project-context";
import { fetchMarketplaceList, postMarketplaceJson } from "@/lib/creator-marketplace-fetch";
import { UtensilsCrossed, MapPin, ChevronDown, ChevronUp, MessageSquare, CreditCard } from "lucide-react";
import { useMarketplacePay } from "@/lib/hooks/use-marketplace-pay";
import { MarketplaceCheckoutModal } from "@/components/marketplace/marketplace-checkout-modal";
import { MarketplaceFeeBreakdown } from "@/components/marketplace/marketplace-fee-breakdown";
import { formatZar } from "@/lib/format-currency-zar";

type CateringProfile = {
  plainDescription: string;
  galleryUrls: string[];
  menuHighlights: string[];
  serviceTypes: string[];
  minHeadCount: number | null;
  maxHeadCount: number | null;
  logoUrl: string | null;
};

type Company = {
  id: string;
  companyName: string;
  tagline: string | null;
  description: string | null;
  city: string | null;
  country: string | null;
  specializations: string | null;
  logoUrl?: string | null;
  previewImageUrl?: string | null;
  profile?: CateringProfile;
  _count: { bookings: number };
};

type QuoteProfile = {
  pricePerHead: number | null;
  minOrder: number | null;
  minHeadCount: number | null;
  maxHeadCount: number | null;
  estimate: {
    headCount: number;
    subtotal: number;
    pricePerHead: number | null;
    minOrder: number | null;
  } | null;
};

type PayQuote = {
  baseAmount: number;
  feeAmount: number;
  totalAmount: number;
};

type Booking = {
  id: string;
  eventDate: string | null;
  headCount: number | null;
  status: string;
  quotedAmount: number | null;
  paymentTransactionId: string | null;
  payQuote: PayQuote | null;
  cateringCompany: { companyName: string; userId?: string };
};

export function CreatorCateringClient({ projectIdProp }: { projectIdProp?: string }) {
  const searchParams = useSearchParams();
  const projectId = projectIdProp ?? searchParams.get("projectId") ?? undefined;
  const { projectTitle } = useCreatorProjectContext({
    phase: "PRODUCTION",
    toolSlug: "on-set-catering",
    projectIdOverride: projectIdProp,
  });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"browse" | "my-bookings">("browse");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bookingForm, setBookingForm] = useState<{ companyId: string; eventDate: string; headCount: string; note: string }>({ companyId: "", eventDate: "", headCount: "", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [quoteProfiles, setQuoteProfiles] = useState<Record<string, QuoteProfile>>({});
  const [quoteLoadingId, setQuoteLoadingId] = useState<string | null>(null);
  const marketplacePay = useMarketplacePay({
    onPaid: () => {
      fetch("/api/catering-bookings")
        .then((r) => r.json())
        .then((b) => setBookings(Array.isArray(b) ? b : []));
    },
  });

  async function payBooking(bookingId: string) {
    setPayingId(bookingId);
    try {
      const result = await marketplacePay.pay(`/api/catering-bookings/${bookingId}/pay`);
      if (result?.mode === "wallet") {
        setBookings((prev) =>
          prev.map((x) =>
            x.id === bookingId ? { ...x, paymentTransactionId: result.data.transactionId ?? "paid" } : x,
          ),
        );
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPayingId(null);
    }
  }

  useEffect(() => {
    Promise.all([
      fetchMarketplaceList<Company>("/api/catering-companies"),
      fetch("/api/catering-bookings").then((r) => r.json()),
    ]).then(([cRes, b]) => {
      setCompanies(cRes.data);
      if (cRes.error) setLoadError(cRes.error);
      setBookings(Array.isArray(b) ? b : []);
    }).finally(() => setLoading(false));
  }, []);

  async function loadQuoteProfile(companyId: string, headCount?: number) {
    setQuoteLoadingId(companyId);
    try {
      const q = headCount && headCount > 0 ? `?headCount=${headCount}` : "";
      const res = await fetch(`/api/catering-companies/${companyId}/quote-profile${q}`);
      if (res.ok) {
        const data = (await res.json()) as QuoteProfile;
        setQuoteProfiles((prev) => ({ ...prev, [companyId]: data }));
      }
    } finally {
      setQuoteLoadingId(null);
    }
  }

  function toggleExpanded(companyId: string) {
    const next = expandedId === companyId ? null : companyId;
    setExpandedId(next);
    if (next && !quoteProfiles[next]) {
      const heads = bookingForm.companyId === next && bookingForm.headCount
        ? Number.parseInt(bookingForm.headCount, 10)
        : undefined;
      void loadQuoteProfile(next, heads);
    }
  }

  useEffect(() => {
    if (!expandedId || !bookingForm.headCount || bookingForm.companyId !== expandedId) return;
    const heads = Number.parseInt(bookingForm.headCount, 10);
    if (!Number.isFinite(heads) || heads <= 0) return;
    const timer = setTimeout(() => void loadQuoteProfile(expandedId, heads), 400);
    return () => clearTimeout(timer);
  }, [expandedId, bookingForm.headCount, bookingForm.companyId]);

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingForm.companyId) return;
    const heads = bookingForm.headCount ? Number.parseInt(bookingForm.headCount, 10) : null;
    const quote = quoteProfiles[bookingForm.companyId];
    if (heads != null && quote?.minHeadCount != null && heads < quote.minHeadCount) {
      setSubmitError(`Minimum head count is ${quote.minHeadCount}`);
      return;
    }
    if (heads != null && quote?.maxHeadCount != null && heads > quote.maxHeadCount) {
      setSubmitError(`Maximum head count is ${quote.maxHeadCount}`);
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const note =
        bookingForm.note ||
        (projectTitle ? `On-set catering for project: ${projectTitle}` : undefined);
      const { data, error } = await postMarketplaceJson<Booking>("/api/catering-bookings", {
        cateringCompanyId: bookingForm.companyId,
        eventDate: bookingForm.eventDate || undefined,
        headCount: bookingForm.headCount ? parseInt(bookingForm.headCount, 10) : undefined,
        note,
        projectId: projectId ?? undefined,
        projectTitle: projectTitle ?? undefined,
      });
      if (error || !data) {
        setSubmitError(error || "Could not send booking");
        return;
      }
      setBookings((prev) => [data, ...prev]);
      setBookingForm({ companyId: "", eventDate: "", headCount: "", note: "" });
      setTab("my-bookings");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <StoryTimeLoader size="sm" hideTrack />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <BackButton
        fallback={
          projectId
            ? `/creator/production/on-set-catering?projectId=${encodeURIComponent(projectId)}`
            : "/creator/dashboard"
        }
      />
      {projectId && (
        <CreatorProjectContextBanner
          phase="PRODUCTION"
          toolSlug="on-set-catering"
          accent="amber"
          projectIdOverride={projectIdProp}
        />
      )}
      {loadError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{loadError}</div>}
      {submitError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{submitError}</div>}
      <div>
        <h1 className="text-3xl font-semibold text-white mb-2 flex items-center gap-3">
          <UtensilsCrossed className="w-8 h-8 text-orange-500" /> Catering
        </h1>
        <p className="text-slate-400">Browse on-set catering catalogs, send free booking requests, and pay through Story Time once your order is confirmed.</p>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab("browse")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "browse" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>Browse caterers</button>
        <button onClick={() => setTab("my-bookings")} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === "my-bookings" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>My bookings</button>
      </div>

      {tab === "browse" && (
        <div className="space-y-4">
          {companies.length === 0 ? (
            <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-12 text-center text-slate-500">No catering companies listed yet.</div>
          ) : (
            companies.map((co) => {
              const logo = co.previewImageUrl || co.logoUrl || co.profile?.logoUrl;
              const desc = co.profile?.plainDescription || co.description;
              const gallery = co.profile?.galleryUrls ?? [];
              return (
              <div key={co.id} className="rounded-2xl bg-slate-800/30 border border-slate-700/50 overflow-hidden">
                {gallery.length >= 2 ? (
                  <div className="grid grid-cols-2 gap-0.5 bg-slate-900">
                    {gallery.slice(0, 4).map((url, i) => (
                      <img key={`${co.id}-${i}`} src={url} alt="" className={`w-full object-cover ${gallery.length === 2 ? "h-32" : "h-24"}`} />
                    ))}
                  </div>
                ) : gallery[0] && !logo ? (
                  <img src={gallery[0]} alt="" className="w-full h-32 object-cover" />
                ) : null}
                <div className="p-5 flex items-start justify-between gap-4">
                  {logo && <img src={logo} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white">{co.companyName}</h3>
                    {co.tagline && <p className="text-sm text-slate-400 mt-0.5">{co.tagline}</p>}
                    {(co.city || co.country) && (
                      <p className="text-xs text-slate-500 mt-2 flex items-center gap-1"><MapPin className="w-3 h-3" /> {[co.city, co.country].filter(Boolean).join(", ")}</p>
                    )}
                    {co.specializations && <p className="text-xs text-slate-500 mt-1">{co.specializations}</p>}
                  </div>
                  <button onClick={() => toggleExpanded(co.id)} className="p-2 text-slate-400 shrink-0">{expandedId === co.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}</button>
                </div>
                {expandedId === co.id && (
                  <div className="px-5 pb-5 border-t border-slate-700/50 pt-4">
                    {gallery.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto mb-4">
                        {gallery.slice(0, 8).map((url) => (
                          <img key={url} src={url} alt="" className="h-20 w-28 shrink-0 rounded-lg object-cover" />
                        ))}
                      </div>
                    )}
                    {co.profile?.menuHighlights && co.profile.menuHighlights.length > 0 && (
                      <p className="text-xs text-slate-400 mb-2">Menu: {co.profile.menuHighlights.join(" · ")}</p>
                    )}
                    {co.profile?.serviceTypes && co.profile.serviceTypes.length > 0 && (
                      <p className="text-xs text-slate-500 mb-3">{co.profile.serviceTypes.join(" · ")}</p>
                    )}
                    {desc && <p className="text-sm text-slate-400 mb-4">{desc}</p>}
                    {quoteLoadingId === co.id && (
                      <p className="text-xs text-slate-500 mb-3">Loading rates…</p>
                    )}
                    {quoteProfiles[co.id] && (
                      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3 mb-4 text-sm text-slate-300 space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Quote profile</p>
                        {quoteProfiles[co.id].pricePerHead != null && (
                          <p>Per person: {formatZar(quoteProfiles[co.id].pricePerHead!)}</p>
                        )}
                        {quoteProfiles[co.id].minOrder != null && (
                          <p>Minimum order: {formatZar(quoteProfiles[co.id].minOrder!)}</p>
                        )}
                        {quoteProfiles[co.id].estimate && quoteProfiles[co.id].estimate!.subtotal > 0 && (
                          <p className="text-orange-300">
                            Est. for {quoteProfiles[co.id].estimate!.headCount} people:{" "}
                            {formatZar(quoteProfiles[co.id].estimate!.subtotal)}
                          </p>
                        )}
                        {!quoteProfiles[co.id].pricePerHead && !quoteProfiles[co.id].minOrder && (
                          <p className="text-slate-500">Message the caterer for a custom quote.</p>
                        )}
                      </div>
                    )}
                    <form onSubmit={submitBooking} className="space-y-3 max-w-md">
                      <input type="hidden" name="companyId" value={co.id} />
                      <input type="date" placeholder="Event date" value={bookingForm.companyId === co.id ? bookingForm.eventDate : ""} onChange={(e) => setBookingForm((f) => ({ ...f, companyId: co.id, eventDate: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white" />
                      <input type="number" placeholder="Head count" value={bookingForm.companyId === co.id ? bookingForm.headCount : ""} onChange={(e) => setBookingForm((f) => ({ ...f, companyId: co.id, headCount: e.target.value }))} min={quoteProfiles[co.id]?.minHeadCount ?? 1} max={quoteProfiles[co.id]?.maxHeadCount ?? undefined} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder:text-slate-500" />
                      <textarea placeholder="Note / requirements" value={bookingForm.companyId === co.id ? bookingForm.note : ""} onChange={(e) => setBookingForm((f) => ({ ...f, companyId: co.id, note: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder:text-slate-500" rows={2} />
                      <button type="submit" disabled={submitting} className="px-4 py-2 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:opacity-50">Request booking</button>
                    </form>
                  </div>
                )}
              </div>
            );})
          )}
        </div>
      )}

      {tab === "my-bookings" && (
        <div className="space-y-4">
          {bookings.length === 0 ? (
            <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-12 text-center text-slate-500">No bookings yet. Browse caterers and request a booking.</div>
          ) : (
            bookings.map((b) => (
              <div key={b.id} className="rounded-xl bg-slate-800/30 border border-slate-700/50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{b.cateringCompany.companyName}</p>
                  <p className="text-sm text-slate-400">{b.eventDate ? new Date(b.eventDate).toLocaleDateString() : "—"} {b.headCount ? ` · ${b.headCount} people` : ""}</p>
                  {b.quotedAmount != null && b.quotedAmount > 0 && (
                    <p className="text-sm text-slate-400 mt-1">Order: {formatZar(b.quotedAmount)}</p>
                  )}
                  {b.status === "APPROVED" && !b.paymentTransactionId && b.payQuote ? (
                    <MarketplaceFeeBreakdown
                      baseAmount={b.payQuote.baseAmount}
                      feeAmount={b.payQuote.feeAmount}
                      totalAmount={b.payQuote.totalAmount}
                    />
                  ) : null}
                  <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded ${b.status === "PENDING" ? "bg-amber-500/20 text-amber-400" : b.status === "APPROVED" ? "bg-green-500/20 text-green-400" : "bg-slate-600/50 text-slate-400"}`}>{b.status}</span>
                  {b.paymentTransactionId && <span className="ml-2 text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300">Paid</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/creator/messages?catering=${b.id}`} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 text-sm font-medium">
                    <MessageSquare className="w-4 h-4" /> Message
                  </Link>
                  {b.status === "APPROVED" && !b.paymentTransactionId && (
                    <button
                      type="button"
                      disabled={payingId === b.id || !b.payQuote}
                      onClick={() => payBooking(b.id)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-sm font-medium disabled:opacity-50"
                    >
                      <CreditCard className="w-4 h-4" />{" "}
                      {payingId === b.id
                        ? "Processing…"
                        : b.payQuote
                          ? `Pay ${formatZar(b.payQuote.totalAmount)}`
                          : "Awaiting quote"}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
      <MarketplaceCheckoutModal
        open={marketplacePay.checkoutOpen}
        checkoutUrl={marketplacePay.checkoutUrl}
        onClose={marketplacePay.closeCheckout}
        title="Catering checkout"
        subtitle="Pay securely with PayFast to confirm your approved catering order."
      />
    </div>
  );
}
