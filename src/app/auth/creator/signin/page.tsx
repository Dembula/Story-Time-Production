"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Shield } from "lucide-react";

export default function CreatorSignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      window.location.href = "/";
    } else {
      setError("Invalid email or password.");
    }
  }

  return (
    <div className="min-h-screen bg-[#0c1222] flex items-center justify-center px-4 py-12 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_40%,rgba(249,115,22,0.03),transparent_60%)]" />
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-6">
            Creator Portal
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">Creator Sign In</h1>
          <p className="text-slate-400 text-sm mb-6">
            Access your dashboard, view analytics, and manage your content
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2 text-slate-300">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="creator@example.com"
                required
                className="w-full px-4 py-3 rounded-lg bg-slate-900/60 border border-slate-600 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2 text-slate-300">Password</label>
              <input
                id="password"
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
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="relative my-6">
            <span className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-700" />
            </span>
            <span className="relative flex justify-center text-xs text-slate-500 bg-slate-800/30 px-3">Or</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/creator/dashboard" })}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-600 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 transition text-sm font-medium"
            >
              Google
            </button>
            <button
              type="button"
              onClick={() => signIn("github", { callbackUrl: "/creator/dashboard" })}
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-slate-600 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 transition text-sm font-medium"
            >
              GitHub
            </button>
          </div>

          <div className="mt-6 p-3 rounded-lg bg-slate-800/40 border border-slate-700/30">
            <p className="text-xs text-slate-500 mb-1.5 font-medium">Demo creator accounts:</p>
            <p className="text-xs text-slate-400"><code className="text-slate-300">creator@storytime.com</code> / <code className="text-slate-300">storytime2025</code></p>
            <p className="text-xs text-slate-400"><code className="text-slate-300">music@storytime.com</code> / <code className="text-slate-300">storytime2025</code></p>
            <p className="text-xs text-slate-400"><code className="text-slate-300">cinegear@storytime.com</code> / <code className="text-slate-300">storytime2025</code> (Equipment Co.)</p>
          </div>

          <div className="mt-4 flex items-center gap-2 justify-center text-xs text-slate-500">
            <Shield className="w-3.5 h-3.5" />
            <span>Secured with AES-256 encryption</span>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Not a creator yet?{" "}
          <Link href="/auth/creator/signup" className="text-orange-500 hover:text-orange-400 font-medium">
            Creator sign up
          </Link>
          {" · "}
          <Link href="/auth/signin" className="text-slate-400 hover:text-slate-300">
            Viewer sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
