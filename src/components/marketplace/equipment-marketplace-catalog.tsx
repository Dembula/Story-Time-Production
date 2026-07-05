"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, MapPin, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SecureImage } from "@/components/files/secure-image";
import { formatZar } from "@/lib/format-currency-zar";

export type EquipmentCatalogItem = {
  id: string;
  name?: string;
  companyName: string;
  plainDescription?: string | null;
  category: string;
  location: string | null;
  previewImageUrl?: string | null;
  photos?: string[];
  company?: { id: string; name: string | null } | null;
  profile?: {
    specifications?: string | null;
    quantityAvailable?: number | null;
    availability?: string | null;
    galleryUrls?: string[];
  };
};

type QuoteProfile = {
  dailyRate: number | null;
  weeklyRate: number | null;
  deposit: number | null;
  estimate: {
    startDate: string;
    endDate: string;
    days: number;
    subtotal: number;
    dailyRate: number | null;
  } | null;
};

type EquipmentMarketplaceCatalogProps = {
  listings: EquipmentCatalogItem[];
  isLoading?: boolean;
  projectId?: string;
  projectTitle?: string;
  onRequestSuccess?: (message: string) => void;
  compact?: boolean;
};

export function EquipmentMarketplaceCatalog({
  listings,
  isLoading,
  projectId,
  projectTitle,
  onRequestSuccess,
  compact = true,
}: EquipmentMarketplaceCatalogProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [quoteProfiles, setQuoteProfiles] = useState<Record<string, QuoteProfile>>({});
  const [quoteLoadingId, setQuoteLoadingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [requestForm, setRequestForm] = useState({
    equipmentId: "",
    startDate: "",
    endDate: "",
    note: "",
  });

  async function loadQuoteProfile(equipmentId: string, startDate?: string, endDate?: string) {
    setQuoteLoadingId(equipmentId);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const q = params.toString() ? `?${params}` : "";
      const res = await fetch(`/api/equipment/${equipmentId}/quote-profile${q}`);
      if (res.ok) {
        const data = (await res.json()) as QuoteProfile;
        setQuoteProfiles((prev) => ({ ...prev, [equipmentId]: data }));
      }
    } finally {
      setQuoteLoadingId(null);
    }
  }

  function toggleExpanded(equipmentId: string) {
    const next = expandedId === equipmentId ? null : equipmentId;
    setExpandedId(next);
    if (next && !quoteProfiles[next]) {
      void loadQuoteProfile(next);
    }
  }

  useEffect(() => {
    if (!expandedId || requestForm.equipmentId !== expandedId) return;
    const { startDate, endDate } = requestForm;
    if (!startDate || !endDate) return;
    const timer = setTimeout(() => void loadQuoteProfile(expandedId, startDate, endDate), 400);
    return () => clearTimeout(timer);
  }, [expandedId, requestForm.startDate, requestForm.endDate, requestForm.equipmentId]);

  async function submitRequest(e: React.FormEvent, equipmentId: string) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    const note =
      requestForm.note ||
      (projectTitle ? `Equipment request for project: ${projectTitle}` : undefined);
    const res = await fetch("/api/equipment-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equipmentId,
        note: note ?? null,
        startDate: requestForm.startDate || null,
        endDate: requestForm.endDate || null,
        projectId: projectId ?? null,
        projectTitle: projectTitle ?? null,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      setSubmitError(err?.error || "Failed to send request");
      return;
    }
    setRequestForm({ equipmentId: "", startDate: "", endDate: "", note: "" });
    setExpandedId(null);
    onRequestSuccess?.("Equipment request sent.");
  }

  if (isLoading) {
    return <Skeleton className="h-24 bg-slate-800/60" />;
  }

  if (listings.length === 0) {
    return <p className="text-xs text-slate-500">No marketplace listings match your filters.</p>;
  }

  const displayName = (item: EquipmentCatalogItem) => item.name || item.companyName;

  return (
    <div className="space-y-3">
      {submitError && (
        <p className="text-xs text-red-300 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
          {submitError}
        </p>
      )}
      <div className={compact ? "space-y-2 max-h-64 overflow-y-auto pr-1" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}>
        {listings.map((item) => {
          const gallery =
            item.photos?.length
              ? item.photos
              : item.profile?.galleryUrls?.length
                ? item.profile.galleryUrls
                : item.previewImageUrl
                  ? [item.previewImageUrl]
                  : [];
          const hero = gallery[0];
          const isExpanded = expandedId === item.id;
          const quote = quoteProfiles[item.id];
          const canRequest = Boolean(item.company?.id);
          return (
            <div
              key={item.id}
              className={
                compact
                  ? "rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden"
                  : "rounded-2xl bg-slate-800/30 border border-slate-700/50 overflow-hidden"
              }
            >
              {gallery.length >= 2 ? (
                <div className="grid grid-cols-2 gap-0.5 bg-slate-900">
                  {gallery.slice(0, 4).map((url, i) => (
                    <SecureImage
                      key={`${item.id}-${i}`}
                      fileRef={url}
                      alt=""
                      className={`w-full object-cover ${gallery.length === 2 ? "h-24" : "h-20"}`}
                    />
                  ))}
                </div>
              ) : hero ? (
                <SecureImage fileRef={hero} alt="" className="w-full h-24 object-cover" />
              ) : (
                <div className="h-20 flex items-center justify-center bg-slate-800/60">
                  <Package className="w-8 h-8 text-slate-600" />
                </div>
              )}
              <div className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium">{displayName(item)}</p>
                    <p className="text-[11px] text-slate-500">
                      {item.category}
                      {item.location ? ` · ${item.location}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleExpanded(item.id)}
                    className="p-1 text-slate-400 shrink-0"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
                {(item.plainDescription || item.profile?.specifications) && (
                  <p className="text-[11px] text-slate-400 line-clamp-2">
                    {item.plainDescription || item.profile?.specifications}
                  </p>
                )}
                {item.location && (
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {item.location}
                  </p>
                )}
                {isExpanded && (
                  <div className="border-t border-slate-800 pt-2 space-y-2">
                    {gallery.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto">
                        {gallery.slice(0, 6).map((url) => (
                          <SecureImage key={url} fileRef={url} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
                        ))}
                      </div>
                    )}
                    {item.profile?.specifications && (
                      <p className="text-[11px] text-slate-400">{item.profile.specifications}</p>
                    )}
                    {quoteLoadingId === item.id && (
                      <p className="text-[11px] text-slate-500">Loading rates…</p>
                    )}
                    {quote && (
                      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-2 text-[11px] text-slate-300 space-y-1">
                        <p className="font-medium uppercase tracking-wide text-slate-500">Quote profile</p>
                        {quote.dailyRate != null && <p>Daily: {formatZar(quote.dailyRate)}</p>}
                        {quote.weeklyRate != null && <p>Weekly: {formatZar(quote.weeklyRate)}</p>}
                        {quote.deposit != null && <p>Deposit: {formatZar(quote.deposit)}</p>}
                        {quote.estimate && quote.estimate.subtotal > 0 && (
                          <p className="text-orange-300">
                            Est. {quote.estimate.days} day(s): {formatZar(quote.estimate.subtotal)}
                          </p>
                        )}
                        {!quote.dailyRate && !quote.weeklyRate && (
                          <p className="text-slate-500">Message the company for a custom quote.</p>
                        )}
                      </div>
                    )}
                    {canRequest ? (
                      <form onSubmit={(e) => submitRequest(e, item.id)} className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="date"
                            value={requestForm.equipmentId === item.id ? requestForm.startDate : ""}
                            onChange={(e) =>
                              setRequestForm((f) => ({ ...f, equipmentId: item.id, startDate: e.target.value }))
                            }
                            className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                          />
                          <input
                            type="date"
                            value={requestForm.equipmentId === item.id ? requestForm.endDate : ""}
                            onChange={(e) =>
                              setRequestForm((f) => ({ ...f, equipmentId: item.id, endDate: e.target.value }))
                            }
                            className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                          />
                        </div>
                        <textarea
                          value={requestForm.equipmentId === item.id ? requestForm.note : ""}
                          onChange={(e) =>
                            setRequestForm((f) => ({ ...f, equipmentId: item.id, note: e.target.value }))
                          }
                          placeholder="Note / requirements"
                          rows={2}
                          className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                        />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          disabled={submitting}
                          className="h-7 border-slate-700 px-2 text-[10px]"
                        >
                          {submitting ? "Sending…" : "Request (free)"}
                        </Button>
                      </form>
                    ) : (
                      <p className="text-[10px] text-slate-600 italic">Not available for direct requests</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
