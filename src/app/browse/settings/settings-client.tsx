"use client";

import { useEffect, useState } from "react";
import { Bell, CreditCard, Gauge, Lock, Mail, Plus, Smartphone, Star, Trash2, User, Users } from "lucide-react";
import { VIEWER_PLAN_CONFIG } from "@/lib/pricing";
import { formatZar } from "@/lib/format-currency-zar";
import { getBirthDateOptionSets } from "@/lib/viewer-profiles";

type PaymentMethod = { id: string; label: string; lastFour: string; isDefault: boolean };
type ViewerProfile = { id: string; name: string; age: number; dateOfBirth: string | null; isMaster: boolean };
type ViewerSubscription = {
  id: string;
  plan: string;
  viewerModel: "SUBSCRIPTION" | "PPV";
  deviceCount: number;
  profileLimit: number | null;
  status: string;
};

export function SettingsClient() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [profiles, setProfiles] = useState<ViewerProfile[]>([]);
  const [isMasterActive, setIsMasterActive] = useState(false);
  const [profileLimit, setProfileLimit] = useState(1);
  const [subscription, setSubscription] = useState<ViewerSubscription | null>(null);
  const [showPlanModal, setShowPlanModal] = useState(false);

  const [notifyEmail, setNotifyEmail] = useState(true);
  const [playbackQuality, setPlaybackQuality] = useState<string>("auto");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [newPaymentLabel, setNewPaymentLabel] = useState("");
  const [newPaymentLastFour, setNewPaymentLastFour] = useState("");
  const [newProfileName, setNewProfileName] = useState("");
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);
  const [birthYear, setBirthYear] = useState<number | "">("");
  const [birthMonth, setBirthMonth] = useState<number | "">("");
  const [birthDay, setBirthDay] = useState<number | "">("");
  const { years, months } = getBirthDateOptionSets();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [mounted, setMounted] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    Promise.all([
      fetch("/api/me").then((r) => r.json()),
      fetch("/api/viewer/preferences").then((r) => r.json()),
      fetch("/api/viewer/payment-methods").then((r) => r.json()),
      fetch("/api/viewer/profiles").then((r) => r.json()),
      fetch("/api/viewer/profiles/active").then((r) => r.json()),
      fetch("/api/viewer/subscription").then((r) => r.json()),
    ]).then(([u, p, methods, profileData, activeData, subData]) => {
      if (u?.name != null) setName(u.name);
      if (u?.email != null) setEmail(u.email);
      if (u?.phoneNumber != null) setPhoneNumber(u.phoneNumber);

      if (p?.notifyEmail !== undefined) setNotifyEmail(p.notifyEmail);
      if (p?.playbackQuality) setPlaybackQuality(p.playbackQuality);

      setPaymentMethods(Array.isArray(methods) ? methods : []);

      const list = Array.isArray(profileData?.profiles) ? profileData.profiles : [];
      const enhanced: ViewerProfile[] = list.map((item: ViewerProfile, index: number) => ({
        ...item,
        isMaster: index === 0,
      }));
      setProfiles(enhanced);

      const activeId = activeData?.profile?.id ?? null;
      setIsMasterActive(!!enhanced.length && activeId === enhanced[0].id);

      const sub = subData?.subscription ?? null;
      setSubscription(sub);
      setProfileLimit(sub?.profileLimit ?? sub?.deviceCount ?? 1);
    }).catch(() => {
      setError("Failed to load settings");
    });
  }, [mounted]);

  async function saveAccountInfo(e: React.FormEvent) {
    e.preventDefault();
    setSavingAccount(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phoneNumber: phoneNumber.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update account");
      setSuccess("Account details updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update account");
    } finally {
      setSavingAccount(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword.trim()) return;
    setSavingPassword(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update password");
      setCurrentPassword("");
      setNewPassword("");
      setSuccess("Password updated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  }

  async function savePreferences() {
    setSavingPrefs(true);
    setError("");
    try {
      const res = await fetch("/api/viewer/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyEmail, playbackQuality }),
      });
      if (!res.ok) throw new Error("Failed to save preferences");
    } catch {
      setError("Failed to save preferences");
    } finally {
      setSavingPrefs(false);
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
    if (res.ok) {
      setPaymentMethods((prev) => prev.filter((p) => p.id !== id));
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Failed to remove payment method");
    }
  }

  async function updateProfileName(id: string, newName: string) {
    setSavingProfileId(id);
    const res = await fetch("/api/viewer/profiles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: newName }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.profile) {
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...data.profile, isMaster: p.isMaster } : p)));
    } else {
      setError(data?.error || "Failed to update profile");
    }
    setSavingProfileId(null);
  }

  async function updateChildFlag(id: string, isChild: boolean) {
    setSavingProfileId(id);
    const res = await fetch("/api/viewer/profiles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isChild }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.profile) {
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...data.profile, isMaster: p.isMaster } : p)));
    } else {
      setError(data?.error || "Failed to update profile");
    }
    setSavingProfileId(null);
  }

  async function removeProfile(id: string) {
    if (!confirm("Delete this profile?")) return;
    const res = await fetch(`/api/viewer/profiles?id=${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setProfiles((prev) => prev.filter((p) => p.id !== id));
    } else {
      setError(data?.error || "Failed to delete profile");
    }
  }

  async function addProfile(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newProfileName.trim();
    if (!trimmed) return;
    if (!birthYear || !birthMonth || !birthDay) {
      setError("Please enter date of birth for the profile");
      return;
    }
    const res = await fetch("/api/viewer/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: trimmed,
        birthYear,
        birthMonth,
        birthDay,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.profile) {
      const profile = data.profile as ViewerProfile;
      setProfiles((prev) => [...prev, { ...profile, isMaster: false }]);
      setNewProfileName("");
      setBirthYear("");
      setBirthMonth("");
      setBirthDay("");
    } else {
      setError(data?.error || "Failed to add profile");
    }
  }

  async function changePackage(plan: "BASE_1" | "STANDARD_3" | "FAMILY_5" | "PPV_FILM") {
    const viewerModel = plan === "PPV_FILM" ? "PPV" : "SUBSCRIPTION";
    const res = await fetch("/api/viewer/subscription", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, viewerModel }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "Failed to update package");
      return;
    }
    setSubscription(data.subscription);
    setProfileLimit(data.subscription?.profileLimit ?? data.subscription?.deviceCount ?? profileLimit);
    setShowPlanModal(false);
    setSuccess("Package updated");
  }

  if (!mounted) return null;

  return (
    <div className="space-y-10">
      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">{success}</div> : null}

      <section id="settings-my-account" className="storytime-section p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <User className="w-5 h-5 text-slate-400" /> Settings · My account
        </h2>
        <form onSubmit={saveAccountInfo} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-slate-400">Profile name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="storytime-input w-full px-4 py-2.5" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400"><Mail className="mr-1 inline w-4 h-4" /> Registered email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="storytime-input w-full px-4 py-2.5" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-400"><Smartphone className="mr-1 inline w-4 h-4" /> Phone number</label>
              <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="storytime-input w-full px-4 py-2.5" placeholder="+27 ..." />
            </div>
          </div>
          <button type="submit" disabled={savingAccount} className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400 disabled:opacity-50">
            {savingAccount ? "Saving..." : "Save account details"}
          </button>
        </form>

        <form onSubmit={savePassword} className="mt-8 space-y-4 border-t border-white/10 pt-6">
          <h3 className="text-white font-medium flex items-center gap-2"><Lock className="w-4 h-4 text-slate-400" /> Password</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="storytime-input px-4 py-2.5"
              placeholder="Current password"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="storytime-input px-4 py-2.5"
              placeholder="New password (min 8 chars)"
            />
          </div>
          <button type="submit" disabled={savingPassword} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-slate-200 hover:bg-white/[0.05] disabled:opacity-50">
            {savingPassword ? "Updating..." : "Change password"}
          </button>
        </form>
      </section>

      <section id="personal" className="storytime-section p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <Users className="w-5 h-5 text-slate-400" /> Personal info (Profiles)
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          First created profile is the master profile. Profile management is enabled when the active profile is master.
        </p>
        {!isMasterActive ? (
          <p className="rounded-xl border border-orange-400/20 bg-orange-500/10 p-3 text-sm text-orange-200">
            Switch to the first (master) profile in Who&apos;s watching to add/delete profiles or change child toggles.
          </p>
        ) : null}
        <div className="space-y-3 mt-4">
          {profiles.map((profile) => (
            <div key={profile.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-white font-medium">{profile.name} {profile.isMaster ? <span className="text-xs text-orange-300">(Master)</span> : null}</p>
                <p className="text-xs text-slate-500">Age {profile.age}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  defaultValue={profile.name}
                  disabled={!isMasterActive || !!savingProfileId}
                  className="storytime-input px-3 py-2 text-sm"
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next && next !== profile.name) updateProfileName(profile.id, next);
                  }}
                />
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    disabled={!isMasterActive || !!savingProfileId}
                    checked={profile.age < 18}
                    onChange={(e) => updateChildFlag(profile.id, e.target.checked)}
                  />
                  Child profile (under 18)
                </label>
                {!profile.isMaster && (
                  <button
                    type="button"
                    disabled={!isMasterActive || !!savingProfileId}
                    onClick={() => removeProfile(profile.id)}
                    className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    <Trash2 className="mr-1 inline w-3 h-3" /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={addProfile} className="mt-5 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-slate-400">New profile name</label>
            <input
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              disabled={!isMasterActive || profiles.length >= profileLimit}
              className="storytime-input w-48 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Year</label>
            <select
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value ? Number(e.target.value) : "")}
              disabled={!isMasterActive || profiles.length >= profileLimit}
              className="storytime-input w-28 px-3 py-2 text-sm"
            >
              <option value="">Year</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Month</label>
            <select
              value={birthMonth}
              onChange={(e) => setBirthMonth(e.target.value ? Number(e.target.value) : "")}
              disabled={!isMasterActive || profiles.length >= profileLimit}
              className="storytime-input w-36 px-3 py-2 text-sm"
            >
              <option value="">Month</option>
              {months.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Day</label>
            <input
              type="number"
              min={1}
              max={31}
              value={birthDay}
              onChange={(e) => setBirthDay(e.target.value ? Number(e.target.value) : "")}
              disabled={!isMasterActive || profiles.length >= profileLimit}
              className="storytime-input w-20 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={!isMasterActive || profiles.length >= profileLimit}
            className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-glow hover:bg-orange-400 disabled:opacity-50"
          >
            <Plus className="mr-1 inline w-4 h-4" /> Add profile
          </button>
        </form>
      </section>

      <section id="preferences" className="storytime-section p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <Bell className="w-5 h-5 text-slate-400" /> Preferences
        </h2>
        <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
          <input
            type="checkbox"
            checked={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.checked)}
            className="h-4 w-4 rounded border-white/12 bg-white/[0.04] text-orange-500 focus:ring-orange-500"
          />
          <span className="text-slate-300">Email notifications</span>
        </label>
        <div className="mb-4">
          <label className="mb-2 block text-sm text-slate-400"><Gauge className="mr-1 inline w-4 h-4" /> Playback quality</label>
          <select value={playbackQuality} onChange={(e) => setPlaybackQuality(e.target.value)} className="storytime-select max-w-xs px-4 py-2.5 text-sm">
            <option value="auto">Auto</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="480p">480p</option>
          </select>
        </div>
        <button onClick={savePreferences} disabled={savingPrefs} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-slate-200 hover:bg-white/[0.05] disabled:opacity-50">
          {savingPrefs ? "Saving..." : "Save preferences"}
        </button>
      </section>

      <section id="package" className="storytime-section p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <CreditCard className="w-5 h-5 text-slate-400" /> Package
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          Current package: {subscription?.plan ?? "N/A"} · {subscription?.deviceCount ?? 1} devices · {subscription?.profileLimit ?? 1} profiles
        </p>
        <button type="button" onClick={() => setShowPlanModal(true)} className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-glow hover:bg-orange-400">
          Change package
        </button>
      </section>

      <section id="settings-payment-methods" className="storytime-section p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
          <CreditCard className="w-5 h-5 text-slate-400" /> Settings · Payment methods
        </h2>
        <p className="mb-4 text-sm text-slate-400">At least one payment method must stay saved on your account.</p>
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

      {showPlanModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0b1220] p-6 shadow-panel">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">Choose package</h3>
              <button type="button" onClick={() => setShowPlanModal(false)} className="text-sm text-slate-400 hover:text-white">Close</button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {(["BASE_1", "STANDARD_3", "FAMILY_5", "PPV_FILM"] as const).map((plan) => {
                const cfg = VIEWER_PLAN_CONFIG[plan];
                return (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => changePackage(plan)}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left hover:border-orange-400/30 hover:bg-orange-500/10"
                  >
                    <p className="font-semibold text-white">{cfg.label}</p>
                    <p className="text-sm text-slate-400 mt-1">{formatZar(cfg.price)} {plan === "PPV_FILM" ? "per title" : "/ month"}</p>
                    <p className="text-xs text-slate-500 mt-2">{cfg.deviceCount} devices · {cfg.profileLimit} profiles</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
