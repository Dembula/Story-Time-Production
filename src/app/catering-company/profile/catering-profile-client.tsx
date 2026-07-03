"use client";

import { StoryTimeLoader, StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UtensilsCrossed, Upload } from "lucide-react";
import { AccountPrivacyControls } from "@/components/account/account-privacy-controls";
import { uploadContentMediaViaApi } from "@/lib/upload-content-media-client";

type CateringProfile = {
  galleryUrls: string[];
  menuHighlights: string[];
  serviceTypes: string[];
  pricePerHead: number | null;
};

type Company = {
  id: string;
  companyName: string;
  tagline: string | null;
  description: string | null;
  plainDescription?: string;
  city: string | null;
  country: string | null;
  specializations: string | null;
  minOrder: number | null;
  contactEmail: string | null;
  website: string | null;
  logoUrl: string | null;
  profile?: CateringProfile;
} | null;

export function CateringProfileClient() {
  const router = useRouter();
  const [company, setCompany] = useState<Company>(null);
  const [form, setForm] = useState({
    companyName: "",
    tagline: "",
    description: "",
    city: "",
    country: "",
    specializations: "",
    minOrder: "",
    contactEmail: "",
    website: "",
    logoUrl: "",
    menuHighlights: "",
    serviceTypes: "",
    pricePerHead: "",
    galleryUrls: [] as string[],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/catering-company/profile")
      .then((r) => r.json())
      .then((c) => {
        if (c?.error) {
          setError(c.error);
          return;
        }
        setCompany(c);
        if (c) {
          setForm({
            companyName: c.companyName || "",
            tagline: c.tagline || "",
            description: c.plainDescription || c.description || "",
            city: c.city || "",
            country: c.country || "",
            specializations: c.specializations || "",
            minOrder: c.minOrder != null ? String(c.minOrder) : "",
            contactEmail: c.contactEmail || "",
            website: c.website || "",
            logoUrl: c.logoUrl || "",
            menuHighlights: (c.profile?.menuHighlights ?? []).join(", "),
            serviceTypes: (c.profile?.serviceTypes ?? []).join(", "),
            pricePerHead: c.profile?.pricePerHead != null ? String(c.profile.pricePerHead) : "",
            galleryUrls: c.profile?.galleryUrls ?? [],
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function uploadFile(file: File, target: "logo" | "gallery") {
    setUploading(true);
    setError("");
    try {
      const url = await uploadContentMediaViaApi(file);
      if (target === "logo") {
        setForm((f) => ({ ...f, logoUrl: url }));
      } else {
        setForm((f) => ({ ...f, galleryUrls: [...f.galleryUrls, url] }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/catering-company/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          tagline: form.tagline,
          description: form.description,
          city: form.city,
          country: form.country,
          specializations: form.specializations,
          minOrder: form.minOrder ? parseFloat(form.minOrder) : null,
          contactEmail: form.contactEmail,
          website: form.website,
          logoUrl: form.logoUrl || null,
          profile: {
            galleryUrls: form.galleryUrls,
            menuHighlights: form.menuHighlights
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            serviceTypes: form.serviceTypes
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            pricePerHead: form.pricePerHead ? parseFloat(form.pricePerHead) : null,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Failed to save profile");
        return;
      }
      setCompany(data);
      setSuccess("Profile saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <StoryTimeLoader size="sm" hideTrack />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 flex items-center gap-3 text-3xl font-semibold text-white">
        <UtensilsCrossed className="h-8 w-8 text-orange-500" /> Company profile
      </h1>
      {error && <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {success && <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{success}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-400">Logo</label>
          <div className="flex items-center gap-3">
            {form.logoUrl && <img src={form.logoUrl} alt="" className="h-16 w-16 rounded-xl object-cover" />}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">
              <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload logo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadFile(f, "logo");
                }}
              />
            </label>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-400">Food gallery</label>
          <div className="mb-2 flex flex-wrap gap-2">
            {form.galleryUrls.map((url) => (
              <img key={url} src={url} alt="" className="h-16 w-16 rounded-lg object-cover" />
            ))}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">
            <Upload className="h-4 w-4" /> Add photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadFile(f, "gallery");
              }}
            />
          </label>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-400">Company name *</label>
          <input
            type="text"
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            required
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-400">Tagline</label>
          <input
            type="text"
            value={form.tagline}
            onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-400">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={4}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">Menu highlights (comma-separated)</label>
            <input
              type="text"
              value={form.menuHighlights}
              onChange={(e) => setForm((f) => ({ ...f, menuHighlights: e.target.value }))}
              placeholder="Craft table, vegan options"
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white placeholder:text-slate-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">Service types (comma-separated)</label>
            <input
              type="text"
              value={form.serviceTypes}
              onChange={(e) => setForm((f) => ({ ...f, serviceTypes: e.target.value }))}
              placeholder="Breakfast, lunch, craft"
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white placeholder:text-slate-500"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-400">Price per head (ZAR)</label>
          <input
            type="number"
            value={form.pricePerHead}
            onChange={(e) => setForm((f) => ({ ...f, pricePerHead: e.target.value }))}
            min={0}
            step={10}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">City</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">Country</label>
            <input
              type="text"
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-400">Specializations</label>
          <input
            type="text"
            value={form.specializations}
            onChange={(e) => setForm((f) => ({ ...f, specializations: e.target.value }))}
            placeholder="e.g. Film shoots, events"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white placeholder:text-slate-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-400">Minimum order (ZAR)</label>
          <input
            type="number"
            value={form.minOrder}
            onChange={(e) => setForm((f) => ({ ...f, minOrder: e.target.value }))}
            min={0}
            step={100}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-400">Contact email</label>
          <input
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-400">Website</label>
          <input
            type="url"
            value={form.website}
            onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-orange-500 px-6 py-2.5 font-medium text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>
      {!company && <p className="mt-4 text-sm text-slate-500">Complete your profile so creators can browse your menu and gallery.</p>}

      <div id="account">
        <AccountPrivacyControls variant="marketplace" className="mt-8" />
      </div>
    </div>
  );
}
