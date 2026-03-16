"use client";

import { useEffect, useState } from "react";
import { BackButton } from "@/components/layout/back-button";
import { MapPin, DollarSign, Users, ChevronDown, ChevronUp, Send, MessageCircle, CheckCircle, Calendar } from "lucide-react";

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
  rules: string | null;
  availability: string | null;
  contactUrl: string | null;
  company: { id: string; name: string | null } | null;
  _count: { bookings: number };
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
  location: { id: string; name: string; type: string; city: string | null; dailyRate: number | null; company: { id: string; name: string | null } };
  owner: { id: string; name: string | null; email: string | null };
  _count: { messages: number };
};

export default function CreatorLocationsPage() {
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

  useEffect(() => {
    Promise.all([
      fetch("/api/locations").then(async (r) => {
        const data = await r.json();
        if (r.status === 503 && data.error) throw new Error(data.error);
        return Array.isArray(data) ? data : [];
      }),
      fetch("/api/location-bookings").then(async (r) => {
        const data = await r.json();
        if (r.status === 503 && data.error) throw new Error(data.error);
        return Array.isArray(data) ? data : [];
      }),
    ])
      .then(([locs, bks]) => {
        setLocations(locs);
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
    const res = await fetch("/api/location-bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId,
        shootType: bookForm.shootType || null,
        startDate: bookForm.startDate || null,
        endDate: bookForm.endDate || null,
        crewSize: bookForm.crewSize ? parseInt(bookForm.crewSize, 10) : null,
        note: bookForm.note || null,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      const newBooking = await res.json();
      setBookings((prev) => [{ ...newBooking, _count: { messages: 0 } }, ...prev]);
      setBookingForId(null);
      setBookForm({ shootType: "", startDate: "", endDate: "", crewSize: "", note: "" });
      setSuccess("Booking request sent!");
      setTimeout(() => setSuccess(""), 3000);
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
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
      <BackButton fallback="/creator/dashboard" />
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white mb-2 tracking-tight flex items-center gap-3">
            <MapPin className="w-8 h-8 text-orange-500" />
            Location Repository
          </h1>
          <p className="text-slate-400">Book shoot locations for your films, shows, and projects</p>
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
              const firstPhoto = loc.photoUrls?.split(/[\n,]/)[0]?.trim();
              const isExpanded = expandedId === loc.id;
              const showBookForm = bookingForId === loc.id;
              return (
                <div key={loc.id} className="rounded-2xl bg-slate-800/30 border border-slate-700/50 overflow-hidden hover:border-orange-500/30 transition">
                  {firstPhoto && <img src={firstPhoto} alt="" className="w-full h-40 object-cover" />}
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-semibold text-white">{loc.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">{loc.type}</span>
                    </div>
                    {loc.city && <p className="text-sm text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> {loc.city}{loc.province ? `, ${loc.province}` : ""}</p>}
                    {loc.description && <p className="text-sm text-slate-400 line-clamp-2">{loc.description}</p>}
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                      {loc.capacity != null && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {loc.capacity} max</span>}
                      {loc.dailyRate != null && <span className="flex items-center gap-1 text-orange-400"><DollarSign className="w-3 h-3" /> ${loc.dailyRate}/day</span>}
                    </div>
                    <button onClick={() => setExpandedId(isExpanded ? null : loc.id)} className="flex items-center gap-1 text-sm text-orange-400 hover:text-orange-300">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} {isExpanded ? "Less" : "More details"}
                    </button>
                    {isExpanded && (
                      <div className="pt-3 border-t border-slate-700/50 space-y-2 text-sm">
                        {loc.amenities && <p><span className="text-slate-500">Amenities:</span> {loc.amenities}</p>}
                        {loc.rules && <p><span className="text-slate-500">Rules:</span> {loc.rules}</p>}
                        {loc.availability && <p><span className="text-slate-500">Availability:</span> {loc.availability}</p>}
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
                </div>
                <p className="text-sm text-slate-400">{b.location.company?.name && <span>{b.location.company.name} · </span>}{b.location.city}</p>
                {b.startDate && <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> {b.startDate} — {b.endDate || "TBD"}</p>}
                <p className="text-xs text-slate-500 mt-1">{b._count.messages} messages</p>
              </div>
              <a href={`/creator/messages?tab=locations&bookingId=${b.id}`} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/30 text-sm hover:bg-orange-500/20 transition">
                <MessageCircle className="w-4 h-4" /> Chat
              </a>
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
    </div>
  );
}
