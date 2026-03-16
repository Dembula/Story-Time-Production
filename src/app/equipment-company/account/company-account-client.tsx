"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User, Save, ArrowLeft } from "lucide-react";

export function CompanyAccountClient({
  backHref,
  title,
  subtitle,
}: {
  backHref: string;
  title: string;
  subtitle: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((user) => {
        if (user) {
          setName(user.name ?? "");
          setEmail(user.email ?? "");
        }
        setLoading(false);
      });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccess("");
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setSuccess("Saved.");
        setTimeout(() => setSuccess(""), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>
      <div className="flex items-center gap-3 mb-8">
        <User className="w-8 h-8 text-orange-500" />
        <div>
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          <p className="text-slate-400 text-sm">{subtitle}</p>
        </div>
      </div>

      {success && (
        <div className="mb-6 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
          {success}
        </div>
      )}

      <form onSubmit={save} className="space-y-4 rounded-2xl bg-slate-800/30 border border-slate-700/50 p-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white"
            placeholder="Company or your name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
          <input value={email} readOnly className="w-full px-4 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-slate-400" />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}
