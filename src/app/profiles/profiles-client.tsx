"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, User, Shield, Users, CheckCircle, AlertCircle, Settings, Lock } from "lucide-react";
import { getBirthDateOptionSets } from "@/lib/viewer-profiles";
import { ProfilePinModal } from "@/components/viewer/profile-pin-modal";
import { LogOutButton } from "@/components/auth/log-out-button";
import { SubscriptionResumeButton } from "@/components/viewer/subscription-resume-checkout";

type Profile = {
  id: string;
  name: string;
  age: number;
  dateOfBirth: string | null;
  updatedAt: string | Date;
  pinEnabled?: boolean;
};

function ageLabel(age: number): string {
  if (age <= 12) return "Kids";
  if (age <= 15) return "Teen";
  return "Adult";
}

export function ProfilesClient({
  initialProfiles,
  maxProfiles,
  deviceCount,
  viewerModel,
  accountDetailsIncomplete = false,
  subscriptionStatus = "ACTIVE",
  needsReactivation = false,
  paymentRequired = false,
  paymentStillProcessing = false,
  pendingPaymentRecordId = null,
  pendingPinProfile = null,
}: {
  initialProfiles: Profile[];
  maxProfiles: number;
  deviceCount: number;
  viewerModel: "SUBSCRIPTION" | "PPV";
  accountDetailsIncomplete?: boolean;
  subscriptionStatus?: string;
  needsReactivation?: boolean;
  paymentRequired?: boolean;
  paymentStillProcessing?: boolean;
  pendingPaymentRecordId?: string | null;
  pendingPinProfile?: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles ?? []);
  const [creating, setCreating] = useState(viewerModel === "PPV" && (initialProfiles?.length ?? 0) === 0);
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState<number | "">("");
  const [birthMonth, setBirthMonth] = useState<number | "">("");
  const [birthDay, setBirthDay] = useState<number | "">("");
  const [pinEnabledOnCreate, setPinEnabledOnCreate] = useState(false);
  const [createPin, setCreatePin] = useState("");
  const [createPinConfirm, setCreatePinConfirm] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pinModalProfile, setPinModalProfile] = useState<Profile | null>(null);
  const [pinModalError, setPinModalError] = useState("");
  const paymentPendingCheckout = paymentRequired || subscriptionStatus === "PAST_DUE";
  const needsPlanReactivation = needsReactivation && !paymentPendingCheckout && !paymentStillProcessing;
  const paymentBlocked = !paymentStillProcessing && (paymentPendingCheckout || needsPlanReactivation);
  const canCreateMore = profiles.length < maxProfiles;
  const { years, months } = getBirthDateOptionSets();
  const days = useMemo(() => {
    if (!birthYear || !birthMonth) {
      return Array.from({ length: 31 }, (_, index) => index + 1);
    }
    const dayCount = new Date(Date.UTC(birthYear, birthMonth, 0)).getUTCDate();
    return Array.from({ length: dayCount }, (_, index) => index + 1);
  }, [birthYear, birthMonth]);

  useEffect(() => {
    if (!paymentStillProcessing || !pendingPaymentRecordId) return;
    let cancelled = false;
    const poll = async () => {
      for (let i = 0; i < 60 && !cancelled; i++) {
        try {
          const res = await fetch(
            `/api/payments/status?paymentRecordId=${encodeURIComponent(pendingPaymentRecordId)}`,
            { cache: "no-store" },
          );
          const data = await res.json().catch(() => ({}));
          if (String(data?.payment?.status || "").toUpperCase() === "SUCCEEDED") {
            router.refresh();
            return;
          }
        } catch {
          // retry
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [paymentStillProcessing, pendingPaymentRecordId, router]);

  useEffect(() => {
    if (!pendingPinProfile) return;
    const profile = profiles.find((p) => p.id === pendingPinProfile.id);
    if (profile) {
      setPinModalProfile(profile);
    } else {
      setPinModalProfile({
        id: pendingPinProfile.id,
        name: pendingPinProfile.name,
        age: 0,
        dateOfBirth: null,
        updatedAt: new Date().toISOString(),
        pinEnabled: true,
      });
    }
  }, [pendingPinProfile, profiles]);

  async function activateProfile(profileId: string, pin?: string) {
    setError("");
    setPinModalError("");
    setLoading(profileId);
    try {
      const res = await fetch("/api/viewer/profiles/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, ...(pin ? { pin } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && data.requiresPin) {
        const profile = profiles.find((p) => p.id === profileId);
        if (profile) setPinModalProfile(profile);
        return;
      }
      if (!res.ok) {
        if (data.requiresPin) {
          setPinModalError(data.error || "Incorrect PIN");
          return;
        }
        throw new Error(data.error || "Failed to select profile");
      }
      setPinModalProfile(null);
      router.push("/browse");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to select profile");
    } finally {
      setLoading(null);
    }
  }

  function requestProfile(profile: Profile) {
    if (paymentBlocked) {
      setError("Complete your subscription payment before entering the catalogue.");
      return;
    }
    if (profile.pinEnabled) {
      setPinModalError("");
      setPinModalProfile(profile);
      return;
    }
    void activateProfile(profile.id);
  }

  async function createProfile() {
    setError("");
    if (!name.trim()) {
      setError("Please enter a profile name.");
      return;
    }
    if (!canCreateMore) {
      setError(
        maxProfiles === 1
          ? "This viewer account supports a single profile only."
          : `This package supports up to ${maxProfiles} profiles.`
      );
      return;
    }
    if (!birthYear || !birthMonth || !birthDay) {
      setError("Please select the full date of birth.");
      return;
    }
    if (pinEnabledOnCreate) {
      if (createPin.length !== 4 || createPinConfirm.length !== 4) {
        setError("Enter and confirm a 4-digit PIN.");
        return;
      }
      if (createPin !== createPinConfirm) {
        setError("PIN confirmation does not match.");
        return;
      }
    }

    setLoading("create");
    try {
      const res = await fetch("/api/viewer/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          birthYear,
          birthMonth,
          birthDay,
          pinEnabled: pinEnabledOnCreate,
          ...(pinEnabledOnCreate ? { pin: createPin } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create profile");
      setProfiles((prev) => [...prev, data.profile]);
      setCreating(false);
      setName("");
      setBirthYear("");
      setBirthMonth("");
      setBirthDay("");
      setPinEnabledOnCreate(false);
      setCreatePin("");
      setCreatePinConfirm("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create profile");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex shrink-0 justify-end">
        <LogOutButton label="Log out to home" />
      </div>

      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold text-white md:text-4xl">Who’s watching?</h1>
        <p className="max-w-2xl text-slate-300/78">
          {viewerModel === "PPV"
            ? "This PPV account uses one viewer profile. Each purchased film stays unlocked for 30 days on this account."
            : "Create a profile for each household member. Each profile gets its own watch history, recommendations, and age-based censorship."}
        </p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="storytime-kpi p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 flex items-center gap-2">
              <Users className="w-4 h-4" /> Profiles
            </p>
            <p className="text-2xl font-bold text-white mt-1">
              {profiles.length} / {maxProfiles}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {deviceCount} device{deviceCount !== 1 ? "s" : ""} / profile{maxProfiles !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="storytime-kpi p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Censorship
            </p>
            <p className="text-sm text-slate-300 mt-1">
              Titles are hidden if the profile’s age is below the content’s minimum age.
            </p>
          </div>
          <div className="storytime-kpi p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500 flex items-center gap-2">
              <Lock className="w-4 h-4" /> Profile PIN
            </p>
            <p className="text-sm text-slate-300 mt-1">
              Optionally protect a profile with a 4-digit PIN. Manage PINs anytime in account settings.
            </p>
          </div>
        </div>
      </div>

      {paymentStillProcessing ? (
        <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-sm text-cyan-100 shadow-panel">
          <p className="font-medium text-white">Confirming your payment</p>
          <p className="mt-1 text-cyan-100/90">
            PayFast is sending secure confirmation. This usually takes a few seconds — you can create profiles while we finish activating your subscription.
          </p>
        </div>
      ) : null}

      {paymentBlocked ? (
        <div className="rounded-xl border border-orange-400/30 bg-orange-500/10 p-4 text-sm text-orange-100 shadow-panel">
          <p className="font-medium text-white">Subscription payment required</p>
          <p className="mt-1 text-orange-100/90">
            {needsPlanReactivation
              ? "Your trial or billing period has ended. Pay for your current plan to start watching again."
              : "Complete payment to activate your subscription and access the catalogue."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SubscriptionResumeButton label="Pay now" className="inline-flex rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-60" />
            <Link
              href="/browse/account/change-plan"
              onClick={() => {
                if (typeof window !== "undefined") {
                  sessionStorage.removeItem("st_pending_viewer_checkout");
                }
              }}
              className="inline-flex rounded-lg border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.07]"
            >
              Switch plan
            </Link>
          </div>
        </div>
      ) : null}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 shadow-panel">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {accountDetailsIncomplete && !paymentBlocked ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/12 bg-black px-4 py-3 shadow-panel">
          <p className="text-sm text-slate-300">
            Account details (email, phone, billing address) are not complete yet.
          </p>
          <Link
            href="/onboarding/account"
            className="inline-flex items-center gap-2 rounded-lg border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-sm font-medium text-orange-200 hover:bg-orange-500/15"
          >
            <Settings className="h-4 w-4" />
            Complete account setup
          </Link>
        </div>
      ) : null}

      {profiles.length === 0 && !creating && (
        <div className="mb-6 rounded-2xl border border-orange-400/20 bg-orange-500/6 p-6 shadow-panel">
          <p className="text-orange-200 font-medium">
            {viewerModel === "PPV" ? "Create your viewer profile to continue." : "Create your first profile to start watching."}
          </p>
          <p className="text-slate-400 text-sm mt-1">
            {viewerModel === "PPV"
              ? "PPV accounts support one profile only."
              : "Each profile has its own watch history, recommendations, and age-appropriate catalogue driven by date of birth."}
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-4 rounded-xl bg-orange-500 px-5 py-2.5 font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400"
          >
            Create profile
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => requestProfile(p)}
            disabled={loading !== null || paymentBlocked}
            className="storytime-section group p-5 text-left hover:-translate-y-1 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-400/20 bg-orange-500/10">
                    <User className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {ageLabel(p.age)} · Age {p.age}
                      {p.pinEnabled ? " · PIN protected" : ""}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Personalized feed + censorship based on this profile.
                </p>
              </div>
              <div className="text-xs text-slate-500">
                {loading === p.id ? "Loading…" : p.pinEnabled ? "Enter PIN" : "Select"}
              </div>
            </div>
          </button>
        ))}

        <button
          type="button"
          onClick={() => setCreating(true)}
          disabled={!canCreateMore || loading !== null}
          className="storytime-empty-state p-5 text-left disabled:opacity-50 hover:bg-white/[0.04]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04]">
              <Plus className="w-5 h-5 text-slate-300" />
            </div>
            <div>
              <p className="text-white font-semibold">{canCreateMore ? "Add profile" : "Profile limit reached"}</p>
              <p className="text-xs text-slate-500">
                {canCreateMore
                  ? "Create a separate sub-account for a household member."
                  : maxProfiles === 1
                    ? "This account supports one profile only."
                    : `This package supports up to ${maxProfiles} profiles.`}
              </p>
            </div>
          </div>
        </button>
      </div>

      {creating && (
        <div className="storytime-section space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Create a profile</h2>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-sm text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-slate-400">Profile name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Adults, Mom, Sipho"
                className="storytime-input px-3 py-2.5"
              />
            </div>
            <div className="space-y-1 md:col-span-1">
              <label className="text-xs text-slate-400">Date of birth</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <select
                  value={birthYear}
                  onChange={(e) => {
                    const value = e.target.value ? Number(e.target.value) : "";
                    setBirthYear(value);
                    setBirthDay("");
                  }}
                  className="storytime-input px-3 py-2.5"
                >
                  <option value="">Year</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
                <select
                  value={birthMonth}
                  onChange={(e) => {
                    const value = e.target.value ? Number(e.target.value) : "";
                    setBirthMonth(value);
                    setBirthDay("");
                  }}
                  className="storytime-input px-3 py-2.5"
                >
                  <option value="">Month</option>
                  {months.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
                <select
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value ? Number(e.target.value) : "")}
                  className="storytime-input px-3 py-2.5"
                >
                  <option value="">Day</option>
                  {days.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-500">
                The app calculates age automatically from the birth date and applies the correct censorship rules.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4 space-y-3">
            <label className="flex items-start gap-3 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={pinEnabledOnCreate}
                onChange={(e) => {
                  setPinEnabledOnCreate(e.target.checked);
                  if (!e.target.checked) {
                    setCreatePin("");
                    setCreatePinConfirm("");
                  }
                }}
                className="mt-1"
              />
              <span>
                <span className="font-medium text-white">Protect this profile with a PIN</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Optional. Anyone selecting this profile will need the 4-digit PIN.
                </span>
              </span>
            </label>
            {pinEnabledOnCreate ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-7">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={createPin}
                    onChange={(e) => setCreatePin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="storytime-input w-full px-3 py-2.5"
                    placeholder="4 digits"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Confirm PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={createPinConfirm}
                    onChange={(e) => setCreatePinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="storytime-input w-full px-3 py-2.5"
                    placeholder="4 digits"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-slate-200 hover:bg-white/[0.05]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={createProfile}
              disabled={loading !== null}
              className="rounded-xl bg-orange-500 px-5 py-2.5 font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400 disabled:opacity-50"
            >
              {loading === "create" ? "Creating…" : "Create profile"}
            </button>
          </div>
        </div>
      )}

      <ProfilePinModal
        open={!!pinModalProfile}
        profileName={pinModalProfile?.name ?? ""}
        loading={!!pinModalProfile && loading === pinModalProfile.id}
        error={pinModalError}
        onCancel={() => {
          setPinModalProfile(null);
          setPinModalError("");
        }}
        onSubmit={(pin) => {
          if (pinModalProfile) void activateProfile(pinModalProfile.id, pin);
        }}
      />
    </div>
  );
}
