"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, User, Mail, Phone, MapPin } from "lucide-react";

export function AccountSetupClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    residentialAddress: "",
    city: "",
    provinceState: "",
    postalCode: "",
    country: "South Africa",
  });

  useEffect(() => {
    fetch("/api/viewer/account/onboarding")
      .then((r) => r.json())
      .then((data) => {
        if (data.complete) {
          router.replace("/profiles");
          return;
        }
        if (data.profile) {
          setForm((prev) => ({ ...prev, ...data.profile }));
        }
      })
      .catch(() => setError("Could not load your account details."))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/viewer/account/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save account details");
      router.push(data.redirectTo ?? "/profiles");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold text-white">Complete your account</h1>
        <p className="max-w-xl text-slate-300/78">
          Before you start watching, tell us who holds this subscription. We use this for billing, support, and account security.
        </p>
      </div>

      <div className="storytime-section space-y-6 p-6 md:p-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
          <User className="h-5 w-5 text-orange-400" /> Personal details
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-400">Full name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              className="storytime-input w-full px-4 py-2.5"
              placeholder="Your legal name"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-sm text-slate-400">
              <Mail className="h-3.5 w-3.5" /> Email
            </span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              className="storytime-input w-full px-4 py-2.5"
              placeholder="you@example.com"
            />
          </label>
          <label className="md:col-span-2 block">
            <span className="mb-1.5 flex items-center gap-1.5 text-sm text-slate-400">
              <Phone className="h-3.5 w-3.5" /> Mobile number
            </span>
            <input
              required
              value={form.phoneNumber}
              onChange={(e) => setForm((s) => ({ ...s, phoneNumber: e.target.value }))}
              className="storytime-input w-full px-4 py-2.5"
              placeholder="+27 ..."
            />
          </label>
        </div>
      </div>

      <div className="storytime-section space-y-6 p-6 md:p-8">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
          <MapPin className="h-5 w-5 text-orange-400" /> Billing address
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2 block">
            <span className="mb-1.5 block text-sm text-slate-400">Street address</span>
            <input
              value={form.residentialAddress}
              onChange={(e) => setForm((s) => ({ ...s, residentialAddress: e.target.value }))}
              className="storytime-input w-full px-4 py-2.5"
              placeholder="Street and number"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-400">City</span>
            <input
              value={form.city}
              onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
              className="storytime-input w-full px-4 py-2.5"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-400">Province / state</span>
            <input
              value={form.provinceState}
              onChange={(e) => setForm((s) => ({ ...s, provinceState: e.target.value }))}
              className="storytime-input w-full px-4 py-2.5"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-400">Postal code</span>
            <input
              value={form.postalCode}
              onChange={(e) => setForm((s) => ({ ...s, postalCode: e.target.value }))}
              className="storytime-input w-full px-4 py-2.5"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-400">Country</span>
            <input
              value={form.country}
              onChange={(e) => setForm((s) => ({ ...s, country: e.target.value }))}
              className="storytime-input w-full px-4 py-2.5"
            />
          </label>
        </div>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 font-semibold text-white shadow-glow hover:bg-orange-400 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save and continue
        </button>
        <Link href="/browse/settings" className="text-sm text-slate-400 hover:text-white">
          Manage account later in settings
        </Link>
      </div>
    </form>
  );
}
