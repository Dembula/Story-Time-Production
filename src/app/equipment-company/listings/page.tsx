"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Package, Plus, MapPin, Globe, Tag, Upload } from "lucide-react";

interface Listing {
  id: string;
  companyName: string;
  description: string | null;
  category: string;
  imageUrl: string | null;
  contactUrl: string | null;
  location: string | null;
  createdAt: string;
}

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ companyName: "", category: "", description: "", imageUrl: "", contactUrl: "", location: "" });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch("/api/equipment").then((r) => r.json()).then(setListings).finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/equipment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const item = await res.json();
      setListings((prev) => [item, ...prev]);
      setShowForm(false);
      setForm({ companyName: "", category: "", description: "", imageUrl: "", contactUrl: "", location: "" });
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/content-media", { method: "POST", body: fd });
      const data = await res.json();
      if (data.publicUrl) setForm((f) => ({ ...f, imageUrl: data.publicUrl }));
    } finally {
      setUploading(false);
    }
  }

  const categories = [...new Set(listings.map((l) => l.category))];

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <main className="max-w-7xl mx-auto px-6 md:px-12 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">My Equipment Listings</h1>
          <p className="text-slate-400 text-sm">{listings.length} items listed</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition"
        >
          <Plus className="w-4 h-4" /> Add Listing
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Equipment Name" required className="px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm" />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required className="px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm">
              <option value="">Select Category</option>
              <option value="Camera">Camera</option>
              <option value="Lighting">Lighting</option>
              <option value="Audio">Audio</option>
              <option value="Grip">Grip</option>
              <option value="Drone">Drone</option>
              <option value="Studio">Studio</option>
              <option value="Post-Production">Post-Production</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={3} className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm" />
          <div>
            <label className="block text-sm text-slate-400 mb-1">Equipment image</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 text-sm cursor-pointer hover:bg-slate-700">
                <Upload className="w-4 h-4" /> {uploading ? "Uploading..." : "Upload image"}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
              </label>
              {form.imageUrl && <span className="text-xs text-emerald-400 truncate max-w-[200px]">Image set</span>}
            </div>
            {form.imageUrl && <input type="hidden" name="imageUrl" value={form.imageUrl} />}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Location" className="px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm" />
            <input value={form.contactUrl} onChange={(e) => setForm({ ...form, contactUrl: e.target.value })} placeholder="Contact URL (optional)" className="px-4 py-2.5 bg-slate-900/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 text-sm" />
          </div>
          <button type="submit" className="px-5 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition">
            Create Listing
          </button>
        </form>
      )}

      {categories.map((cat) => (
        <section key={cat}>
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4 text-orange-400" /> {cat}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.filter((l) => l.category === cat).map((l) => (
              <div key={l.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                {l.imageUrl ? (
                  <div className="relative w-full aspect-video bg-slate-800">
                    <Image src={l.imageUrl} alt={l.companyName} fill className="object-cover" unoptimized />
                  </div>
                ) : (
                  <div className="w-full aspect-video bg-slate-800/50 flex items-center justify-center">
                    <Package className="w-12 h-12 text-slate-600" />
                  </div>
                )}
                <div className="p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-medium">{l.companyName}</h3>
                </div>
                {l.description && <p className="text-sm text-slate-400">{l.description}</p>}
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  {l.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {l.location}</span>}
                  {l.contactUrl && <a href={l.contactUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-orange-400 hover:underline"><Globe className="w-3 h-3" /> Website</a>}
                </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
