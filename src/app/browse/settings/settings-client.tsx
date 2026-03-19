"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor, Palette, Bell, Gauge, CreditCard, User, Plus, Trash2, Star } from "lucide-react";

const THEMES = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
  { value: "auto", label: "System", icon: Monitor },
];

const ACCENTS = [
  { value: "orange", label: "Orange", class: "bg-orange-500" },
  { value: "violet", label: "Violet", class: "bg-violet-500" },
  { value: "emerald", label: "Emerald", class: "bg-emerald-500" },
  { value: "cyan", label: "Cyan", class: "bg-cyan-500" },
];

type PaymentMethod = { id: string; label: string; lastFour: string; isDefault: boolean };

export function SettingsClient() {
  const [theme, setTheme] = useState<string>("dark");
  const [accent, setAccent] = useState<string>("orange");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [playbackQuality, setPlaybackQuality] = useState<string>("auto");
  const [name, setName] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [newPaymentLabel, setNewPaymentLabel] = useState("");
  const [newPaymentLastFour, setNewPaymentLastFour] = useState("");
  const [mounted, setMounted] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = localStorage.getItem("storytime-theme") || "dark";
    const a = localStorage.getItem("storytime-accent") || "orange";
    setTheme(t);
    setAccent(a);
    applyTheme(t, a);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    fetch("/api/me").then((r) => r.json()).then((u) => u?.name != null && setName(u.name));
    fetch("/api/viewer/preferences").then((r) => r.json()).then((p) => {
      if (p?.notifyEmail !== undefined) setNotifyEmail(p.notifyEmail);
      if (p?.playbackQuality) setPlaybackQuality(p.playbackQuality);
    });
    fetch("/api/viewer/payment-methods").then((r) => r.json()).then((arr) => setPaymentMethods(Array.isArray(arr) ? arr : []));
  }, [mounted]);

  function applyTheme(t: string, a: string) {
    const root = document.documentElement;
    root.setAttribute("data-theme", t);
    root.setAttribute("data-accent", a);
    if (t === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else if (t === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
      root.classList.toggle("light", !prefersDark);
    }
  }

  function handleThemeChange(value: string) {
    setTheme(value);
    localStorage.setItem("storytime-theme", value);
    applyTheme(value, accent);
  }

  function handleAccentChange(value: string) {
    setAccent(value);
    localStorage.setItem("storytime-accent", value);
    applyTheme(theme, value);
  }

  async function savePreferences() {
    setSavingPrefs(true);
    try {
      await fetch("/api/viewer/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyEmail, playbackQuality }),
      });
    } finally {
      setSavingPrefs(false);
    }
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setSavingName(true);
    try {
      await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined }),
      });
    } finally {
      setSavingName(false);
    }
  }

  async function addPaymentMethod(e: React.FormEvent) {
    e.preventDefault();
    const label = newPaymentLabel.trim();
    const lastFour = newPaymentLastFour.replace(/\D/g, "").slice(-4);
    if (!label || lastFour.length !== 4) return;
    const res = await fetch("/api/viewer/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, lastFour }),
    });
    if (res.ok) {
      const m = await res.json();
      setPaymentMethods((prev) => [m, ...prev]);
      setNewPaymentLabel("");
      setNewPaymentLastFour("");
    }
  }

  async function setDefaultPayment(id: string) {
    await fetch("/api/viewer/payment-methods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isDefault: true }),
    });
    setPaymentMethods((prev) => prev.map((p) => ({ ...p, isDefault: p.id === id })));
  }

  async function removePayment(id: string) {
    if (!confirm("Remove this payment method?")) return;
    const res = await fetch(`/api/viewer/payment-methods?id=${id}`, { method: "DELETE" });
    if (res.ok) setPaymentMethods((prev) => prev.filter((p) => p.id !== id));
  }

  if (!mounted) return null;

  return (
    <div className="space-y-10">
      <section id="appearance" className="storytime-section p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <Sun className="w-5 h-5 text-slate-400" /> Appearance
        </h2>
        <p className="mb-4 text-sm text-slate-400">Colour scheme</p>
        <div className="flex flex-wrap gap-3 mb-6">
          {THEMES.map((t) => (
            <button
              key={t.value}
              onClick={() => handleThemeChange(t.value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition ${
                theme === t.value
                  ? "border-orange-400/40 bg-orange-500/12 text-white shadow-panel"
                  : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/18 hover:bg-white/[0.05]"
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-400 mb-2">Accent colour</p>
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              onClick={() => handleAccentChange(a.value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition ${
                accent === a.value ? "border-white/22 bg-white/[0.08] shadow-panel" : "border-white/10 bg-white/[0.03] hover:border-white/18 hover:bg-white/[0.05]"
              }`}
            >
              <span className={`w-4 h-4 rounded-full ${a.class}`} />
              <span className="text-slate-300">{a.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section id="personal" className="storytime-section p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <User className="w-5 h-5 text-slate-400" /> Personal info
        </h2>
        <form onSubmit={saveName} className="space-y-3">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Display name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="storytime-input max-w-md px-4 py-2.5"
              placeholder="Your name"
            />
          </div>
          <button type="submit" disabled={savingName} className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400 disabled:opacity-50">
            {savingName ? "Saving..." : "Save name"}
          </button>
        </form>
      </section>

      <section id="preferences" className="storytime-section p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <Bell className="w-5 h-5 text-slate-400" /> Account preferences
        </h2>
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
            <input
              type="checkbox"
              checked={notifyEmail}
              onChange={(e) => {
                setNotifyEmail(e.target.checked);
                fetch("/api/viewer/preferences", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ notifyEmail: e.target.checked }),
                });
              }}
              className="h-4 w-4 rounded border-white/12 bg-white/[0.04] text-orange-500 focus:ring-orange-500"
            />
            <span className="text-slate-300">Email notifications (recommendations, updates)</span>
          </label>
          <div>
            <label className="block text-sm text-slate-400 mb-2 flex items-center gap-2">
              <Gauge className="w-4 h-4" /> Playback quality
            </label>
            <select
              value={playbackQuality}
              onChange={(e) => {
                const v = e.target.value;
                setPlaybackQuality(v);
                setSavingPrefs(true);
                fetch("/api/viewer/preferences", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ playbackQuality: v }),
                }).finally(() => setSavingPrefs(false));
              }}
              className="storytime-select max-w-xs px-4 py-2.5 text-sm"
            >
              <option value="auto">Auto</option>
              <option value="1080p">1080p</option>
              <option value="720p">720p</option>
              <option value="480p">480p</option>
            </select>
          </div>
        </div>
      </section>

      <section id="payment" className="storytime-section p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <CreditCard className="w-5 h-5 text-slate-400" /> Payment methods
        </h2>
        <p className="mb-4 text-sm text-slate-400">Manage saved payment methods for subscriptions. For demo purposes you can add a label and last 4 digits.</p>
        <ul className="space-y-2 mb-6">
          {paymentMethods.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3">
              <span className="text-white font-medium">{p.label}</span>
              <span className="text-slate-400 text-sm">****{p.lastFour}</span>
              <div className="flex items-center gap-2">
                {!p.isDefault && (
                  <button type="button" onClick={() => setDefaultPayment(p.id)} className="text-xs text-orange-400 hover:underline flex items-center gap-1">
                    <Star className="w-3 h-3" /> Set default
                  </button>
                )}
                {p.isDefault && <span className="text-xs text-emerald-400 flex items-center gap-1"><Star className="w-3 h-3 fill-current" /> Default</span>}
                <button type="button" onClick={() => removePayment(p.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <form onSubmit={addPaymentMethod} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Label (e.g. Visa ****4242)</label>
            <input
              value={newPaymentLabel}
              onChange={(e) => setNewPaymentLabel(e.target.value)}
              placeholder="Visa ****4242"
              className="storytime-input w-48 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Last 4 digits</label>
            <input
              value={newPaymentLastFour}
              onChange={(e) => setNewPaymentLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="4242"
              maxLength={4}
              className="storytime-input w-24 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400">
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>
      </section>
    </div>
  );
}
