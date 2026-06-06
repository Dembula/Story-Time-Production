"use client";

import { StoryTimeLoader, StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";
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
import { formatZar } from "@/lib/format-currency-zar";
import { useMarketplacePay } from "@/lib/hooks/use-marketplace-pay";
import { MarketplaceCheckoutModal } from "@/components/marketplace/marketplace-checkout-modal";

type CateringProfile = {
  plainDescription: string;
  galleryUrls: string[];
  menuHighlights: string[];
  serviceTypes: string[];
  pricePerHead: number | null;
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
  minOrder: number | null;
  contactEmail: string | null;
  logoUrl?: string | null;
  previewImageUrl?: string | null;
  profile?: CateringProfile;
  _count: { bookings: number };
};

type Booking = {
  id: string;
  eventDate: string | null;
  headCount: number | null;
  status: string;
  paymentTransactionId: string | null;
  cateringCompany: { companyName: string };
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

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingForm.companyId) return;
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
        <p className="text-slate-400">Book catering for your productions. Pay through the app to unlock messaging with the company.</p>
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
                {gallery[0] && !logo && <img src={gallery[0]} alt="" className="w-full h-32 object-cover" />}
                <div className="p-5 flex items-start justify-between gap-4">
                  {logo && <img src={logo} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white">{co.companyName}</h3>
                    {co.tagline && <p className="text-sm text-slate-400 mt-0.5">{co.tagline}</p>}
                    {(co.city || co.country) && (
                      <p className="text-xs text-slate-500 mt-2 flex items-center gap-1"><MapPin className="w-3 h-3" /> {[co.city, co.country].filter(Boolean).join(", ")}</p>
                    )}
                    {co.minOrder != null && <p className="text-xs text-slate-500">Min order: {formatZar(co.minOrder, { maximumFractionDigits: 0 })}</p>}
                    {co.profile?.pricePerHead != null && <p className="text-xs text-orange-300 mt-1">From {formatZar(co.profile.pricePerHead)}/head</p>}
                  </div>
                  <button onClick={() => setExpandedId(expandedId === co.id ? null : co.id)} className="p-2 text-slate-400 shrink-0">{expandedId === co.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}</button>
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
                    <form onSubmit={submitBooking} className="space-y-3 max-w-md">
                      <input type="hidden" name="companyId" value={co.id} />
                      <input type="date" placeholder="Event date" value={bookingForm.companyId === co.id ? bookingForm.eventDate : ""} onChange={(e) => setBookingForm((f) => ({ ...f, companyId: co.id, eventDate: e.target.value }))} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white" />
                      <input type="number" placeholder="Head count" value={bookingForm.companyId === co.id ? bookingForm.headCount : ""} onChange={(e) => setBookingForm((f) => ({ ...f, companyId: co.id, headCount: e.target.value }))} min={1} className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder:text-slate-500" />
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
              <div key={b.id} className="rounded-xl bg-slate-800/30 border border-slate-700/50 p-5 flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">{b.cateringCompany.companyName}</p>
                  <p className="text-sm text-slate-400">{b.eventDate ? new Date(b.eventDate).toLocaleDateString() : "—"} {b.headCount ? ` · ${b.headCount} people` : ""}</p>
                  <span className={`text-xs px-2 py-0.5 rounded ${b.status === "PENDING" ? "bg-amber-500/20 text-amber-400" : "bg-slate-600/50 text-slate-400"}`}>{b.status}</span>
                </div>
                {b.paymentTransactionId ? (
                  <Link href={`/creator/messages?catering=${b.id}`} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-sm font-medium">
                    <MessageSquare className="w-4 h-4" /> Message
                  </Link>
                ) : b.status === "APPROVED" ? (
                  <button
                    type="button"
                    disabled={payingId === b.id}
                    onClick={() => payBooking(b.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 text-sm font-medium disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4" /> {payingId === b.id ? "Processing…" : "Pay to unlock messaging"}
                  </button>
                ) : (
                  <span className="text-xs text-slate-500">Awaiting caterer approval</span>
                )}
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
      />
    </div>
  );
}
