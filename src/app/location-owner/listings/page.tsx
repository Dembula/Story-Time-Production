"use client";

import { useEffect, useState } from "react";
import { MapPin, Plus, Tag, DollarSign, Users, Image, Upload } from "lucide-react";
import { uploadContentMediaViaApi } from "@/lib/upload-content-media-client";

const LOCATION_TYPES = ["Studio", "House", "Warehouse", "Outdoor", "Office", "Historical", "Restaurant", "Other"];
const AMENITIES_OPTIONS = ["Parking", "Power", "WiFi", "Restrooms", "Green Room", "Kitchen", "AC", "Security", "Loading Dock", "Wardrobe"];

interface Listing {
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
  createdAt: string;
}

export default function LocationListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "Studio",
    address: "",
    city: "",
    province: "",
    country: "",
    capacity: "",
    dailyRate: "",
    amenities: "" as string,
    photoUrls: "",
    rules: "",
    availability: "",
    contactUrl: "",
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const publicUrl = await uploadContentMediaViaApi(file);
      setForm((f) => ({
        ...f,
        photoUrls: f.photoUrls ? f.photoUrls.trimEnd() + "\n" + publicUrl : publicUrl,
      }));
    } finally {
      setUploadingPhoto(false);
    }
  }

  useEffect(() => {
    fetch("/api/locations").then((r) => r.json()).then(setListings).finally(() => setLoading(false));
  }, []);

  function toggleAmenity(a: string) {
    const list = form.amenities ? form.amenities.split(",").map((x) => x.trim()).filter(Boolean) : [];
    if (list.includes(a)) setForm({ ...form, amenities: list.filter((x) => x !== a).join(", ") });
    else setForm({ ...form, amenities: [...list, a].join(", ") });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        capacity: form.capacity ? parseInt(form.capacity, 10) : null,
        dailyRate: form.dailyRate ? parseFloat(form.dailyRate) : null,
        amenities: form.amenities || null,
        photoUrls: form.photoUrls || null,
      }),
    });
    if (res.ok) {
      const item = await res.json();
      setListings((prev) => [item, ...prev]);
      setShowForm(false);
      setForm({ name: "", description: "", type: "Studio", address: "", city: "", province: "", country: "", capacity: "", dailyRate: "", amenities: "", photoUrls: "", rules: "", availability: "", contactUrl: "" });
    }
  }

  const byType = [...new Set(listings.map((l) => l.type))];

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <main className="max-w-7xl mx-auto px-6 md:px-12 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">My Location Listings</h1>
          <p className="text-slate-400 text-sm">{listings.length} propert{listings.length === 1 ? "y" : "ies"} listed</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition"
        >
          <Plus className="w-4 h-4" /> Add Property
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white">New property</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Property name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Downtown Studio A" className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Type *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm">
                {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Describe the space, best uses, vibe..." className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs text-slate-400 mb-1">Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">City</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Province / State</label><input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Country</label><input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs text-slate-400 mb-1">Max capacity (people)</label><input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" /></div>
            <div><label className="block text-xs text-slate-400 mb-1">Daily rate ($)</label><input type="number" min={0} step={0.01} value={form.dailyRate} onChange={(e) => setForm({ ...form, dailyRate: e.target.value })} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" /></div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-2">Amenities</label>
            <div className="flex flex-wrap gap-2">
              {AMENITIES_OPTIONS.map((a) => (
                <button key={a} type="button" onClick={() => toggleAmenity(a)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${form.amenities.includes(a) ? "border-orange-500 bg-orange-500/10 text-orange-400" : "border-slate-600 text-slate-400 hover:bg-slate-700/50"}`}>{a}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Photos</label>
            <p className="text-[11px] text-slate-500 mb-1">Use Upload for each image (URLs stack, one per line). Optional: paste extra direct image links only.</p>
            <div className="flex gap-2 mb-1">
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-sm cursor-pointer w-fit">
                <Upload className="w-4 h-4" /> {uploadingPhoto ? "Uploading..." : "Upload image"}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
              </label>
            </div>
            <textarea value={form.photoUrls} onChange={(e) => setForm({ ...form, photoUrls: e.target.value })} rows={2} placeholder="Optional: one image URL per line (e.g. legacy hosting)" className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" />
          </div>
          <div><label className="block text-xs text-slate-400 mb-1">House rules</label><textarea value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} rows={2} placeholder="No smoking, quiet after 10pm..." className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" /></div>
          <div><label className="block text-xs text-slate-400 mb-1">Availability notes</label><input value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })} placeholder="e.g. Weekdays only, book 2 weeks ahead" className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" /></div>
          <div><label className="block text-xs text-slate-400 mb-1">Contact / website URL</label><input value={form.contactUrl} onChange={(e) => setForm({ ...form, contactUrl: e.target.value })} placeholder="https://..." className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm" /></div>
          <button type="submit" className="px-5 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition">Create Listing</button>
        </form>
      )}

      {byType.map((type) => (
        <section key={type}>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4 text-orange-400" /> {type}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.filter((l) => l.type === type).map((l) => {
              const firstPhoto = l.photoUrls?.split(/[\n,]/)[0]?.trim();
              return (
                <div key={l.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                  {firstPhoto && <img src={firstPhoto} alt="" className="w-full h-32 object-cover" />}
                  <div className="p-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-orange-400 flex-shrink-0" />
                      <h3 className="text-white font-medium">{l.name}</h3>
                    </div>
                    {l.description && <p className="text-sm text-slate-400 line-clamp-2">{l.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      {l.city && <span>{l.city}</span>}
                      {l.capacity != null && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {l.capacity}</span>}
                      {l.dailyRate != null && <span className="flex items-center gap-1 text-orange-400"><DollarSign className="w-3 h-3" /> {l.dailyRate}/day</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {listings.length === 0 && !showForm && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-10 text-center">
          <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No listings yet. Add your first property to receive bookings.</p>
        </div>
      )}
    </main>
  );
}
