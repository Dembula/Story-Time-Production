"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SecureImage } from "@/components/files/secure-image";
import { postMarketplaceJson } from "@/lib/creator-marketplace-fetch";
import { formatZar } from "@/lib/format-currency-zar";

export type LocationCatalogItem = {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  city: string | null;
  province?: string | null;
  country?: string | null;
  capacity: number | null;
  amenities?: string | null;
  availability?: string | null;
  photos?: string[];
  previewImageUrl?: string | null;
  profile?: {
    permitRequirements?: string | null;
    restrictions?: string | null;
    logistics?: string | null;
    availability?: string | null;
  };
  _count?: { bookings?: number };
};

type QuoteProfile = {
  dailyRate: number | null;
  hourlyRate: number | null;
  estimate: {
    startDate: string;
    endDate: string;
    days: number;
    subtotal: number;
    dailyRate: number | null;
  } | null;
};

type LocationMarketplaceCatalogProps = {
  listings: LocationCatalogItem[];
  isLoading?: boolean;
  projectId?: string;
  projectTitle?: string;
  onRequestSuccess?: (message: string) => void;
  compact?: boolean;
};

export function LocationMarketplaceCatalog({
  listings,
  isLoading,
  projectId,
  projectTitle,
  onRequestSuccess,
  compact,
}: LocationMarketplaceCatalogProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [quoteProfiles, setQuoteProfiles] = useState<Record<string, QuoteProfile>>({});
  const [quoteLoadingId, setQuoteLoadingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [requestForm, setRequestForm] = useState({
    locationId: "",
    shootType: "",
    startDate: "",
    endDate: "",
    crewSize: "",
    note: "",
  });

  async function loadQuoteProfile(locationId: string, startDate?: string, endDate?: string) {
    setQuoteLoadingId(locationId);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const q = params.toString() ? `?${params}` : "";
      const res = await fetch(`/api/locations/${locationId}/quote-profile${q}`);
      if (res.ok) {
        const data = (await res.json()) as QuoteProfile;
        setQuoteProfiles((prev) => ({ ...prev, [locationId]: data }));
      }
    } finally {
      setQuoteLoadingId(null);
    }
  }

  function toggleExpanded(locationId: string) {
    const next = expandedId === locationId ? null : locationId;
    setExpandedId(next);
    if (next && !quoteProfiles[next]) {
      void loadQuoteProfile(next);
    }
  }

  useEffect(() => {
    if (!expandedId || requestForm.locationId !== expandedId) return;
    const { startDate, endDate } = requestForm;
    if (!startDate || !endDate) return;
    const timer = setTimeout(() => void loadQuoteProfile(expandedId, startDate, endDate), 400);
    return () => clearTimeout(timer);
  }, [expandedId, requestForm.startDate, requestForm.endDate, requestForm.locationId]);

  async function submitRequest(e: React.FormEvent, locationId: string) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    const note =
      requestForm.note ||
      (projectTitle ? `Booking for project: ${projectTitle}` : undefined);
    const { error } = await postMarketplaceJson("/api/location-bookings", {
      locationId,
      shootType: requestForm.shootType || null,
      startDate: requestForm.startDate || null,
      endDate: requestForm.endDate || null,
      crewSize: requestForm.crewSize ? Number.parseInt(requestForm.crewSize, 10) : null,
      note,
      projectId: projectId ?? null,
      projectTitle: projectTitle ?? null,
    });
    setSubmitting(false);
    if (error) {
      setSubmitError(error);
      return;
    }
    setRequestForm({ locationId: "", shootType: "", startDate: "", endDate: "", crewSize: "", note: "" });
    setExpandedId(null);
    onRequestSuccess?.("Location booking request sent.");
  }

  if (isLoading) {
    return <Skeleton className={`${compact ? "h-24" : "h-32"} bg-slate-800/60`} />;
  }

  if (listings.length === 0) {
    return (
      <p className="text-xs text-slate-500 p-3 rounded-xl bg-slate-900/60">
        No listings found for current filters.
      </p>
    );
  }

  const cardClass = compact
    ? "rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden"
    : "rounded-2xl bg-slate-800/30 border border-slate-700/50 overflow-hidden";

  return (
    <div className="space-y-3">
      {submitError && (
        <p className="text-xs text-red-300 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
          {submitError}
        </p>
      )}
      <div className={compact ? "space-y-2 max-h-[28rem] overflow-y-auto pr-1" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
        {listings.map((loc) => {
          const gallery = loc.photos ?? [];
          const hero = loc.previewImageUrl || gallery[0];
          const isExpanded = expandedId === loc.id;
          const quote = quoteProfiles[loc.id];
          return (
            <div key={loc.id} className={cardClass}>
              {gallery.length >= 2 ? (
                <div className="grid grid-cols-2 gap-0.5 bg-slate-900">
                  {gallery.slice(0, 4).map((url, i) => (
                    <SecureImage
                      key={`${loc.id}-${i}`}
                      fileRef={url}
                      alt=""
                      className={`w-full object-cover ${gallery.length === 2 ? (compact ? "h-24" : "h-32") : compact ? "h-20" : "h-24"}`}
                    />
                  ))}
                </div>
              ) : hero ? (
                <SecureImage fileRef={hero} alt="" className={`w-full object-cover ${compact ? "h-24" : "h-32"}`} />
              ) : null}
              <div className={compact ? "p-3 space-y-2" : "p-5 space-y-3"}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`${compact ? "text-sm" : "text-lg"} text-white font-medium`}>{loc.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {loc.type} · {[loc.city, loc.country].filter(Boolean).join(", ") || "Unknown location"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleExpanded(loc.id)}
                    className="p-1 text-slate-400 shrink-0"
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
                {loc.description && (
                  <p className={`text-slate-400 line-clamp-2 ${compact ? "text-[11px]" : "text-sm"}`}>
                    {loc.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                  {loc.capacity != null && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {loc.capacity} max
                    </span>
                  )}
                  {loc.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {loc.city}
                    </span>
                  )}
                  {loc._count?.bookings != null && <span>{loc._count.bookings} bookings</span>}
                </div>
                {isExpanded && (
                  <div className="border-t border-slate-800 pt-3 space-y-3">
                    {gallery.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto">
                        {gallery.slice(0, 6).map((url) => (
                          <SecureImage key={url} fileRef={url} alt="" className="h-16 w-24 shrink-0 rounded-lg object-cover" />
                        ))}
                      </div>
                    )}
                    {loc.amenities && (
                      <p className="text-[11px] text-slate-400">
                        <span className="text-slate-500">Amenities:</span> {loc.amenities}
                      </p>
                    )}
                    {loc.profile?.permitRequirements && (
                      <p className="text-[11px] text-slate-400">Permit: {loc.profile.permitRequirements}</p>
                    )}
                    {loc.profile?.logistics && (
                      <p className="text-[11px] text-slate-400">Logistics: {loc.profile.logistics}</p>
                    )}
                    {loc.profile?.restrictions && (
                      <p className="text-[11px] text-slate-400">Rules: {loc.profile.restrictions}</p>
                    )}
                    {quoteLoadingId === loc.id && (
                      <p className="text-[11px] text-slate-500">Loading rates…</p>
                    )}
                    {quote && (
                      <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-3 text-[11px] text-slate-300 space-y-1">
                        <p className="font-medium uppercase tracking-wide text-slate-500">Quote profile</p>
                        {quote.dailyRate != null && <p>Daily: {formatZar(quote.dailyRate)}</p>}
                        {quote.hourlyRate != null && <p>Hourly: {formatZar(quote.hourlyRate)}</p>}
                        {quote.estimate && quote.estimate.subtotal > 0 && (
                          <p className="text-orange-300">
                            Est. {quote.estimate.days} day(s): {formatZar(quote.estimate.subtotal)}
                          </p>
                        )}
                        {!quote.dailyRate && !quote.hourlyRate && (
                          <p className="text-slate-500">Message the owner for a custom quote.</p>
                        )}
                      </div>
                    )}
                    <form onSubmit={(e) => submitRequest(e, loc.id)} className="space-y-2">
                      <input
                        type="hidden"
                        value={loc.id}
                        onChange={() => setRequestForm((f) => ({ ...f, locationId: loc.id }))}
                      />
                      <input
                        value={requestForm.locationId === loc.id ? requestForm.shootType : ""}
                        onChange={(e) => setRequestForm((f) => ({ ...f, locationId: loc.id, shootType: e.target.value }))}
                        placeholder="Shoot type"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={requestForm.locationId === loc.id ? requestForm.startDate : ""}
                          onChange={(e) => setRequestForm((f) => ({ ...f, locationId: loc.id, startDate: e.target.value }))}
                          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                        />
                        <input
                          type="date"
                          value={requestForm.locationId === loc.id ? requestForm.endDate : ""}
                          onChange={(e) => setRequestForm((f) => ({ ...f, locationId: loc.id, endDate: e.target.value }))}
                          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                        />
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={requestForm.locationId === loc.id ? requestForm.crewSize : ""}
                        onChange={(e) => setRequestForm((f) => ({ ...f, locationId: loc.id, crewSize: e.target.value }))}
                        placeholder="Crew size"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                      />
                      <textarea
                        value={requestForm.locationId === loc.id ? requestForm.note : ""}
                        onChange={(e) => setRequestForm((f) => ({ ...f, locationId: loc.id, note: e.target.value }))}
                        placeholder="Message / logistics note"
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={submitting}
                        className="bg-orange-500 hover:bg-orange-600 text-xs"
                      >
                        {submitting ? "Sending…" : "Request booking (free)"}
                      </Button>
                    </form>
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
