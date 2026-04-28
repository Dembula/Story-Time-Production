"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Shield } from "lucide-react";

export default function CreatorSignInPage() {
  const hasGoogleProvider = Boolean(process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true");
  const hasGitHubProvider = Boolean(process.env.NEXT_PUBLIC_GITHUB_AUTH_ENABLED === "true");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState("FUNDER");

  async function redirectToRoleHome(defaultPath: string) {
    try {
      const sessionRes = await fetch("/api/auth/session", { cache: "no-store" });
      if (!sessionRes.ok) {
        window.location.href = defaultPath;
        return;
      }
      const session = (await sessionRes.json()) as { user?: { role?: string } };
      const role = session?.user?.role;
      const roleRedirects: Record<string, string> = {
        CONTENT_CREATOR: "/creator/command-center",
        MUSIC_CREATOR: "/music-creator/dashboard",
        EQUIPMENT_COMPANY: "/equipment-company/dashboard",
        LOCATION_OWNER: "/location-owner/dashboard",
        CREW_TEAM: "/crew-team/dashboard",
        CASTING_AGENCY: "/casting-agency/dashboard",
        CATERING_COMPANY: "/catering-company/dashboard",
        FUNDER: "/funders",
      };
      window.location.href = roleRedirects[role ?? ""] ?? defaultPath;
    } catch {
      window.location.href = defaultPath;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials-creator", {
      email,
      password,
      selectedRole,
      redirect: false,
      callbackUrl: "/funders",
    });
    setLoading(false);
    if (res?.ok) {
      await redirectToRoleHome("/funders");
    } else {
      setError("Invalid creator credentials or this account belongs to the viewer portal.");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_32%),linear-gradient(135deg,rgba(255,214,153,0.18),transparent_42%),linear-gradient(180deg,#020617_0%,#111827_55%,#1f2937_100%)]" />
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-amber-100/12 to-transparent" />
      <div className="w-full max-w-md relative z-10">
        <Link href="/" prefetch={false} className="mb-8 inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <Link href="/" prefetch={false} className="mb-10 flex items-center justify-center gap-3">
          <Image
            src="/creator-logo.png"
            alt="Story Time Creator"
            width={52}
            height={52}
            className="rounded-xl shadow-glow"
          />
          <span className="text-2xl font-semibold tracking-[0.14em] text-white">STORY <span className="storytime-brand-text">TIME</span></span>
        </Link>

        <div className="rounded-[28px] border border-white/15 bg-gradient-to-br from-white via-stone-50 to-amber-50 p-8 text-slate-950 shadow-[0_30px_80px_-32px_rgba(0,0,0,0.72)] backdrop-blur-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-900/8 bg-slate-950 px-3 py-1 text-sm font-semibold text-amber-200 shadow-sm">
            Creator Portal
          </div>
          <h1 className="mb-2 font-display text-2xl font-semibold text-slate-950">Creator Sign In</h1>
          <p className="mb-6 text-sm leading-6 text-slate-600">
            Access your dashboard, view analytics, and manage your content
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="accountType" className="mb-2 block text-sm font-medium text-slate-700">Account type</label>
              <select
                id="accountType"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
              >
                <option value="CONTENT_CREATOR">Content Creator</option>
                <option value="MUSIC_CREATOR">Music Creator</option>
                <option value="EQUIPMENT_COMPANY">Equipment Company</option>
                <option value="LOCATION_OWNER">Location Owner</option>
                <option value="CREW_TEAM">Crew Team</option>
                <option value="CASTING_AGENCY">Casting Agency</option>
                <option value="CATERING_COMPANY">Catering Company</option>
                <option value="FUNDER">Funder / Investor</option>
              </select>
            </div>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="creator@example.com"
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
              />
              <div className="mt-2 text-right">
                <Link href="/auth/forgot-password" className="text-xs text-slate-600 hover:text-slate-900">
                  Forgot password?
                </Link>
              </div>
            </div>
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-950 py-3 font-semibold text-white shadow-[0_18px_40px_-22px_rgba(15,23,42,0.85)] transition hover:-translate-y-0.5 hover:bg-slate-900 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="relative my-6">
            <span className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </span>
            <span className="relative flex justify-center bg-transparent px-3 text-xs text-slate-400">Or</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={!hasGoogleProvider}
              onClick={async () => {
                try {
                  await signIn("google", { callbackUrl: "/funders" });
                } catch {
                  setError("Google sign-in is currently unavailable. Use creator email/password.");
                }
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/90 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-white"
            >
              Google
            </button>
            <button
              type="button"
              disabled={!hasGitHubProvider}
              onClick={async () => {
                try {
                  await signIn("github", { callbackUrl: "/funders" });
                } catch {
                  setError("GitHub sign-in is currently unavailable. Use creator email/password.");
                }
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/90 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-white"
            >
              GitHub
            </button>
          </div>
          {(!hasGoogleProvider || !hasGitHubProvider) && (
            <p className="mt-3 text-center text-xs text-slate-500">
              Some social sign-in providers are disabled in this environment.
            </p>
          )}

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Shield className="w-3.5 h-3.5" />
            <span>Protected with account and session controls</span>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-400">
          Not a creator yet?{" "}
          <Link href="/auth/creator/signup/terms" className="font-medium text-amber-300 hover:text-amber-200">
            Creator sign up
          </Link>
          {" · "}
          <Link href="/auth/signin" className="text-slate-300 hover:text-white">
            Viewer sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
