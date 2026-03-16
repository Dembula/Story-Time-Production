"use client";

import { signIn, useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Shield, Lock, ArrowLeft, Send } from "lucide-react";

export default function AdminLoginPage() {
  const { data: session, status } = useSession();
  const [email, setEmail] = useState("admin@storytime.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [error, setError] = useState("");

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
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.ok) {
      window.location.href = "/admin";
    } else {
      setError("Invalid credentials. Authorised personnel only.");
    }
  }

  async function handleRequestAdmin() {
    setError("");
    setRequestLoading(true);
    try {
      const res = await fetch("/api/admin/requests", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setRequestSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setRequestLoading(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0c1222] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c1222] flex items-center justify-center px-4 py-12 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_40%,rgba(249,115,22,0.04),transparent_60%)]" />
      <div className="w-full max-w-md relative z-10">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8 transition">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <Link href="/" className="flex items-center gap-3 justify-center mb-10">
          <Image src="/logo.png" alt="Story Time" width={48} height={48} className="rounded-lg" />
          <span className="text-2xl font-semibold text-white">STORY TIME</span>
        </Link>

        <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-8 backdrop-blur-sm">
          <div className="flex items-center justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
              <Shield className="w-7 h-7 text-orange-500" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-white mb-1 text-center">Admin Portal</h1>
          <p className="text-slate-400 text-sm mb-8 text-center">
            Restricted access — authorised personnel only
          </p>

          {session && role !== "ADMIN" && (
            <div className="mb-6 p-4 rounded-xl bg-slate-900/40 border border-slate-700/30">
              <p className="text-sm text-slate-300 mb-3">
                You are signed in as <span className="text-white font-medium">{session.user?.email}</span>. Request admin access for an administrator to review.
              </p>
              {requestSent ? (
                <p className="text-sm text-emerald-400">Request submitted. An administrator will review it.</p>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestAdmin}
                  disabled={requestLoading}
                  className="w-full py-2.5 rounded-lg bg-orange-500/20 text-orange-400 font-medium hover:bg-orange-500/30 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {requestLoading ? "Submitting..." : (
                    <>
                      <Send className="w-4 h-4" /> Request admin access
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {!session && (
            <p className="text-sm text-slate-400 mb-4 text-center">
              <Link href={`/auth/signin?callbackUrl=${encodeURIComponent("/auth/admin")}`} className="text-orange-400 hover:underline">
                Sign in
              </Link>
              {" "}first to request admin access, or sign in below if you are an administrator.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium mb-2 text-slate-300">
                Admin Email
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@storytime.com"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-900/60 border border-slate-600 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                />
              </div>
            </div>
            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium mb-2 text-slate-300">
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-lg bg-slate-900/60 border border-slate-600 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
              />
            </div>
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-50 transition"
            >
              {loading ? "Authenticating..." : "Sign in as Admin"}
            </button>
          </form>

          <div className="mt-6 p-4 rounded-xl bg-slate-900/40 border border-slate-700/30">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-slate-500" />
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Security Notice</p>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              This portal is for platform administrators only. All login attempts are logged and monitored. Unauthorised access is prohibited.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
