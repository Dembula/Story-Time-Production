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
import { Wrench, MapPin, ExternalLink, Send, Package, CheckCircle, MessageCircle, CreditCard, ChevronDown, ChevronUp } from "lucide-react";
import { formatZar } from "@/lib/format-currency-zar";
import { computeEquipmentRequestBaseZar } from "@/lib/equipment-request-base-zar";
import { computeMarketplaceFeeZar } from "@/lib/marketplace-zar-defaults";
import { useMarketplacePay } from "@/lib/hooks/use-marketplace-pay";
import { MarketplaceCheckoutModal } from "@/components/marketplace/marketplace-checkout-modal";
import { SecureImage } from "@/components/files/secure-image";

type Equipment = {
  id: string;
  companyName: string;
  description: string | null;
  plainDescription?: string | null;
  category: string;
  imageUrl?: string | null;
  previewImageUrl?: string | null;
  contactUrl: string | null;
  location: string | null;
  company: { id: string; name: string | null } | null;
  profile?: {
    dailyRate?: number | null;
    weeklyRate?: number | null;
    deposit?: number | null;
    specifications?: string | null;
    quantityAvailable?: number | null;
    availability?: string | null;
    galleryUrls?: string[];
  };
  photos?: string[];
};

type Request = {
  id: string;
  status: string;
  note: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  paymentTransactionId?: string | null;
  equipment: { companyName: string; category: string; description: string | null };
  company: { id: string; name: string | null };
  _count: { messages: number };
};

function EquipmentPageContent() {
  const { projectId, projectTitle } = useCreatorProjectContext({
    phase: "PRE_PRODUCTION",
    toolSlug: "equipment-planning",
  });
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"browse" | "requests">("browse");
  const [requesting, setRequesting] = useState<string | null>(null);
  const [form, setForm] = useState({ note: "", startDate: "", endDate: "" });
  const [success, setSuccess] = useState("");
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [quoteProfiles, setQuoteProfiles] = useState<Record<string, {
    dailyRate: number | null;
    weeklyRate: number | null;
    deposit: number | null;
    estimate: { days: number; subtotal: number } | null;
  }>>({});
  const [quoteLoadingId, setQuoteLoadingId] = useState<string | null>(null);
  const marketplacePay = useMarketplacePay({
    onPaid: () => {
      fetch("/api/equipment-requests")
        .then((r) => r.json())
        .then((reqs) => setRequests(Array.isArray(reqs) ? reqs : []));
    },
  });

  const prefillNote = useCallback(
    (title: string) => {
      setForm((f) => (f.note.trim() ? f : { ...f, note: `Rental for project: ${title}` }));
    },
    [],
  );
  usePrefillProjectName(projectTitle, prefillNote);

  async function loadQuoteProfile(equipmentId: string, startDate?: string, endDate?: string) {
    setQuoteLoadingId(equipmentId);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const q = params.toString() ? `?${params}` : "";
      const res = await fetch(`/api/equipment/${equipmentId}/quote-profile${q}`);
      if (res.ok) {
        const data = await res.json();
        setQuoteProfiles((prev) => ({ ...prev, [equipmentId]: data }));
      }
    } finally {
      setQuoteLoadingId(null);
    }
  }

  useEffect(() => {
    if (!expandedId || requesting !== expandedId) return;
    const { startDate, endDate } = form;
    if (!startDate || !endDate) return;
    const timer = setTimeout(() => void loadQuoteProfile(expandedId, startDate, endDate), 400);
    return () => clearTimeout(timer);
  }, [expandedId, requesting, form.startDate, form.endDate]);

  useEffect(() => {
    Promise.all([
      fetchMarketplaceList<Equipment>("/api/equipment"),
      fetch("/api/equipment-requests").then((r) => r.json()),
    ]).then(([equipRes, reqs]) => {
      setEquipment(equipRes.data);
      if (equipRes.error) setLoadError(equipRes.error);
      setRequests(Array.isArray(reqs) ? reqs : []);
      setLoading(false);
    });
  }, []);

  const categories = [...new Set(equipment.map((e) => e.category))].sort();

  async function submitRequest(equipmentId: string) {
    setSubmitError("");
    const note = form.note || (projectTitle ? `Rental for project: ${projectTitle}` : "");
    const { data: req, error } = await postMarketplaceJson<Request & { equipment?: Request["equipment"] }>(
      "/api/equipment-requests",
      {
        equipmentId,
        note,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        projectId: projectId ?? null,
        projectTitle: projectTitle ?? null,
      },
    );
    if (error || !req) {
      setSubmitError(error || "Could not send request");
      return;
    }
    const listing = equipment.find((e) => e.id === equipmentId);
    setRequests((prev) => [
      {
        ...req,
        _count: { messages: 0 },
        company: listing?.company || { id: "", name: "" },
        equipment: req.equipment ?? listing ?? {
          companyName: "",
          category: "",
          description: null,
        },
      },
      ...prev,
    ]);
    setRequesting(null);
    setForm({
      note: projectTitle ? `Rental for project: ${projectTitle}` : "",
      startDate: "",
      endDate: "",
    });
    setSuccess("Request sent successfully!");
    setTimeout(() => setSuccess(""), 3000);
  }

  async function payRequest(requestId: string) {
    setPayingId(requestId);
    try {
      const result = await marketplacePay.pay(`/api/equipment-requests/${requestId}/pay`);
      if (result?.mode === "wallet") {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === requestId ? { ...r, paymentTransactionId: result.data.transactionId ?? "paid" } : r,
          ),
        );
        const total =
          typeof result.data.totalAmount === "number" ? formatZar(result.data.totalAmount) : "paid";
        setSuccess(`Payment recorded (${total} incl. platform fee).`);
        setTimeout(() => setSuccess(""), 5000);
      }
    } catch (e) {
      setSuccess("");
      alert(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPayingId(null);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <StoryTimeLoader size="sm" hideTrack />
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <BackButton
        fallback={
          projectId ? `/creator/pre/equipment-planning?projectId=${encodeURIComponent(projectId)}` : "/creator/dashboard"
        }
      />
      <CreatorProjectContextBanner phase="PRE_PRODUCTION" toolSlug="equipment-planning" accent="orange" />
      {loadError && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{loadError}</div>}
      {submitError && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{submitError}</div>}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white mb-2 tracking-tight flex items-center gap-3">
            <Wrench className="w-8 h-8 text-orange-500" />
            Equipment Repository
          </h1>
          <p className="text-slate-400">Browse equipment catalogs with photos. Send free rental inquiries, then pay once the company approves your request.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab("browse")} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "browse" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>
            Browse Equipment
          </button>
          <button onClick={() => setTab("requests")} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "requests" ? "bg-orange-500 text-white" : "bg-slate-800/50 text-slate-400 border border-slate-700/50"}`}>
            My Requests ({requests.length})
          </button>
        </div>
      </div>

      {success && (
        <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> {success}
        </div>
      )}

      {tab === "browse" ? (
        <div className="space-y-10">
          {categories.map((category) => (
            <div key={category}>
              <h2 className="text-xl font-semibold text-white mb-4">{category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {equipment.filter((e) => e.category === category).map((e) => {
                  const gallery = e.photos?.length
                    ? e.photos
                    : e.profile?.galleryUrls?.length
                      ? e.profile.galleryUrls
                      : e.previewImageUrl || e.imageUrl
                        ? [e.previewImageUrl || e.imageUrl!]
                        : [];
                  const thumb = gallery[0];
                  const desc = e.plainDescription || e.description;
                  const isExpanded = expandedId === e.id;
                  const quote = quoteProfiles[e.id];
                  return (
                  <div key={e.id} className="rounded-2xl bg-slate-800/30 border border-slate-700/50 hover:border-orange-500/30 transition overflow-hidden">
                    {gallery.length >= 2 ? (
                      <div className="grid grid-cols-2 gap-0.5 bg-slate-900">
                        {gallery.slice(0, 4).map((url, i) => (
                          <SecureImage key={`${e.id}-${i}`} fileRef={url} alt="" className={`w-full object-cover ${gallery.length === 2 ? "h-36" : "h-24"}`} />
                        ))}
                      </div>
                    ) : thumb ? (
                      <SecureImage fileRef={thumb} alt="" className="w-full h-36 object-cover" />
                    ) : (
                      <div className="h-28 flex items-center justify-center bg-slate-800/60">
                        <Package className="w-10 h-10 text-slate-600" />
                      </div>
                    )}
                    <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{e.companyName}</h3>
                        {e.company?.name && <p className="text-xs text-orange-400">{e.company.name}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = isExpanded ? null : e.id;
                          setExpandedId(next);
                          if (next && !quoteProfiles[next]) void loadQuoteProfile(next);
                        }}
                        className="p-1 text-slate-400"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                    {desc && <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">{desc}</p>}
                    {e.profile?.specifications && <p className="text-xs text-slate-500">{e.profile.specifications}</p>}
                    <div className="flex flex-wrap gap-3 text-xs">
                      {e.location && <span className="flex items-center gap-1 text-slate-500"><MapPin className="w-3 h-3" /> {e.location}</span>}
                      {e.contactUrl && <a href={e.contactUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-orange-400 hover:text-orange-300"><ExternalLink className="w-3 h-3" /> Website</a>}
                    </div>

                    {isExpanded && (
                      <div className="pt-3 border-t border-slate-700/50 space-y-2">
                        {quoteLoadingId === e.id && <p className="text-xs text-slate-500">Loading rates…</p>}
                        {quote && (
                          <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3 text-sm text-slate-300 space-y-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Quote profile</p>
                            {quote.dailyRate != null && <p>Daily: {formatZar(quote.dailyRate)}</p>}
                            {quote.weeklyRate != null && <p>Weekly: {formatZar(quote.weeklyRate)}</p>}
                            {quote.deposit != null && <p>Deposit: {formatZar(quote.deposit)}</p>}
                            {quote.estimate && quote.estimate.subtotal > 0 && (
                              <p className="text-orange-300">Est. {quote.estimate.days} day(s): {formatZar(quote.estimate.subtotal)}</p>
                            )}
                            {!quote.dailyRate && !quote.weeklyRate && (
                              <p className="text-slate-500">Message the company for a custom quote.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {e.company?.id ? (
                      requesting === e.id ? (
                        <div className="mt-3 space-y-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                          <textarea
                            value={form.note}
                            onChange={(ev) => setForm({ ...form, note: ev.target.value })}
                            placeholder="Note for the company (optional)"
                            rows={2}
                            className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input type="date" value={form.startDate} onChange={(ev) => setForm({ ...form, startDate: ev.target.value })} className="px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm" />
                            <input type="date" value={form.endDate} onChange={(ev) => setForm({ ...form, endDate: ev.target.value })} className="px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => submitRequest(e.id)} className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition flex items-center justify-center gap-1.5">
                              <Send className="w-3.5 h-3.5" /> Send Request
                            </button>
                            <button onClick={() => setRequesting(null)} className="px-3 py-2 bg-slate-700/50 text-slate-400 rounded-lg text-sm hover:bg-slate-600/50 transition">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setRequesting(e.id); setExpandedId(e.id); if (!quoteProfiles[e.id]) void loadQuoteProfile(e.id); }} className="w-full mt-2 py-2 rounded-lg text-sm font-medium bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20 transition flex items-center justify-center gap-1.5">
                          <Send className="w-3.5 h-3.5" /> Request Equipment
                        </button>
                      )
                    ) : (
                      <p className="text-xs text-slate-600 mt-2 italic">Not available for direct requests</p>
                    )}
                    </div>
                  </div>
                );})}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-10 text-center">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No equipment requests yet.</p>
              <button onClick={() => setTab("browse")} className="mt-3 text-orange-400 text-sm hover:underline">Browse equipment</button>
            </div>
          ) : (
            requests.map((r) => {
              const base = computeEquipmentRequestBaseZar({
                equipmentDescription: r.equipment.description,
                startDate: r.startDate,
                endDate: r.endDate,
              });
              const fee = computeMarketplaceFeeZar(base);
              const estTotal = Math.round((base + fee) * 100) / 100;
              const canPay = r.status === "APPROVED" && !r.paymentTransactionId;
              const paid = Boolean(r.paymentTransactionId);
              return (
              <div key={r.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="text-white font-medium">{r.equipment.companyName} — {r.equipment.category}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.status === "PENDING" ? "bg-yellow-500/10 text-yellow-400" :
                        r.status === "APPROVED" ? "bg-green-500/10 text-green-400" :
                        "bg-red-500/10 text-red-400"
                      }`}>{r.status}</span>
                      {paid && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Paid</span>}
                    </div>
                    <p className="text-sm text-slate-400">To: <span className="text-orange-400">{r.company.name || "Company"}</span></p>
                    {r.note && <p className="text-sm text-slate-500 mt-1 italic">&quot;{r.note}&quot;</p>}
                    {r.startDate && <p className="text-xs text-slate-500 mt-1">Dates: {r.startDate} — {r.endDate || "TBD"}</p>}
                    <p className="text-xs text-slate-500 mt-1">{r._count.messages} messages &middot; {new Date(r.createdAt).toLocaleDateString()}</p>
                    {canPay && (
                      <p className="text-xs text-slate-400 mt-2">
                        Checkout: {formatZar(base)} + fee {formatZar(fee)} = <span className="text-orange-300 font-medium">{formatZar(estTotal)}</span> (wallet or PayFast)
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col sm:items-end gap-2 shrink-0">
                    <a
                      href={`/creator/messages?requestId=${r.id}&companyId=${r.company.id}`}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition text-sm"
                    >
                      <MessageCircle className="w-4 h-4" /> Message
                    </a>
                    {canPay && (
                      <button
                        type="button"
                        disabled={payingId === r.id}
                        onClick={() => payRequest(r.id)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition text-sm font-medium disabled:opacity-50"
                      >
                        <CreditCard className="w-4 h-4" /> {payingId === r.id ? "Processing…" : "Confirm & pay"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );})
          )}
        </div>
      )}
      <MarketplaceCheckoutModal
        open={marketplacePay.checkoutOpen}
        checkoutUrl={marketplacePay.checkoutUrl}
        onClose={marketplacePay.closeCheckout}
        title="Equipment rental checkout"
      />
    </div>
  );
}

export default function EquipmentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
      <EquipmentPageContent />
    </Suspense>
  );
}
