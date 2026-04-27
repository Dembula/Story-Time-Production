"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Shield, Lock, UserPlus, ChevronDown, ChevronUp } from "lucide-react";

export default function AdminLoginPage() {
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [reqEmail, setReqEmail] = useState("");
  const [reqName, setReqName] = useState("");
  const [reqPassword, setReqPassword] = useState("");
  const [reqPassword2, setReqPassword2] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  const role = (session?.user as { role?: string })?.role;

  useEffect(() => {
    if (status === "authenticated" && role === "ADMIN") {
      window.location.href = "/admin";
    }
  }, [status, role]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials-admin", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.ok) {
      window.location.href = "/admin";
    } else {
      setError("Invalid credentials. Only approved administrator accounts can sign in here.");
    }
  }

  async function handleRequestAccess(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (reqPassword !== reqPassword2) {
      setError("Passwords do not match.");
      return;
    }
    setRequestLoading(true);
    try {
      const res = await fetch("/api/auth/admin-access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: reqEmail.trim(),
          password: reqPassword,
          name: reqName.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error || "Request failed");
      setRequestSent(true);
      setRequestOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setRequestLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_40%,rgba(249,115,22,0.08),transparent_60%)]" />
      <div className="relative z-10 w-full max-w-md">
        <Link
          href="/"
          prefetch={false}
          className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <Link href="/" prefetch={false} className="mb-10 flex items-center justify-center gap-3">
          <Image src="/logo.png" alt="Story Time" width={52} height={52} className="rounded-xl shadow-glow" />
          <span className="text-2xl font-semibold tracking-[0.14em] text-white">
            STORY <span className="storytime-brand-text">TIME</span>
          </span>
        </Link>

        <div className="storytime-section p-8">
          <div className="mb-6 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-500/25 bg-orange-500/10">
              <Shield className="h-7 w-7 text-orange-400" />
            </div>
          </div>
          <h1 className="mb-2 text-center font-display text-2xl font-semibold text-white">Administrator sign in</h1>
          <p className="mb-8 text-center text-sm leading-6 text-slate-300/78">
            Restricted platform console. Use the credentials you were given after an access request is approved.
          </p>

          {session && role !== "ADMIN" && (
            <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-slate-300">
                You are signed in as{" "}
                <span className="font-medium text-white">{session.user?.email}</span> (not an administrator). Sign out
                to use a different account, or submit an access request with the email you want promoted.
              </p>
              <button
                type="button"
                onClick={() => void signOut({ redirect: false })}
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm font-medium text-slate-200 hover:bg-white/[0.07]"
              >
                Sign out
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-email" className="mb-2 block text-sm font-medium text-slate-300">
                Email
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className="storytime-input w-full py-3 pl-10 pr-4"
                />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="admin-password" className="block text-sm font-medium text-slate-300">
                  Password
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs font-medium text-orange-300 hover:text-orange-200"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="storytime-input w-full px-4 py-3"
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
              {loading ? "Signing in…" : "Sign in as admin"}
            </button>
          </form>

          <div className="relative my-8">
            <span className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/8" />
            </span>
            <span className="relative flex justify-center px-3 text-xs text-slate-500">
              <span className="bg-[hsl(228_23%_9%)] px-2">Need an administrator account?</span>
            </span>
          </div>

          {requestSent ? (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-center">
              <UserPlus className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
              <p className="text-sm font-medium text-emerald-200">Request received</p>
              <p className="mt-1 text-xs text-emerald-200/80">
                An existing administrator can approve your application from the admin dashboard. You will then sign in
                here with the email and password you submitted.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setRequestOpen((o) => !o);
                  setError("");
                }}
                className="storytime-panel flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-slate-200 hover:bg-white/[0.05]"
              >
                {requestOpen ? (
                  <>
                    <ChevronUp className="h-4 w-4" /> Hide request form
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" /> Request access
                  </>
                )}
              </button>

              {requestOpen && (
                <form
                  onSubmit={(e) => void handleRequestAccess(e)}
                  className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4"
                >
                  <p className="text-xs leading-relaxed text-slate-400">
                    Submit the email and password you want for the admin console. After approval, use those credentials
                    on this page to sign in.
                  </p>
                  <div>
                    <label htmlFor="req-email" className="mb-1.5 block text-xs font-medium text-slate-400">
                      Email (will be your admin login)
                    </label>
                    <input
                      id="req-email"
                      type="email"
                      required
                      value={reqEmail}
                      onChange={(e) => setReqEmail(e.target.value)}
                      className="storytime-input w-full px-3 py-2.5 text-sm"
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label htmlFor="req-name" className="mb-1.5 block text-xs font-medium text-slate-400">
                      Display name <span className="text-slate-600">(optional)</span>
                    </label>
                    <input
                      id="req-name"
                      type="text"
                      value={reqName}
                      onChange={(e) => setReqName(e.target.value)}
                      className="storytime-input w-full px-3 py-2.5 text-sm"
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <label htmlFor="req-pass" className="mb-1.5 block text-xs font-medium text-slate-400">
                      Password (min. 8 characters)
                    </label>
                    <input
                      id="req-pass"
                      type="password"
                      required
                      minLength={8}
                      value={reqPassword}
                      onChange={(e) => setReqPassword(e.target.value)}
                      className="storytime-input w-full px-3 py-2.5 text-sm"
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label htmlFor="req-pass2" className="mb-1.5 block text-xs font-medium text-slate-400">
                      Confirm password
                    </label>
                    <input
                      id="req-pass2"
                      type="password"
                      required
                      value={reqPassword2}
                      onChange={(e) => setReqPassword2(e.target.value)}
                      className="storytime-input w-full px-3 py-2.5 text-sm"
                      autoComplete="new-password"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={requestLoading}
                    className="w-full rounded-xl bg-orange-500/90 py-2.5 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
                  >
                    {requestLoading ? "Submitting…" : "Submit access request"}
                  </button>
                </form>
              )}
            </div>
          )}

          <div className="storytime-panel mt-8 rounded-xl p-4">
            <div className="mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-500" />
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Security</p>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Administrator sessions are monitored. Access requests are visible only to existing admins for approval.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/auth/signin" className="text-orange-300 hover:text-orange-200">
            Viewer sign in
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
