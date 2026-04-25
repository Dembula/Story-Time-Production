"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { tryNormalizeAvatarImageUrl } from "@/lib/avatar-image-url";
import { parseEmbeddedMeta } from "@/lib/marketplace-profile-meta";
import {
  User,
  Save,
  ArrowLeft,
  GraduationCap,
  Shield,
  Globe,
  ChevronDown,
  ChevronUp,
  Building2,
  CreditCard,
  ArrowDownToLine,
  FolderArchive,
  Upload,
  Loader2,
} from "lucide-react";
import { CreatorAccountVaultHub } from "@/components/creator/creator-account-vault-hub";
import { CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY } from "@/lib/pricing";

type CreatorRevenuePayload = {
  revenue: number;
  watchTime: number;
  share: number;
  totalViews: number;
  banking: {
    bankName: string;
    accountNumberLast4: string;
    accountType: string;
    verified: boolean;
  } | null;
  payouts: { id: string; amount: number; currency: string; status: string; period: string; paidAt: string | null }[];
};

const ACCOUNT_TABS = ["profile", "security", "banking", "public", "registry"] as const;
type AccountTab = (typeof ACCOUNT_TABS)[number];

function isValidAccountTab(s: string): s is AccountTab {
  return (ACCOUNT_TABS as readonly string[]).includes(s);
}

function parseAccountTabParam(raw: string | null): AccountTab {
  if (raw && isValidAccountTab(raw)) return raw;
  return "profile";
}

type StudioRegistration = { structure: "INDIVIDUAL" | "COMPANY"; seats: number | null };

function deriveStudioRegistration(user: {
  role?: string;
  goals?: string | null;
  creatorAccountStructure?: string | null;
  creatorTeamSeatCap?: number | null;
}): StudioRegistration | null {
  const role = user.role;
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR") return null;
  const col = user.creatorAccountStructure;
  if (col === "INDIVIDUAL" || col === "COMPANY") {
    return {
      structure: col,
      seats: typeof user.creatorTeamSeatCap === "number" ? user.creatorTeamSeatCap : null,
    };
  }
  const { meta } = parseEmbeddedMeta<Record<string, unknown>>(user.goals ?? null);
  const s = meta?.accountStructure;
  if (s === "INDIVIDUAL" || s === "COMPANY") {
    const tc = meta?.teamSeatCap;
    const seats = typeof tc === "number" && Number.isFinite(tc) ? tc : null;
    return { structure: s, seats };
  }
  return null;
}

const ACCOUNT_TAB_ITEMS: { id: AccountTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security & contact" },
  { id: "banking", label: "Banking & payouts" },
  { id: "public", label: "Public profile" },
  { id: "registry", label: "Registry & compliance" },
];

const SOCIAL_KEYS = ["instagram", "x", "youtube", "tiktok", "linkedin", "facebook"] as const;
type SocialKey = (typeof SOCIAL_KEYS)[number];

const emptySocial = (): Record<SocialKey, string> => ({
  instagram: "",
  x: "",
  youtube: "",
  tiktok: "",
  linkedin: "",
  facebook: "",
});

function parseSocialLinks(raw: unknown): {
  structured: Record<SocialKey, string>;
  extra: Record<string, string>;
} {
  let obj: Record<string, unknown> = {};
  if (raw == null) return { structured: emptySocial(), extra: {} };
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return { structured: emptySocial(), extra: {} };
    try {
      obj = JSON.parse(t) as Record<string, unknown>;
    } catch {
      return { structured: emptySocial(), extra: { note: t } };
    }
  } else if (typeof raw === "object") {
    obj = { ...(raw as Record<string, unknown>) };
  }
  const structured = emptySocial();
  structured.instagram = String(obj.instagram ?? "");
  structured.x = String(obj.x ?? obj.twitter ?? "");
  structured.youtube = String(obj.youtube ?? "");
  structured.tiktok = String(obj.tiktok ?? "");
  structured.linkedin = String(obj.linkedin ?? "");
  structured.facebook = String(obj.facebook ?? "");
  const extra: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (["instagram", "x", "twitter", "youtube", "tiktok", "linkedin", "facebook"].includes(k)) continue;
    if (typeof v === "string" && v.trim()) extra[k] = v.trim();
  }
  return { structured, extra };
}

function buildSocialLinksJson(
  structured: Record<SocialKey, string>,
  extra: Record<string, string>,
  advancedOpen: boolean,
  advancedRaw: string,
): string {
  if (advancedOpen && advancedRaw.trim()) {
    try {
      const parsed = JSON.parse(advancedRaw) as Record<string, unknown>;
      const o: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string" && v.trim()) o[k] = v.trim();
      }
      if (Object.keys(o).length > 0) return JSON.stringify(o);
    } catch {
      /* fall through to structured + extra */
    }
  }
  const o: Record<string, string> = { ...extra };
  delete o.twitter;
  const put = (key: string, val: string) => {
    const t = val.trim();
    if (t) o[key] = t;
    else delete o[key];
  };
  put("instagram", structured.instagram);
  put("x", structured.x);
  put("youtube", structured.youtube);
  put("tiktok", structured.tiktok);
  put("linkedin", structured.linkedin);
  put("facebook", structured.facebook);
  return JSON.stringify(o);
}

export function CreatorAccountClient({ backHref = "/creator/command-center" }: { backHref?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = parseAccountTabParam(searchParams.get("tab"));
  const { update: updateSession } = useSession();
  const [profile, setProfile] = useState({
    name: "",
    bio: "",
    education: "",
    goals: "",
    previousWork: "",
    isAfdaStudent: false,
  });
  const [security, setSecurity] = useState({
    email: "",
    phoneNumber: "",
    currentPassword: "",
    newPassword: "",
  });
  const [initialEmail, setInitialEmail] = useState("");
  const [initialPhone, setInitialPhone] = useState("");
  const [network, setNetwork] = useState({
    headline: "",
    location: "",
    website: "",
    image: "",
  });
  const networkRef = useRef(network);
  networkRef.current = network;
  const [social, setSocial] = useState(emptySocial());
  const socialExtraRef = useRef<Record<string, string>>({});
  const [socialAdvancedOpen, setSocialAdvancedOpen] = useState(false);
  const [socialAdvancedJson, setSocialAdvancedJson] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [savingNetwork, setSavingNetwork] = useState(false);
  const [uploadingProfilePhoto, setUploadingProfilePhoto] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [studioRegistration, setStudioRegistration] = useState<StudioRegistration | null>(null);
  const [revenueData, setRevenueData] = useState<CreatorRevenuePayload | null>(null);
  const [revenuePeriod, setRevenuePeriod] = useState<"month" | "quarter">("month");
  const [loadingRevenue, setLoadingRevenue] = useState(true);
  const [revenueLoadFailed, setRevenueLoadFailed] = useState(false);
  const [bankForm, setBankForm] = useState({
    bankName: "",
    accountNumber: "",
    accountType: "CHEQUE",
    branchCode: "",
  });
  const [submittingBank, setSubmittingBank] = useState(false);

  const { data: licenseForSuites } = useQuery({
    queryKey: [...CREATOR_DISTRIBUTION_LICENSE_QUERY_KEY],
    queryFn: () => fetch("/api/creator/distribution-license").then((r) => r.json()),
  });
  const accountTabs = useMemo(() => {
    const s = licenseForSuites?.suiteAccess as Record<string, boolean> | undefined;
    if (!s || s.analytics !== false) return ACCOUNT_TAB_ITEMS;
    return ACCOUNT_TAB_ITEMS.filter((t) => t.id !== "banking");
  }, [licenseForSuites]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((r) => r.json())
      .then((user) => {
        if (cancelled || !user?.email) return;
        setStudioRegistration(deriveStudioRegistration(user));
        setProfile({
          name: user.name ?? "",
          bio: user.bio ?? "",
          education: user.education ?? "",
          goals: user.goals ?? "",
          previousWork: user.previousWork ?? "",
          isAfdaStudent: Boolean(user.isAfdaStudent),
        });
        setInitialEmail(user.email ?? "");
        setInitialPhone(user.phoneNumber ?? "");
        setSecurity({
          email: user.email ?? "",
          phoneNumber: user.phoneNumber ?? "",
          currentPassword: "",
          newPassword: "",
        });
        setNetwork({
          headline: user.headline ?? "",
          location: user.location ?? "",
          website: user.website ?? "",
          image: user.image ?? "",
        });
        const { structured, extra } = parseSocialLinks(user.socialLinks);
        setSocial(structured);
        socialExtraRef.current = extra;
        const hasExtra = Object.keys(extra).length > 0;
        setSocialAdvancedOpen(hasExtra);
        setSocialAdvancedJson(hasExtra ? JSON.stringify(extra, null, 2) : "");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const s = licenseForSuites?.suiteAccess as Record<string, boolean> | undefined;
    if (s && s.analytics === false) {
      setRevenueData(null);
      setRevenueLoadFailed(false);
      setLoadingRevenue(false);
      return;
    }
    let cancelled = false;
    setLoadingRevenue(true);
    setRevenueLoadFailed(false);
    void fetch(`/api/creator/revenue?period=${revenuePeriod}`)
      .then(async (r) => {
        if (!r.ok) return { ok: false as const, data: null };
        const data = await r.json().catch(() => null);
        return { ok: true as const, data };
      })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok || !result.data || typeof result.data.revenue !== "number") {
          setRevenueData(null);
          setRevenueLoadFailed(true);
          return;
        }
        setRevenueData(result.data as CreatorRevenuePayload);
        setRevenueLoadFailed(false);
      })
      .finally(() => {
        if (!cancelled) setLoadingRevenue(false);
      });
    return () => {
      cancelled = true;
    };
  }, [revenuePeriod, licenseForSuites]);

  useEffect(() => {
    const raw = searchParams.get("tab");
    if (raw == null) return;
    if (!isValidAccountTab(raw)) {
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, router, pathname]);

  function goToAccountTab(next: AccountTab) {
    if (next === "profile") {
      router.replace(pathname, { scroll: false });
    } else {
      router.replace(`${pathname}?tab=${next}`, { scroll: false });
    }
  }

  useEffect(() => {
    const s = licenseForSuites?.suiteAccess as Record<string, boolean> | undefined;
    if (!s || s.analytics !== false) return;
    if (activeTab === "banking") {
      goToAccountTab("profile");
    }
  }, [licenseForSuites, activeTab, pathname, router]);

  function flashSuccess(msg: string) {
    setSuccess(msg);
    setError("");
    setTimeout(() => setSuccess(""), 3500);
  }

  function flashError(msg: string) {
    setError(msg);
    setSuccess("");
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setError("");
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          bio: profile.bio,
          education: profile.education,
          goals: profile.goals,
          previousWork: profile.previousWork,
          isAfdaStudent: profile.isAfdaStudent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flashError(typeof data.error === "string" ? data.error : "Could not save profile.");
        return;
      }
      if (data?.name != null && updateSession) {
        await updateSession({ name: data.name }).catch(() => {});
      }
      flashSuccess("Profile saved.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveSecurity(e: React.FormEvent) {
    e.preventDefault();
    setSavingSecurity(true);
    setError("");
    try {
      const body: Record<string, unknown> = {};
      const em = security.email.trim().toLowerCase();
      if (em && em !== initialEmail.toLowerCase()) body.email = em;
      if (security.phoneNumber.trim() !== initialPhone.trim()) {
        body.phoneNumber = security.phoneNumber.trim() || null;
      }
      if (security.newPassword) {
        body.currentPassword = security.currentPassword;
        body.newPassword = security.newPassword;
      }
      if (Object.keys(body).length === 0) {
        flashError("Change your email, phone, or password before saving.");
        return;
      }
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flashError(typeof data.error === "string" ? data.error : "Could not update security.");
        return;
      }
      if (body.email) setInitialEmail(data.email ?? em);
      if (body.phoneNumber !== undefined) setInitialPhone(data.phoneNumber ?? "");
      setSecurity((s) => ({ ...s, currentPassword: "", newPassword: "" }));
      if (body.email && updateSession && data?.email) {
        await updateSession({ email: data.email }).catch(() => {});
      }
      flashSuccess("Security settings updated.");
    } finally {
      setSavingSecurity(false);
    }
  }

  async function submitBank(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingBank(true);
    setError("");
    try {
      const res = await fetch("/api/creator/banking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bankForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flashError(typeof data.error === "string" ? data.error : "Could not save banking details.");
        return;
      }
      setBankForm({ bankName: "", accountNumber: "", accountType: "CHEQUE", branchCode: "" });
      const revRes = await fetch(`/api/creator/revenue?period=${revenuePeriod}`);
      const rev = revRes.ok ? await revRes.json().catch(() => null) : null;
      if (rev && typeof rev.revenue === "number") setRevenueData(rev as CreatorRevenuePayload);
      flashSuccess("Banking details saved.");
    } finally {
      setSubmittingBank(false);
    }
  }

  async function persistPublicProfile(net: typeof network): Promise<boolean> {
    const imgCheck = tryNormalizeAvatarImageUrl(net.image);
    if (!imgCheck.ok) {
      flashError(imgCheck.message);
      return false;
    }
    const socialLinks = buildSocialLinksJson(social, socialExtraRef.current, socialAdvancedOpen, socialAdvancedJson);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        headline: net.headline || undefined,
        location: net.location || undefined,
        website: net.website || undefined,
        image: imgCheck.value,
        socialLinks,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      flashError(typeof data.error === "string" ? data.error : "Could not save public profile.");
      return false;
    }
    const { structured, extra } = parseSocialLinks(data.socialLinks);
    setSocial(structured);
    socialExtraRef.current = extra;
    const nextNet = { ...net, image: data.image != null ? String(data.image) : "" };
    setNetwork(nextNet);
    networkRef.current = nextNet;
    if (updateSession) {
      await updateSession({ image: data.image ?? null }).catch(() => {});
    }
    return true;
  }

  async function saveNetwork(e: React.FormEvent) {
    e.preventDefault();
    setSavingNetwork(true);
    setError("");
    try {
      const ok = await persistPublicProfile(network);
      if (ok) flashSuccess("Public profile saved.");
    } finally {
      setSavingNetwork(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const backLabel = backHref.includes("command-center") ? "Back to Command Center" : "Back to dashboard";

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-8">
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="w-4 h-4" /> {backLabel}
      </Link>

      <header className="storytime-plan-card p-5 md:p-6">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">Creator account</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl flex items-center gap-3">
          <User className="w-8 h-8 text-orange-500 shrink-0" />
          Account
        </h1>
        <p className="mt-2 text-sm text-slate-400 md:text-base">
          Profile, security, banking & payouts, public presence, and an extended registry vault for KYC-style data.
        </p>
        {!loadingRevenue && (revenueData || revenueLoadFailed) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs">
            <span className="font-medium uppercase tracking-wide text-slate-500">Payout readiness</span>
            {revenueLoadFailed || !revenueData ? (
              <span className="font-medium text-slate-400">Payout data unavailable for this session.</span>
            ) : (
              <span
                className={
                  revenueData.banking?.verified
                    ? "font-medium text-emerald-400"
                    : revenueData.banking
                      ? "font-medium text-amber-300/90"
                      : "font-medium text-orange-300/90"
                }
              >
                {revenueData.banking?.verified
                  ? "Bank on file · verified"
                  : revenueData.banking
                    ? "Bank on file · verification pending"
                    : "Add bank details to receive payouts"}
              </span>
            )}
          </div>
        )}
      </header>

      {success && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">{success}</div>
      )}
      {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>}

      <div className="storytime-plan-card overflow-hidden p-1.5 md:p-2">
        <div className="flex flex-wrap gap-1 border-b border-white/8 px-1 pb-2" role="tablist" aria-label="Account sections">
          {accountTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => goToAccountTab(t.id)}
              className={[
                "rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm",
                activeTab === t.id
                  ? "bg-orange-500/20 text-white ring-1 ring-orange-500/40"
                  : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "profile" && (
      <form onSubmit={saveProfile} className="storytime-plan-card space-y-4 p-5 md:p-6">
        <div className="flex items-center gap-2 border-b border-white/8 pb-3">
          <User className="w-5 h-5 text-orange-400" />
          <h2 className="text-lg font-semibold text-white">Profile</h2>
        </div>
        {studioRegistration && (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Registration</p>
            <p className="text-sm text-slate-200">
              <span className="text-slate-400">Account type: </span>
              {studioRegistration.structure === "INDIVIDUAL" ? "Individual creator" : "Company / team"}
            </p>
            {studioRegistration.structure === "COMPANY" && studioRegistration.seats != null && (
              <p className="text-sm text-slate-200">
                <span className="text-slate-400">Team seat cap: </span>
                {studioRegistration.seats} (including you as admin)
              </p>
            )}
            <p className="text-[11px] text-slate-500">
              Set at signup. Contact support if this should be corrected after company changes.
            </p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
          <input
            value={profile.name}
            onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
            className="storytime-input w-full px-4 py-2.5"
            placeholder="Your name or studio name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Bio</label>
          <textarea
            value={profile.bio}
            onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))}
            rows={4}
            className="storytime-input w-full px-4 py-2.5 resize-none"
            placeholder="Tell viewers and collaborators about yourself"
          />
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                  profile.isAfdaStudent
                    ? "border-violet-400/30 bg-violet-500/10 text-violet-300"
                    : "border-white/8 bg-white/[0.04] text-slate-400"
                }`}
              >
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Student label</p>
                <p className="mt-1 text-sm text-slate-400">
                  {profile.isAfdaStudent
                    ? "Marked as a student creator for discovery."
                    : "Not marked as a student creator."}
                </p>
              </div>
            </div>
            {profile.isAfdaStudent ? (
              <button
                type="button"
                onClick={() => setProfile((p) => ({ ...p, isAfdaStudent: false }))}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/[0.05]"
              >
                Remove student label
              </button>
            ) : (
              <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs font-medium text-slate-400">Inactive</span>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Education</label>
          <input
            value={profile.education}
            onChange={(e) => setProfile((p) => ({ ...p, education: e.target.value }))}
            className="storytime-input w-full px-4 py-2.5"
            placeholder="e.g. Film school, courses"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Goals</label>
          <textarea
            value={profile.goals}
            onChange={(e) => setProfile((p) => ({ ...p, goals: e.target.value }))}
            rows={2}
            className="storytime-input w-full px-4 py-2.5 resize-none"
            placeholder="What you're working towards"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Previous work</label>
          <textarea
            value={profile.previousWork}
            onChange={(e) => setProfile((p) => ({ ...p, previousWork: e.target.value }))}
            rows={3}
            className="storytime-input w-full px-4 py-2.5 resize-none"
            placeholder="Credits, past projects"
          />
        </div>
        <button
          type="submit"
          disabled={savingProfile}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 font-medium text-white hover:bg-orange-600 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {savingProfile ? "Saving…" : "Save profile"}
        </button>
      </form>
      )}

      {activeTab === "security" && (
      <form onSubmit={saveSecurity} className="storytime-plan-card space-y-4 p-5 md:p-6">
        <div className="flex items-center gap-2 border-b border-white/8 pb-3">
          <Shield className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">Security & contact</h2>
        </div>
        <p className="text-xs text-slate-500">Update sign-in email (must be unique), phone, or password.</p>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
          <input
            type="email"
            value={security.email}
            onChange={(e) => setSecurity((s) => ({ ...s, email: e.target.value }))}
            className="storytime-input w-full px-4 py-2.5"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Phone</label>
          <input
            value={security.phoneNumber}
            onChange={(e) => setSecurity((s) => ({ ...s, phoneNumber: e.target.value }))}
            className="storytime-input w-full px-4 py-2.5"
            placeholder="Optional"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Current password</label>
            <input
              type="password"
              value={security.currentPassword}
              onChange={(e) => setSecurity((s) => ({ ...s, currentPassword: e.target.value }))}
              className="storytime-input w-full px-4 py-2.5"
              placeholder="Required to set a new password"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">New password</label>
            <input
              type="password"
              value={security.newPassword}
              onChange={(e) => setSecurity((s) => ({ ...s, newPassword: e.target.value }))}
              className="storytime-input w-full px-4 py-2.5"
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={savingSecurity}
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-5 py-2.5 font-medium text-cyan-100 hover:bg-cyan-500/15 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {savingSecurity ? "Saving…" : "Save security & contact"}
        </button>
      </form>
      )}

      {activeTab === "banking" && (
      <div className="storytime-plan-card space-y-4 p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/8 pb-3">
          <Building2 className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">Banking & payouts</h2>
        </div>
        <p className="text-xs text-slate-500">Payout window figures and the bank account used for settlements.</p>
        <div className="flex flex-wrap gap-2">
          {(["month", "quarter"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setRevenuePeriod(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                revenuePeriod === p
                  ? "bg-orange-500 text-white"
                  : "bg-white/[0.04] text-slate-400 border border-white/10 hover:text-white"
              }`}
            >
              {p === "month" ? "This month" : "This quarter"}
            </button>
          ))}
        </div>
        {loadingRevenue ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : revenueLoadFailed || !revenueData ? (
          <p className="text-sm text-slate-400 py-4">
            Payout figures and banking could not be loaded. If you use a music-creator account, catalogue payout tools may
            not apply here.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-xs text-slate-500">Payout period earnings</p>
                <p className="text-xl font-bold text-white">R{revenueData.revenue.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-xs text-slate-500">Period views</p>
                <p className="text-xl font-bold text-white">{revenueData.totalViews.toLocaleString()}</p>
              </div>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400 shrink-0" /> Bank details
              </h3>
              {revenueData.banking ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.04] p-4">
                  <div>
                    <p className="text-white font-medium">{revenueData.banking.bankName}</p>
                    <p className="text-slate-400 text-sm">
                      ••••{revenueData.banking.accountNumberLast4} · {revenueData.banking.accountType}
                    </p>
                    {revenueData.banking.verified ? (
                      <span className="text-xs text-emerald-400">Verified</span>
                    ) : (
                      <span className="text-xs text-slate-500">Verification pending</span>
                    )}
                  </div>
                  <CreditCard className="w-8 h-8 text-slate-500 shrink-0" />
                </div>
              ) : (
                <p className="text-xs text-slate-500">No payout account on file yet. Add your details below.</p>
              )}
              <form onSubmit={submitBank} className="max-w-md space-y-3">
                <p className="text-xs text-slate-500">
                  Enter your full account number and branch code (SA) where applicable. Saving replaces the payout account on file.
                </p>
                <input
                  type="text"
                  placeholder="Bank name"
                  value={bankForm.bankName}
                  onChange={(e) => setBankForm((f) => ({ ...f, bankName: e.target.value }))}
                  required
                  className="storytime-input px-4 py-2.5 w-full"
                />
                <input
                  type="text"
                  placeholder="Account number"
                  value={bankForm.accountNumber}
                  onChange={(e) => setBankForm((f) => ({ ...f, accountNumber: e.target.value }))}
                  required
                  className="storytime-input px-4 py-2.5 w-full"
                />
                <select
                  value={bankForm.accountType}
                  onChange={(e) => setBankForm((f) => ({ ...f, accountType: e.target.value }))}
                  className="storytime-select px-4 py-2.5 w-full"
                >
                  <option value="CHEQUE">Cheque</option>
                  <option value="SAVINGS">Savings</option>
                </select>
                <input
                  type="text"
                  placeholder="Branch code (SA)"
                  value={bankForm.branchCode}
                  onChange={(e) => setBankForm((f) => ({ ...f, branchCode: e.target.value }))}
                  className="storytime-input px-4 py-2.5 w-full"
                />
                <button
                  type="submit"
                  disabled={submittingBank}
                  className="rounded-xl bg-orange-500 px-4 py-2.5 font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {submittingBank ? "Saving…" : "Save banking details"}
                </button>
              </form>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <ArrowDownToLine className="w-4 h-4 text-violet-400 shrink-0" /> Payouts
              </h3>
              {revenueData.payouts.length === 0 ? (
                <p className="text-slate-500 text-sm">No payouts yet.</p>
              ) : (
                <ul className="space-y-2">
                  {revenueData.payouts.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-sm"
                    >
                      <span className="text-white">R{p.amount.toFixed(2)}</span>
                      <span className={p.status === "COMPLETED" ? "text-emerald-400" : "text-slate-500"}>{p.status}</span>
                      <span className="text-slate-500">{p.period}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
      )}

      {activeTab === "registry" && (
        <div className="storytime-plan-card space-y-4 p-5 md:p-6">
          <div className="flex items-center gap-2 border-b border-white/8 pb-3">
            <FolderArchive className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-semibold text-white">Registry & compliance hub</h2>
          </div>
          <CreatorAccountVaultHub
            studioKind={studioRegistration?.structure ?? null}
            onNotify={(msg, isErr) => (isErr ? flashError(msg) : flashSuccess(msg))}
          />
        </div>
      )}

      {activeTab === "public" && (
      <form onSubmit={saveNetwork} className="storytime-plan-card space-y-4 p-5 md:p-6">
        <div className="flex items-center gap-2 border-b border-white/8 pb-3">
          <Globe className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">Public / network profile</h2>
        </div>
        <p className="text-xs text-slate-500">Shown on your creator page and in Network.</p>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Profile photo</label>
          <p className="mb-2 text-xs text-slate-500">
            Upload a picture — it is stored in your workspace and saved to your profile as a URL automatically.
          </p>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-xs text-slate-200 hover:bg-white/[0.08]">
              {uploadingProfilePhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploadingProfilePhoto ? "Uploading…" : "Upload JPEG / PNG / WebP"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                className="hidden"
                disabled={uploadingProfilePhoto || savingNetwork}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setUploadingProfilePhoto(true);
                  setError("");
                  try {
                    const fd = new FormData();
                    fd.append("file", file);
                    const res = await fetch("/api/upload/content-media", { method: "POST", body: fd });
                    const data = (await res.json().catch(() => ({}))) as { publicUrl?: string; error?: string };
                    if (!res.ok || !data.publicUrl) {
                      flashError(typeof data.error === "string" ? data.error : "Upload failed");
                      return;
                    }
                    const merged = { ...networkRef.current, image: data.publicUrl };
                    const ok = await persistPublicProfile(merged);
                    if (ok) flashSuccess("Profile photo uploaded and saved.");
                  } finally {
                    setUploadingProfilePhoto(false);
                  }
                }}
              />
            </label>
            {network.image ? (
              <>
                <a
                  href={network.image}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-orange-300 hover:underline"
                >
                  Open current photo
                </a>
                <button
                  type="button"
                  disabled={uploadingProfilePhoto || savingNetwork}
                  className="text-xs text-slate-400 hover:text-red-300 hover:underline disabled:opacity-50"
                  onClick={() => {
                    void (async () => {
                      setUploadingProfilePhoto(true);
                      setError("");
                      try {
                        const merged = { ...networkRef.current, image: "" };
                        const ok = await persistPublicProfile(merged);
                        if (ok) flashSuccess("Profile photo removed.");
                      } finally {
                        setUploadingProfilePhoto(false);
                      }
                    })();
                  }}
                >
                  Remove photo
                </button>
              </>
            ) : null}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Headline</label>
          <input
            value={network.headline}
            onChange={(e) => setNetwork((n) => ({ ...n, headline: e.target.value }))}
            className="storytime-input w-full px-4 py-2.5"
            placeholder="e.g. Director · Writer · Cape Town"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Location</label>
          <input
            value={network.location}
            onChange={(e) => setNetwork((n) => ({ ...n, location: e.target.value }))}
            className="storytime-input w-full px-4 py-2.5"
            placeholder="City, region or country"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Website</label>
          <input
            value={network.website}
            onChange={(e) => setNetwork((n) => ({ ...n, website: e.target.value }))}
            type="url"
            className="storytime-input w-full px-4 py-2.5"
            placeholder="https://..."
          />
        </div>
        <div className="space-y-3 rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <p className="text-sm font-medium text-white">Social links</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["instagram", "Instagram"],
                ["x", "X (Twitter)"],
                ["youtube", "YouTube"],
                ["tiktok", "TikTok"],
                ["linkedin", "LinkedIn"],
                ["facebook", "Facebook"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
                <input
                  value={social[key]}
                  onChange={(e) => setSocial((s) => ({ ...s, [key]: e.target.value }))}
                  className="storytime-input w-full px-3 py-2 text-sm"
                  placeholder="@handle or URL"
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setSocialAdvancedOpen((o) => !o);
              if (!socialAdvancedOpen) {
                const merged = { ...socialExtraRef.current };
                for (const k of SOCIAL_KEYS) {
                  const v = social[k].trim();
                  if (v) merged[k] = v;
                }
                setSocialAdvancedJson(JSON.stringify(merged, null, 2));
              }
            }}
            className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white"
          >
            {socialAdvancedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Edit as JSON (advanced)
          </button>
          {socialAdvancedOpen && (
            <textarea
              value={socialAdvancedJson}
              onChange={(e) => setSocialAdvancedJson(e.target.value)}
              rows={6}
              className="storytime-input w-full px-3 py-2 font-mono text-xs resize-y"
              placeholder='{"custom": "https://..."}'
            />
          )}
        </div>
        <button
          type="submit"
          disabled={savingNetwork}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 font-medium text-white hover:bg-orange-600 disabled:opacity-50"
        >
          <Save className="w-4 h-4" /> {savingNetwork ? "Saving…" : "Save public profile"}
        </button>
      </form>
      )}
    </div>
  );
}
