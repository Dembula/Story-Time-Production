"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/reset-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Unable to send reset email.");
      setMessage(data.message || "If this account exists, a reset link has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reset email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0c1222] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-900/60 p-8">
        <h1 className="text-2xl font-semibold text-white mb-2">Reset your password</h1>
        <p className="text-sm text-slate-400 mb-6">
          Enter your email address and we will send a secure reset link.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg bg-slate-800 border border-slate-600 px-4 py-3 text-white placeholder:text-slate-500"
          />
          {message && <p className="text-sm text-emerald-400">{message}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send reset email"}
          </button>
        </form>
        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/auth/signin" className="text-slate-300 hover:text-white">
            Viewer sign in
          </Link>
          <Link href="/auth/creator/signin" className="text-slate-300 hover:text-white">
            Creator sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
