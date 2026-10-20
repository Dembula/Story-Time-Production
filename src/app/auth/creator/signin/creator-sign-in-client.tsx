"use client";

import { getSession, signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { StoryTimeMark } from "@/components/brand/story-time-mark";
import { resolvePostSignInRedirect } from "@/lib/auth-sign-in-path";
import { OAuthSignInButtons } from "@/components/auth/oauth-sign-in-buttons";
import { precheckMfaRequirement } from "@/lib/mfa/client-precheck";
import {
  CREATOR_SIGNIN_ROLE_OPTIONS,
  isCreatorSignInRole,
} from "@/lib/creator-account-types";

export function CreatorSignInClient({
  callbackPath,
  defaultRole,
}: {
  callbackPath: string | null;
  defaultRole: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState(
    isCreatorSignInRole(defaultRole) ? defaultRole : "CONTENT_CREATOR",
  );

  async function finishAfterOk() {
    // Trust the JWT session role (authoritative), not only the dropdown selection.
    const session = await getSession();
    const sessionRole =
      typeof session?.user?.role === "string" ? session.user.role : null;
    if (!sessionRole) {
      setError("Signed in, but your session did not load. Please try again.");
      return;
    }
    if (sessionRole !== selectedRole) {
      // Should be rare (authorize requires the selected type). Prefer the real session home.
      window.location.replace(resolvePostSignInRedirect(sessionRole, callbackPath));
      return;
    }
    const destination = callbackPath
      ? resolvePostSignInRedirect(sessionRole, callbackPath)
      : null;
    if (destination) {
      window.location.replace(destination);
      return;
    }
    const entryRes = await fetch("/api/auth/entry-redirect", { cache: "no-store" });
    if (entryRes.ok) {
      const entry = (await entryRes.json()) as { path?: string };
      if (entry.path) {
        window.location.replace(entry.path);
        return;
      }
    }
    window.location.replace(resolvePostSignInRedirect(sessionRole, null));
  }

  async function completeSignIn(code?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const res = await signIn("credentials-creator", {
      email: normalizedEmail,
      password,
      selectedRole,
      mfaCode: code ?? "",
      redirect: false,
    });
    if (!res?.ok) {
      setError(
        res?.error === "CredentialsSignin"
          ? mfaRequired
            ? "Invalid authenticator code. Try again."
            : "Invalid email or password, or you do not have an account for the selected type with this email."
          : "Sign in failed. Please try again.",
      );
      return;
    }
    await finishAfterOk();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mfaRequired) {
        await completeSignIn(mfaCode.trim());
        return;
      }

      const pre = await precheckMfaRequirement({
        email,
        password,
        portal: "creator",
        selectedRole,
      });
      if (!pre.ok) {
        setError(
          "Invalid email or password, or you do not have an account for the selected type with this email.",
        );
        return;
      }
      if (pre.mfaRequired) {
        setMfaRequired(true);
        setMfaCode("");
        return;
      }
      await completeSignIn("");
    } catch {
      setError("Sign in failed. If you have been trying repeatedly, wait a few minutes and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-12">
      <div className="w-full max-w-md relative z-10">
        <Link href="/" prefetch={false} className="mb-8 inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <Link href="/" prefetch={false} className="mb-10 flex items-center justify-center" aria-label="Story Time">
          <StoryTimeMark size={56} priority />
        </Link>

        <div className="rounded-[28px] border border-white/15 bg-gradient-to-br from-white via-stone-50 to-amber-50 p-8 text-slate-950 shadow-[0_30px_80px_-32px_rgba(0,0,0,0.72)] backdrop-blur-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-900/8 bg-slate-950 px-3 py-1 text-sm font-semibold text-amber-200 shadow-sm">
            Creator Portal
          </div>
          <h1 className="mb-2 font-display text-2xl font-semibold text-slate-950">Creator Sign In</h1>
          <p className="mb-6 text-sm leading-6 text-slate-600">
            Access your dashboard, view analytics, and manage your content
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" suppressHydrationWarning>
            <div>
              <label htmlFor="accountType" className="mb-2 block text-sm font-medium text-slate-700">
                Account type
              </label>
              <select
                id="accountType"
                value={selectedRole}
                onChange={(e) => {
                  const next = e.target.value;
                  if (!isCreatorSignInRole(next)) return;
                  setSelectedRole(next);
                  if (mfaRequired) setMfaRequired(false);
                }}
                disabled={mfaRequired}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
                suppressHydrationWarning
              >
                {CREATOR_SIGNIN_ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (mfaRequired) setMfaRequired(false);
                }}
                placeholder="creator@example.com"
                autoComplete="email"
                required
                disabled={mfaRequired}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
                suppressHydrationWarning
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (mfaRequired) setMfaRequired(false);
                }}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                disabled={mfaRequired}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
                suppressHydrationWarning
              />
              <div className="mt-2 text-right">
                <Link href="/auth/forgot-password" className="text-xs text-slate-600 hover:text-slate-900">
                  Forgot password?
                </Link>
              </div>
            </div>
            {mfaRequired ? (
              <div>
                <label htmlFor="mfaCode" className="mb-2 block text-sm font-medium text-slate-700">
                  Authenticator code
                </label>
                <input
                  id="mfaCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="6-digit code or recovery code"
                  required
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
                />
                <p className="mt-2 text-xs text-slate-500">
                  MFA is on for this account — enter your authenticator or recovery code.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMfaRequired(false);
                    setMfaCode("");
                    setError("");
                  }}
                  className="mt-2 text-xs text-slate-600 hover:text-slate-900"
                >
                  Back to email & password
                </button>
              </div>
            ) : null}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-slate-950 py-3 font-semibold text-white shadow-[0_18px_40px_-22px_rgba(15,23,42,0.85)] transition hover:-translate-y-0.5 hover:bg-slate-900 disabled:opacity-50"
              suppressHydrationWarning
            >
              {loading ? "Signing in..." : mfaRequired ? "Verify & sign in" : "Sign In"}
            </button>
          </form>

          {!mfaRequired ? (
            <OAuthSignInButtons
              callbackUrl={callbackPath ?? "/creator/command-center"}
              dividerLabel="Or"
              variant="light"
              onError={setError}
            />
          ) : null}

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
