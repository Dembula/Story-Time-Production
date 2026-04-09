"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { tryNormalizeAvatarImageUrl } from "@/lib/avatar-image-url";
import {
  User,
  Save,
  ArrowLeft,
  GraduationCap,
  Shield,
  Globe,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

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

export function CreatorAccountClient({ backHref = "/creator/dashboard" }: { backHref?: string }) {
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
  const [social, setSocial] = useState(emptySocial());
  const socialExtraRef = useRef<Record<string, string>>({});
  const [socialAdvancedOpen, setSocialAdvancedOpen] = useState(false);
  const [socialAdvancedJson, setSocialAdvancedJson] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [savingNetwork, setSavingNetwork] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me")
      .then((r) => r.json())
      .then((user) => {
        if (cancelled || !user?.email) return;
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

  async function saveNetwork(e: React.FormEvent) {
    e.preventDefault();
    setSavingNetwork(true);
    setError("");
    try {
      const imgCheck = tryNormalizeAvatarImageUrl(network.image);
      if (!imgCheck.ok) {
        flashError(imgCheck.message);
        return;
      }
      const socialLinks = buildSocialLinksJson(social, socialExtraRef.current, socialAdvancedOpen, socialAdvancedJson);
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: network.headline || undefined,
          location: network.location || undefined,
          website: network.website || undefined,
          image: imgCheck.value,
          socialLinks,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flashError(typeof data.error === "string" ? data.error : "Could not save public profile.");
        return;
      }
      const { structured, extra } = parseSocialLinks(data.socialLinks);
      setSocial(structured);
      socialExtraRef.current = extra;
      setNetwork((n) => ({ ...n, image: data.image ?? "" }));
      if (updateSession) {
        await updateSession({ image: data.image ?? null }).catch(() => {});
      }
      flashSuccess("Public profile saved.");
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

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-8">
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>

      <header className="storytime-plan-card p-5 md:p-6">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">Creator account</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white md:text-3xl flex items-center gap-3">
          <User className="w-8 h-8 text-orange-500 shrink-0" />
          Account
        </h1>
        <p className="mt-2 text-sm text-slate-400 md:text-base">Profile, security, and your public network presence.</p>
      </header>

      {success && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">{success}</div>
      )}
      {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>}

      <form onSubmit={saveProfile} className="storytime-plan-card space-y-4 p-5 md:p-6">
        <div className="flex items-center gap-2 border-b border-white/8 pb-3">
          <User className="w-5 h-5 text-orange-400" />
          <h2 className="text-lg font-semibold text-white">Profile</h2>
        </div>
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

      <form onSubmit={saveNetwork} className="storytime-plan-card space-y-4 p-5 md:p-6">
        <div className="flex items-center gap-2 border-b border-white/8 pb-3">
          <Globe className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">Public / network profile</h2>
        </div>
        <p className="text-xs text-slate-500">Shown on your creator page and in Network.</p>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Profile photo URL</label>
          <input
            value={network.image}
            onChange={(e) => setNetwork((n) => ({ ...n, image: e.target.value }))}
            type="url"
            className="storytime-input w-full px-4 py-2.5"
            placeholder="https://… (avatar image)"
          />
          <p className="mt-1 text-xs text-slate-500">Paste a direct image URL. Leave empty to clear.</p>
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
    </div>
  );
}
