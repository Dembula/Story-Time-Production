"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UtensilsCrossed, MapPin, ChevronDown, ChevronUp, MessageSquare, CreditCard } from "lucide-react";
import { formatZar } from "@/lib/format-currency-zar";

function PayButton({ bookingId, onPaid }: { bookingId: string; onPaid: () => void }) {
  const [loading, setLoading] = useState(false);
  async function pay() {
    setLoading(true);
    try {
      const res = await fetch(`/api/catering-bookings/${bookingId}/pay`, { method: "POST" });
      if (res.ok) onPaid();
    } finally {
      setLoading(false);
    }
  }
  return (
    <button onClick={pay} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 text-sm font-medium disabled:opacity-50">
      <CreditCard className="w-4 h-4" /> {loading ? "Processing…" : "Pay to unlock messaging"}
    </button>
  );
}

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

export function CreatorCateringClient() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"browse" | "my-bookings">("browse");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bookingForm, setBookingForm] = useState<{ companyId: string; eventDate: string; headCount: string; note: string }>({ companyId: "", eventDate: "", headCount: "", note: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/catering-companies").then((r) => r.json()),
      fetch("/api/catering-bookings").then((r) => r.json()),
    ]).then(([c, b]) => {
      setCompanies(c);
      setBookings(Array.isArray(b) ? b : []);
    }).finally(() => setLoading(false));
  }, []);

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingForm.companyId) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/catering-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cateringCompanyId: bookingForm.companyId,
          eventDate: bookingForm.eventDate || undefined,
          headCount: bookingForm.headCount ? parseInt(bookingForm.headCount, 10) : undefined,
          note: bookingForm.note || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setBookings((prev) => [data, ...prev]);
        setBookingForm({ companyId: "", eventDate: "", headCount: "", note: "" });
        setTab("my-bookings");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
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
            companies.map((co) => (
              <div key={co.id} className="rounded-2xl bg-slate-800/30 border border-slate-700/50 overflow-hidden">
                <div className="p-5 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{co.companyName}</h3>
                    {co.tagline && <p className="text-sm text-slate-400 mt-0.5">{co.tagline}</p>}
                    {(co.city || co.country) && (
                      <p className="text-xs text-slate-500 mt-2 flex items-center gap-1"><MapPin className="w-3 h-3" /> {[co.city, co.country].filter(Boolean).join(", ")}</p>
                    )}
                    {co.minOrder != null && <p className="text-xs text-slate-500">Min order: {formatZar(co.minOrder, { maximumFractionDigits: 0 })}</p>}
                  </div>
                  <button onClick={() => setExpandedId(expandedId === co.id ? null : co.id)} className="p-2 text-slate-400">{expandedId === co.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}</button>
                </div>
                {expandedId === co.id && (
                  <div className="px-5 pb-5 border-t border-slate-700/50 pt-4">
                    {co.description && <p className="text-sm text-slate-400 mb-4">{co.description}</p>}
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
            ))
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
                ) : (
                  <PayButton bookingId={b.id} onPaid={() => { setBookings((prev) => prev.map((x) => x.id === b.id ? { ...x, paymentTransactionId: "done" } : x)); setTab("my-bookings"); }} />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
