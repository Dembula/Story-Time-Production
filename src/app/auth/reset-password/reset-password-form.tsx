"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, Shield } from "lucide-react";

export function ResetPasswordForm({ token, portal = "viewer" }: { token: string; portal?: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const normalizedPortal = portal === "admin" || portal === "creator" ? portal : "viewer";
  const portalLabel = normalizedPortal === "admin" ? "admin" : normalizedPortal === "creator" ? "creator" : "viewer";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Missing reset token. Open the link from your email again.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Unable to reset password.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_40%,rgba(249,115,22,0.08),transparent_60%)]" />
      <div className="relative z-10 w-full max-w-md">
        <Link href="/auth/signin" prefetch={false} className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>

        <Link href="/" prefetch={false} className="mb-10 flex items-center justify-center gap-3">
          <Image src="/logo.png" alt="Story Time" width={52} height={52} className="rounded-xl shadow-glow" />
          <span className="text-2xl font-semibold tracking-[0.14em] text-white">STORY <span className="storytime-brand-text">TIME</span></span>
        </Link>

        <div className="storytime-section p-8">
          <h1 className="mb-2 font-display text-2xl font-semibold text-white">Create a new password</h1>
          <p className="mb-6 text-sm leading-6 text-slate-300/78">
            This link is secure and can only be used once. Account portal: {portalLabel}.
          </p>

          {done ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                <p className="text-sm text-emerald-400">Password reset successful. You can now sign in.</p>
              </div>
              <div className="flex items-center justify-between text-sm">
                <Link href="/auth/signin" className="text-orange-300 hover:text-orange-200">
                  Viewer sign in
                </Link>
                <Link href="/auth/creator/signin" className="text-slate-300 hover:text-white">
                  Creator sign in
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-300">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="storytime-input px-4 py-3"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-300">
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="storytime-input px-4 py-3"
                />
              </div>
              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-orange-500 py-3 font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400 disabled:opacity-50"
              >
                {loading ? "Resetting..." : "Reset password"}
              </button>
            </form>
          )}

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Shield className="h-3.5 w-3.5" />
            <span>Protected with account and session controls</span>
          </div>
        </div>
      </div>
    </div>
  );
}
