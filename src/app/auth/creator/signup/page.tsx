"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Check, GraduationCap, Shield } from "lucide-react";

export default function CreatorSignUpPage() {
  const [consentReady, setConsentReady] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
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
  const creatorConsentKey = "storytime_creator_signup_ack_v1";

  useEffect(() => {
    const alreadyAccepted = window.localStorage.getItem(creatorConsentKey) === "true";
    setConsentReady(alreadyAccepted);
  }, []);

  function handleConsentContinue() {
    if (!consentAccepted) return;
    window.localStorage.setItem(creatorConsentKey, "true");
    setConsentReady(true);
  }

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
        const redirects: Record<string, string> = {
          music: "/music-creator/onboarding/license",
          content: "/creator/onboarding/license",
          equipment: "/company/onboarding/subscription",
          location: "/company/onboarding/subscription",
          crew: "/company/onboarding/subscription",
          casting: "/company/onboarding/subscription",
          catering: "/company/onboarding/subscription",
        };
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_32%),linear-gradient(135deg,rgba(255,214,153,0.18),transparent_42%),linear-gradient(180deg,#020617_0%,#111827_55%,#1f2937_100%)]" />
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-amber-100/12 to-transparent" />
      <div className="w-full max-w-lg relative z-10">
        <Link href="/" prefetch={false} className="mb-8 inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white">
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <Link href="/" prefetch={false} className="mb-10 flex items-center justify-center gap-3">
          <Image src="/logo.png" alt="Story Time" width={52} height={52} className="rounded-xl shadow-glow" />
          <span className="text-2xl font-semibold tracking-[0.14em] text-white">STORY <span className="storytime-brand-text">TIME</span></span>
        </Link>

        <div className="rounded-[28px] border border-white/15 bg-gradient-to-br from-white via-stone-50 to-amber-50 p-8 text-slate-950 shadow-[0_30px_80px_-32px_rgba(0,0,0,0.72)] backdrop-blur-xl">
          {!consentReady ? (
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-900/8 bg-slate-950 px-3 py-1 text-sm font-semibold text-amber-200 shadow-sm">
                Creator Portal
              </div>
              <h1 className="mb-2 font-display text-2xl font-semibold text-slate-950">Creator Terms Acknowledgement</h1>
              <p className="mb-6 text-sm text-slate-600">
                Before creating a creator account, you must acknowledge the platform&apos;s legal, monetization, and payment conditions.
              </p>
              <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                <p className="mb-3">By continuing, you confirm review and acceptance of:</p>
                <ul className="list-disc space-y-1 pl-5 text-slate-600">
                  <li>Terms of Service, Content Policy, and Acceptable Use Policy</li>
                  <li>Privacy, Cookie, and Security policies</li>
                  <li>Payment Policy, Subscription Terms, and Refund Policy</li>
                  <li>Creator monetization and payout conditions</li>
                </ul>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href="/legal/terms" className="text-amber-700 hover:text-amber-800">Terms</Link>
                  <Link href="/legal/content-policy" className="text-amber-700 hover:text-amber-800">Content Policy</Link>
                  <Link href="/legal/payment-policy" className="text-amber-700 hover:text-amber-800">Payment Policy</Link>
                  <Link href="/legal/refund-policy" className="text-amber-700 hover:text-amber-800">Refund Policy</Link>
                </div>
              </div>
              <label className="mb-4 flex items-start gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span>I acknowledge and agree to the creator onboarding, legal, privacy, payment, and usage terms.</span>
              </label>
              <button
                type="button"
                onClick={handleConsentContinue}
                disabled={!consentAccepted}
                className="w-full rounded-xl bg-slate-950 py-3 font-semibold text-white shadow-[0_18px_40px_-22px_rgba(15,23,42,0.85)] transition hover:-translate-y-0.5 hover:bg-slate-900 disabled:opacity-50"
              >
                I Acknowledge and Continue
              </button>
            </div>
          ) : (
            <>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-900/8 bg-slate-950 px-3 py-1 text-sm font-semibold text-amber-200 shadow-sm">
            Creator Portal
          </div>
          <h1 className="mb-2 font-display text-2xl font-semibold text-slate-950">Become a Creator</h1>
          <p className="mb-6 text-sm text-slate-600">
            Upload content, track analytics, and earn from your audience
          </p>

          {/* Step indicators */}
          <div className="mb-8 flex items-center gap-2">
            <div className={`h-1 flex-1 rounded-full ${step >= 1 ? "bg-slate-950" : "bg-slate-200"}`} />
            <div className={`h-1 flex-1 rounded-full ${step >= 2 ? "bg-slate-950" : "bg-slate-200"}`} />
          </div>

          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">I create</label>
                <select
                  value={creatorType}
                  onChange={(e) => setCreatorType(e.target.value as typeof creatorType)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
                  required
                >
                  <option value="" disabled>
                    Select account type
                  </option>
                  <option value="content">Films / Shows</option>
                  <option value="music">Music</option>
                  <option value="equipment">Equipment Co.</option>
                  <option value="location">Location / Property</option>
                  <option value="crew">Crew Team</option>
                  <option value="casting">Casting Agency</option>
                  <option value="catering">Catering</option>
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
              </div>

              <button
                type="button"
                onClick={() => setIsAfda((current) => !current)}
                aria-pressed={isAfda}
                className={`w-full rounded-2xl border p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 ${
                  isAfda
                    ? "border-amber-300 bg-gradient-to-br from-amber-100 via-white to-amber-50"
                    : "border-slate-200 bg-white/90 hover:border-slate-300 hover:bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${
                      isAfda ? "border-amber-300/70 bg-amber-200/50 text-amber-700" : "border-slate-200 bg-slate-100 text-slate-500"
                    }`}>
                      <GraduationCap className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">Student filmmaker</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Turn this on if you want your work highlighted in the Student Films section while you are still studying.
                      </p>
                    </div>
                  </div>
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                    isAfda ? "border-amber-400 bg-amber-500 text-white" : "border-slate-300 bg-white text-transparent"
                  }`}>
                    <Check className="h-4 w-4" />
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => { if (creatorType && email && password) setStep(2); }}
                disabled={!creatorType || !email || !password}
                className="w-full rounded-xl bg-slate-950 py-3 font-semibold text-white shadow-[0_18px_40px_-22px_rgba(15,23,42,0.85)] transition hover:-translate-y-0.5 hover:bg-slate-900 disabled:opacity-50"
              >
                Next: Your Profile
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell viewers about yourself and your creative work..."
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Social Media Links</label>
                <input
                  value={socialLinks}
                  onChange={(e) => setSocialLinks(e.target.value)}
                  placeholder="Instagram, Twitter, website (comma-separated)"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Education</label>
                <input
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  placeholder="Where you studied / qualifications"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Previous Work</label>
                <input
                  value={previousWork}
                  onChange={(e) => setPreviousWork(e.target.value)}
                  placeholder="Previous roles, projects, achievements"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Goals & Aspirations</label>
                <textarea
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  placeholder="What do you want to achieve as a creator?"
                  rows={2}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
                />
              </div>
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-slate-200 bg-white px-6 py-3 font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-xl bg-slate-950 py-3 font-semibold text-white shadow-[0_18px_40px_-22px_rgba(15,23,42,0.85)] transition hover:-translate-y-0.5 hover:bg-slate-900 disabled:opacity-50"
                >
                  {loading ? "Creating account..." : "Create Creator Account"}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
            <Shield className="w-3.5 h-3.5" />
            <span>Your creator account is protected by platform access controls</span>
          </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already a creator?{" "}
          <Link href="/auth/creator/signin" className="font-medium text-amber-300 hover:text-amber-200">
            Creator sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
