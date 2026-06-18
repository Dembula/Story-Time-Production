"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Shield } from "lucide-react";
import { AuthButton, AuthForm, AuthInput } from "@/components/auth/auth-form-controls";
import { OAuthSignInButtons } from "@/components/auth/oauth-sign-in-buttons";
import { defaultHomeForRole } from "@/lib/auth-sign-in-path";

export function SignInClient({ callbackUrl }: { callbackUrl: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function redirectAfterSignIn() {
    if (callbackUrl) {
      window.location.href = callbackUrl;
      return;
    }
    try {
      const entryRes = await fetch("/api/auth/entry-redirect", { cache: "no-store" });
      if (entryRes.ok) {
        const entry = (await entryRes.json()) as { path?: string };
        if (entry.path) {
          window.location.href = entry.path;
          return;
        }
      }
      const sessionRes = await fetch("/api/auth/session", { cache: "no-store" });
      const session = sessionRes.ok ? ((await sessionRes.json()) as { user?: { role?: string } }) : null;
      window.location.href = defaultHomeForRole(session?.user?.role);
    } catch {
      window.location.href = "/profiles";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials-viewer", {
        email,
        password,
        redirect: false,
      });
      if (res?.ok) {
        await redirectAfterSignIn();
        return;
      }
      setError(
        res?.error === "CredentialsSignin"
          ? "Invalid email or password. For creator dashboards, use Creator sign in below."
          : "Sign in failed. Please try again.",
      );
    } catch {
      setError("Sign in failed. If you have been trying repeatedly, wait a few minutes and try again.");
    } finally {
      setLoading(false);
    }
  }

  const oauthCallback = callbackUrl ?? "/profiles";

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_40%,rgba(249,115,22,0.08),transparent_60%)]" />
      <div className="w-full max-w-md relative z-10">
        <Link href="/" prefetch={false} className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <Link href="/" prefetch={false} className="mb-10 flex items-center justify-center gap-3">
          <Image src="/logo.png" alt="Story Time" width={52} height={52} className="rounded-xl shadow-glow" />
          <span className="text-2xl font-semibold tracking-[0.14em] text-white">STORY <span className="storytime-brand-text">TIME</span></span>
        </Link>

        <div className="storytime-section p-8">
          <h1 className="mb-2 font-display text-2xl font-semibold text-white">Welcome back</h1>
          <p className="mb-6 text-sm leading-6 text-slate-300/78">Sign in to watch unlimited content from independent creators</p>

          <AuthForm onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-300">
                Email address
              </label>
              <AuthInput
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="storytime-input px-4 py-3"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-300">
                Password
              </label>
              <AuthInput
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="storytime-input px-4 py-3"
              />
              <div className="mt-2 text-right">
                <Link href="/auth/forgot-password" className="text-xs text-orange-300 hover:text-orange-200">
                  Forgot password?
                </Link>
              </div>
            </div>
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            <AuthButton
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-orange-500 py-3 font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </AuthButton>
          </AuthForm>

          <OAuthSignInButtons callbackUrl={oauthCallback} onError={setError} />

          <div className="mt-4 flex items-center gap-2 justify-center text-xs text-slate-500">
            <Shield className="w-3.5 h-3.5" />
            <span>Protected with account and session controls</span>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup/terms" className="font-medium text-orange-300 hover:text-orange-200">
            Sign up
          </Link>
          {" · "}
          <Link href="/auth/creator/signin" className="text-slate-400 hover:text-slate-300">
            Creator sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
