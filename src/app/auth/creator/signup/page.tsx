"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Shield } from "lucide-react";

export default function CreatorSignUpPage() {
  const [email, setEmail] = useState("");
  const [creatorType, setCreatorType] = useState<"content" | "music" | "equipment" | "location" | "crew" | "casting" | "catering" | "">("");
  const [bio, setBio] = useState("");
  const [socialLinks, setSocialLinks] = useState("");
  const [education, setEducation] = useState("");
  const [goals, setGoals] = useState("");
  const [previousWork, setPreviousWork] = useState("");
  const [password, setPassword] = useState("");
  const [isAfda, setIsAfda] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const type = creatorType || "content";
    try {
      const regRes = await fetch("/api/creator/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          type,
          bio,
          socialLinks,
          education,
          goals,
          previousWork,
          isAfda,
        }),
      });
      const regData = regRes.ok ? null : (await regRes.json().catch(() => ({})));
      if (!regRes.ok) {
        setLoading(false);
        setError((regData?.error as string) || "Registration failed. Please try again.");
        return;
      }
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      setLoading(false);
      if (res?.ok) {
        const redirects: Record<string, string> = { music: "/music-creator/onboarding/license", content: "/creator/onboarding/license", equipment: "/equipment-company/dashboard", location: "/location-owner/dashboard", crew: "/crew-team/dashboard", casting: "/casting-agency/dashboard", catering: "/catering-company/dashboard" };
        window.location.href = redirects[type] ?? "/creator/dashboard";
      } else {
        setError("Account created but we couldn't sign you in. Please try signing in with your email and password.");
      }
    } catch {
      setLoading(false);
      setError("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-[#0c1222] flex items-center justify-center px-4 py-12 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_40%,rgba(249,115,22,0.03),transparent_60%)]" />
      <div className="w-full max-w-lg relative z-10">
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
          <h1 className="text-2xl font-semibold text-white mb-2">Become a Creator</h1>
          <p className="text-slate-400 text-sm mb-6">
            Upload content, track analytics, and earn from your audience
          </p>

          {/* Step indicators */}
          <div className="flex items-center gap-2 mb-8">
            <div className={`h-1 flex-1 rounded-full ${step >= 1 ? "bg-orange-500" : "bg-slate-700"}`} />
            <div className={`h-1 flex-1 rounded-full ${step >= 2 ? "bg-orange-500" : "bg-slate-700"}`} />
          </div>

          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">I create</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCreatorType("content")}
                    className={`py-2.5 rounded-lg border text-sm font-medium transition ${
                      creatorType === "content"
                        ? "border-orange-500 bg-orange-500/10 text-orange-400"
                        : "border-slate-600 bg-slate-800/50 text-slate-400 hover:bg-slate-700/50"
                    }`}
                  >
                    Films / Shows
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatorType("music")}
                    className={`py-2.5 rounded-lg border text-sm font-medium transition ${
                      creatorType === "music"
                        ? "border-orange-500 bg-orange-500/10 text-orange-400"
                        : "border-slate-600 bg-slate-800/50 text-slate-400 hover:bg-slate-700/50"
                    }`}
                  >
                    Music
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatorType("equipment")}
                    className={`py-2.5 rounded-lg border text-sm font-medium transition ${
                      creatorType === "equipment"
                        ? "border-orange-500 bg-orange-500/10 text-orange-400"
                        : "border-slate-600 bg-slate-800/50 text-slate-400 hover:bg-slate-700/50"
                    }`}
                  >
                    Equipment Co.
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatorType("location")}
                    className={`py-2.5 rounded-lg border text-sm font-medium transition ${
                      creatorType === "location"
                        ? "border-orange-500 bg-orange-500/10 text-orange-400"
                        : "border-slate-600 bg-slate-800/50 text-slate-400 hover:bg-slate-700/50"
                    }`}
                  >
                    Location / Property
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatorType("crew")}
                    className={`py-2.5 rounded-lg border text-sm font-medium transition ${
                      creatorType === "crew"
                        ? "border-orange-500 bg-orange-500/10 text-orange-400"
                        : "border-slate-600 bg-slate-800/50 text-slate-400 hover:bg-slate-700/50"
                    }`}
                  >
                    Crew Team
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatorType("casting")}
                    className={`py-2.5 rounded-lg border text-sm font-medium transition ${
                      creatorType === "casting"
                        ? "border-orange-500 bg-orange-500/10 text-orange-400"
                        : "border-slate-600 bg-slate-800/50 text-slate-400 hover:bg-slate-700/50"
                    }`}
                  >
                    Casting Agency
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatorType("catering")}
                    className={`py-2.5 rounded-lg border text-sm font-medium transition ${
                      creatorType === "catering"
                        ? "border-orange-500 bg-orange-500/10 text-orange-400"
                        : "border-slate-600 bg-slate-800/50 text-slate-400 hover:bg-slate-700/50"
                    }`}
                  >
                    Catering
                  </button>
                </div>
              </div>
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

              <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40 cursor-pointer hover:bg-slate-800/60 transition">
                <input
                  type="checkbox"
                  checked={isAfda}
                  onChange={(e) => setIsAfda(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 text-orange-500 focus:ring-orange-500/30 bg-slate-800"
                />
                <div>
                  <p className="text-sm text-white font-medium">I am a student filmmaker</p>
                  <p className="text-xs text-slate-400">Your work will be featured in the Student Films section</p>
                </div>
              </label>

              <button
                type="button"
                onClick={() => { if (creatorType && email && password) setStep(2); }}
                disabled={!creatorType || !email || !password}
                className="w-full py-3 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-50 transition"
              >
                Next: Your Profile
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell viewers about yourself and your creative work..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-slate-900/60 border border-slate-600 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">Social Media Links</label>
                <input
                  value={socialLinks}
                  onChange={(e) => setSocialLinks(e.target.value)}
                  placeholder="Instagram, Twitter, website (comma-separated)"
                  className="w-full px-4 py-3 rounded-lg bg-slate-900/60 border border-slate-600 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">Education</label>
                <input
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  placeholder="Where you studied / qualifications"
                  className="w-full px-4 py-3 rounded-lg bg-slate-900/60 border border-slate-600 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">Previous Work</label>
                <input
                  value={previousWork}
                  onChange={(e) => setPreviousWork(e.target.value)}
                  placeholder="Previous roles, projects, achievements"
                  className="w-full px-4 py-3 rounded-lg bg-slate-900/60 border border-slate-600 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">Goals & Aspirations</label>
                <textarea
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  placeholder="What do you want to achieve as a creator?"
                  rows={2}
                  className="w-full px-4 py-3 rounded-lg bg-slate-900/60 border border-slate-600 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 resize-none"
                />
              </div>
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-6 py-3 rounded-lg border border-slate-600 text-slate-300 font-medium hover:bg-slate-800/50 transition"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600 disabled:opacity-50 transition"
                >
                  {loading ? "Creating account..." : "Create Creator Account"}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 flex items-center gap-2 justify-center text-xs text-slate-500">
            <Shield className="w-3.5 h-3.5" />
            <span>Your profile data is encrypted and secure</span>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already a creator?{" "}
          <Link href="/auth/creator/signin" className="text-orange-500 hover:text-orange-400 font-medium">
            Creator sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
