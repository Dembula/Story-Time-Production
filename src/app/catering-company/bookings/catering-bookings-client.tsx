"use client";

import { StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, User, CheckCircle, XCircle, MessageSquare } from "lucide-react";
import { formatZar } from "@/lib/format-currency-zar";

type Booking = {
  id: string;
  eventDate: string | null;
  headCount: number | null;
  status: string;
  note: string | null;
  quotedAmount: number | null;
  creator: { id: string; name: string | null; email: string | null };
  _count?: { messages: number };
};

export function CateringBookingsClient() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [quoteInputs, setQuoteInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/catering-bookings")
      .then((r) => r.json())
      .then((b) => setBookings(Array.isArray(b) ? b : []))
      .finally(() => setLoading(false));
  }, []);

  async function handleStatus(id: string, status: string) {
    setUpdating(id);
    const quoteRaw = quoteInputs[id]?.trim();
    const quotedAmount = quoteRaw ? Number.parseFloat(quoteRaw) : undefined;
    const res = await fetch("/api/catering-bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        status,
        ...(status === "APPROVED" && quotedAmount != null && quotedAmount > 0 ? { quotedAmount } : {}),
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, ...updated } : b)));
    } else {
      const err = await res.json().catch(() => ({}));
      alert((err as { error?: string }).error || "Could not update booking");
    }
    setUpdating(null);
  }

  if (loading) return <StoryTimeLoadingCenter />;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold text-white mb-8">Bookings</h1>
      {bookings.length === 0 ? (
        <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-12 text-center text-slate-500">
          No bookings yet.
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => (
            <div
              key={b.id}
              className="rounded-xl bg-slate-800/30 border border-slate-700/50 p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
            >
              <div className="flex-1 space-y-2">
                <p className="font-medium text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" /> {b.creator.name || b.creator.email || "—"}
                </p>
                <p className="text-sm text-slate-400 flex items-center gap-2">
                  <Calendar className="w-3 h-3" />{" "}
                  {b.eventDate ? new Date(b.eventDate).toLocaleDateString() : "—"}{" "}
                  {b.headCount ? ` · ${b.headCount} people` : ""}
                </p>
                {b.note && <p className="text-sm text-slate-500">{b.note}</p>}
                {b.quotedAmount != null && b.quotedAmount > 0 && (
                  <p className="text-sm text-emerald-400">Quoted: {formatZar(b.quotedAmount)}</p>
                )}
                <span
                  className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                    b.status === "PENDING"
                      ? "bg-amber-500/20 text-amber-400"
                      : b.status === "APPROVED"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-slate-600/50 text-slate-400"
                  }`}
                >
                  {b.status}
                </span>
              </div>
              <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
                <Link
                  href={`/catering-company/messages?bookingId=${b.id}`}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 text-sm font-medium"
                >
                  <MessageSquare className="w-4 h-4" /> Message
                  {b._count && b._count.messages > 0 ? ` (${b._count.messages})` : ""}
                </Link>
                {b.status === "PENDING" && (
                  <div className="flex flex-col gap-2 w-full sm:w-48">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Custom quote (ZAR, optional)"
                      value={quoteInputs[b.id] ?? ""}
                      onChange={(e) => setQuoteInputs((prev) => ({ ...prev, [b.id]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm placeholder:text-slate-500"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleStatus(b.id, "APPROVED")}
                        disabled={updating === b.id}
                        className="flex-1 flex items-center justify-center gap-1 p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-50 text-sm"
                        title="Approve — uses profile rates if no custom quote"
                      >
                        <CheckCircle className="w-4 h-4" /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatus(b.id, "DECLINED")}
                        disabled={updating === b.id}
                        className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                        title="Decline"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
