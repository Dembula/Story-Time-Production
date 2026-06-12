"use client";

import { StoryTimeLoader, StoryTimeLoadingCenter } from "@/components/ui/storytime-loader";
import { useEffect, useState } from "react";
import { Bell, CreditCard, Gauge, Lock, Mail, MapPin, Plus, Smartphone, Star, Trash2, User, Users } from "lucide-react";
import { VIEWER_PLAN_CONFIG } from "@/lib/pricing";
import { formatZar } from "@/lib/format-currency-zar";
import { getBirthDateOptionSets } from "@/lib/viewer-profiles";

type PaymentMethod = { id: string; label: string; lastFour: string; isDefault: boolean };
type ViewerProfile = {
  id: string;
  name: string;
  age: number;
  dateOfBirth: string | null;
  isMaster: boolean;
  pinEnabled: boolean;
};
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
  const [residentialAddress, setResidentialAddress] = useState("");
  const [city, setCity] = useState("");
  const [provinceState, setProvinceState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("South Africa");
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
  const [newProfilePinEnabled, setNewProfilePinEnabled] = useState(false);
  const [newProfilePin, setNewProfilePin] = useState("");
  const [newProfilePinConfirm, setNewProfilePinConfirm] = useState("");
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);
  const [pinEditorId, setPinEditorId] = useState<string | null>(null);
  const [pinCurrent, setPinCurrent] = useState("");
  const [pinNew, setPinNew] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
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
  const [loading, setLoading] = useState(true);
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/viewer/settings", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          account?: { name?: string; email?: string; phoneNumber?: string };
          address?: {
            residentialAddress?: string;
            city?: string;
            provinceState?: string;
            postalCode?: string;
            country?: string;
          };
          preferences?: { notifyEmail?: boolean; playbackQuality?: string | null };
          paymentMethods?: PaymentMethod[];
          profiles?: ViewerProfile[];
          activeProfileId?: string | null;
          subscription?: ViewerSubscription | null;
          warnings?: string[];
        };
        if (!res.ok) throw new Error(data.error || "Failed to load settings");
        if (cancelled) return;

        const account = data.account ?? {};
        setName(account.name ?? "");
        setEmail(account.email ?? "");
        setPhoneNumber(account.phoneNumber ?? "");

        const addr = data.address ?? {};
        setResidentialAddress(addr.residentialAddress ?? "");
        setCity(addr.city ?? "");
        setProvinceState(addr.provinceState ?? "");
        setPostalCode(addr.postalCode ?? "");
        setCountry(addr.country?.trim() || "South Africa");

        const prefs = data.preferences ?? {};
        if (prefs.notifyEmail !== undefined) setNotifyEmail(prefs.notifyEmail);
        setPlaybackQuality(prefs.playbackQuality?.trim() || "auto");

        setPaymentMethods(Array.isArray(data.paymentMethods) ? data.paymentMethods : []);

        const list = Array.isArray(data.profiles) ? data.profiles : [];
        const enhanced: ViewerProfile[] = list.map((item, index) => ({
          ...item,
          pinEnabled: Boolean((item as { pinEnabled?: boolean }).pinEnabled),
          isMaster: index === 0,
        }));
        setProfiles(enhanced);

        const activeId = data.activeProfileId ?? null;
        setIsMasterActive(!!enhanced.length && activeId === enhanced[0].id);

        const sub = data.subscription ?? null;
        setSubscription(sub);
        setProfileLimit(sub?.profileLimit ?? sub?.deviceCount ?? 1);
        setLoadWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load settings");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted]);

  async function saveAccountInfo(e: React.FormEvent) {
    e.preventDefault();
    setSavingAccount(true);
    setError("");
    setSuccess("");
    if (!name.trim()) {
      setError("Profile name is required");
      setSavingAccount(false);
      return;
    }
    if (!email.trim()) {
      setError("Email is required");
      setSavingAccount(false);
      return;
    }
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phoneNumber: phoneNumber.trim(),
          residentialAddress: residentialAddress.trim(),
          city: city.trim(),
          provinceState: provinceState.trim(),
          postalCode: postalCode.trim(),
          country: country.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to update account");
      if (data.billingAddress) {
        const addr = data.billingAddress as {
          residentialAddress?: string;
          city?: string;
          provinceState?: string;
          postalCode?: string;
          country?: string;
        };
        setResidentialAddress(addr.residentialAddress ?? "");
        setCity(addr.city ?? "");
        setProvinceState(addr.provinceState ?? "");
        setPostalCode(addr.postalCode ?? "");
        setCountry(addr.country?.trim() || "South Africa");
      }
      setSuccess("Account details saved");
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
        body: JSON.stringify({ notifyEmail: Boolean(notifyEmail), playbackQuality }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save preferences");
      setSuccess("Preferences saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save preferences");
    } finally {
      setSavingPrefs(false);
    }
  }

  async function addPaymentMethod(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const label = newPaymentLabel.trim();
    const lastFour = newPaymentLastFour.replace(/\D/g, "").slice(-4);
    if (!label || lastFour.length !== 4) {
      setError("Enter a label and the last 4 digits of the card.");
      return;
    }
    const res = await fetch("/api/viewer/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, lastFour }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const m = data as PaymentMethod;
      setPaymentMethods((prev) => [m, ...prev]);
      setNewPaymentLabel("");
      setNewPaymentLastFour("");
      setSuccess("Payment method added");
    } else {
      setError(data?.error || "Failed to add payment method");
    }
  }

  async function setDefaultPayment(id: string) {
    setError("");
    const res = await fetch("/api/viewer/payment-methods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isDefault: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setPaymentMethods((prev) => prev.map((p) => ({ ...p, isDefault: p.id === id })));
    } else {
      setError(data?.error || "Failed to update default payment method");
    }
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

  function resetPinEditor() {
    setPinEditorId(null);
    setPinCurrent("");
    setPinNew("");
    setPinConfirm("");
  }

  async function saveProfilePin(profile: ViewerProfile, enable: boolean) {
    if (!isMasterActive) return;
    if (enable) {
      if (pinNew.length !== 4 || pinConfirm.length !== 4) {
        setError("Enter and confirm a 4-digit PIN.");
        return;
      }
      if (pinNew !== pinConfirm) {
        setError("PIN confirmation does not match.");
        return;
      }
      if (profile.pinEnabled && !pinCurrent) {
        setError("Enter the current PIN to change it.");
        return;
      }
    } else if (profile.pinEnabled && !pinCurrent) {
      setError("Enter the current PIN to turn off protection.");
      return;
    }

    setSavingProfileId(profile.id);
    setError("");
    const res = await fetch("/api/viewer/profiles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: profile.id,
        pinEnabled: enable,
        ...(enable ? { pin: pinNew } : { removePin: true }),
        ...(profile.pinEnabled && pinCurrent ? { currentPin: pinCurrent } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.profile) {
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === profile.id ? { ...p, ...data.profile, isMaster: p.isMaster, pinEnabled: data.profile.pinEnabled } : p
        )
      );
      setSuccess(enable ? "Profile PIN protection enabled." : "Profile PIN protection removed.");
      resetPinEditor();
    } else {
      setError(data?.error || "Failed to update profile PIN");
    }
    setSavingProfileId(null);
  }

  async function addProfile(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newProfileName.trim();
    if (!trimmed) return;
    if (!birthYear || !birthMonth || !birthDay) {
      setError("Please enter date of birth for the profile");
      return;
    }
    if (newProfilePinEnabled) {
      if (newProfilePin.length !== 4 || newProfilePinConfirm.length !== 4) {
        setError("Enter and confirm a 4-digit PIN for the new profile.");
        return;
      }
      if (newProfilePin !== newProfilePinConfirm) {
        setError("PIN confirmation does not match.");
        return;
      }
    }
    const res = await fetch("/api/viewer/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: trimmed,
        birthYear,
        birthMonth,
        birthDay,
        pinEnabled: newProfilePinEnabled,
        ...(newProfilePinEnabled ? { pin: newProfilePin } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.profile) {
      const profile = data.profile as ViewerProfile;
      setProfiles((prev) => [...prev, { ...profile, isMaster: false, pinEnabled: Boolean(profile.pinEnabled) }]);
      setNewProfileName("");
      setBirthYear("");
      setBirthMonth("");
      setBirthDay("");
      setNewProfilePinEnabled(false);
      setNewProfilePin("");
      setNewProfilePinConfirm("");
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

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <StoryTimeLoader size="sm" hideTrack />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div> : null}
      {loadWarnings.length > 0 ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
          {loadWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
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
          <div className="border-t border-white/10 pt-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
              <MapPin className="h-4 w-4 text-slate-400" /> Billing address
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2 block">
                <span className="mb-1 block text-sm text-slate-400">Street address</span>
                <input value={residentialAddress} onChange={(e) => setResidentialAddress(e.target.value)} className="storytime-input w-full px-4 py-2.5" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-slate-400">City</span>
                <input value={city} onChange={(e) => setCity(e.target.value)} className="storytime-input w-full px-4 py-2.5" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-slate-400">Province / state</span>
                <input value={provinceState} onChange={(e) => setProvinceState(e.target.value)} className="storytime-input w-full px-4 py-2.5" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-slate-400">Postal code</span>
                <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="storytime-input w-full px-4 py-2.5" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-slate-400">Country</span>
                <input value={country} onChange={(e) => setCountry(e.target.value)} className="storytime-input w-full px-4 py-2.5" />
              </label>
            </div>
          </div>
          <button type="submit" disabled={savingAccount} className="rounded-xl viewer-btn-primary px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5 disabled:opacity-50">
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

              <div className="mt-4 rounded-lg border border-white/8 bg-black/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-white flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      Profile PIN
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {profile.pinEnabled
                        ? "PIN required when selecting this profile."
                        : "Optional 4-digit PIN to lock this profile."}
                    </p>
                  </div>
                  {isMasterActive ? (
                    <button
                      type="button"
                      disabled={!!savingProfileId}
                      onClick={() => {
                        if (pinEditorId === profile.id) {
                          resetPinEditor();
                        } else {
                          resetPinEditor();
                          setPinEditorId(profile.id);
                        }
                      }}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-200 hover:bg-white/[0.06] disabled:opacity-50"
                    >
                      {pinEditorId === profile.id ? "Close" : profile.pinEnabled ? "Change PIN" : "Set PIN"}
                    </button>
                  ) : null}
                </div>

                {pinEditorId === profile.id && isMasterActive ? (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {profile.pinEnabled ? (
                      <div>
                        <label className="mb-1 block text-xs text-slate-400">Current PIN</label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          value={pinCurrent}
                          onChange={(e) => setPinCurrent(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          className="storytime-input w-full px-3 py-2 text-sm"
                        />
                      </div>
                    ) : null}
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">
                        {profile.pinEnabled ? "New PIN" : "PIN"}
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={pinNew}
                        onChange={(e) => setPinNew(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className="storytime-input w-full px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">Confirm PIN</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={pinConfirm}
                        onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className="storytime-input w-full px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!!savingProfileId}
                        onClick={() => saveProfilePin(profile, true)}
                        className="rounded-lg viewer-btn-primary px-3 py-2 text-xs font-semibold disabled:opacity-50"
                      >
                        {profile.pinEnabled ? "Update PIN" : "Enable PIN"}
                      </button>
                      {profile.pinEnabled ? (
                        <button
                          type="button"
                          disabled={!!savingProfileId}
                          onClick={() => saveProfilePin(profile, false)}
                          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.04] disabled:opacity-50"
                        >
                          Remove PIN
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
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
          <label className="flex w-full items-center gap-2 text-sm text-slate-300 sm:w-auto">
            <input
              type="checkbox"
              checked={newProfilePinEnabled}
              disabled={!isMasterActive || profiles.length >= profileLimit}
              onChange={(e) => {
                setNewProfilePinEnabled(e.target.checked);
                if (!e.target.checked) {
                  setNewProfilePin("");
                  setNewProfilePinConfirm("");
                }
              }}
            />
            Protect with PIN
          </label>
          {newProfilePinEnabled ? (
            <>
              <div>
                <label className="mb-1 block text-xs text-slate-400">PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newProfilePin}
                  onChange={(e) => setNewProfilePin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  disabled={!isMasterActive || profiles.length >= profileLimit}
                  className="storytime-input w-24 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Confirm</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newProfilePinConfirm}
                  onChange={(e) => setNewProfilePinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  disabled={!isMasterActive || profiles.length >= profileLimit}
                  className="storytime-input w-24 px-3 py-2 text-sm"
                />
              </div>
            </>
          ) : null}
          <button
            type="submit"
            disabled={!isMasterActive || profiles.length >= profileLimit}
            className="rounded-xl viewer-btn-primary px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
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
        <button type="button" onClick={() => setShowPlanModal(true)} className="rounded-xl viewer-btn-primary px-4 py-2.5 text-sm font-semibold">
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
          <button type="submit" className="flex items-center gap-2 rounded-xl viewer-btn-primary px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-0.5">
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>
      </section>

      {showPlanModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-black p-6 shadow-panel">
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
