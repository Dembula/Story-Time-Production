"use client";

import { signIn } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Check, GraduationCap, Shield } from "lucide-react";
import { useSearchParams } from "next/navigation";

function CreatorSignUpPageInner() {
  const [consentReady, setConsentReady] = useState(false);
  const [email, setEmail] = useState("");
  const [creatorType, setCreatorType] = useState<"content" | "music" | "equipment" | "location" | "crew" | "casting" | "catering" | "funder" | "">("");
  const [accountStructure, setAccountStructure] = useState<"INDIVIDUAL" | "COMPANY" | "">("COMPANY");
  /** Total seats including the registering admin (1–5). Only used for film/music company accounts. */
  const [teamSeatCap, setTeamSeatCap] = useState(2);
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
  const [companyName, setCompanyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [website, setWebsite] = useState("");
  const [actorFullName, setActorFullName] = useState("");
  const [actorAgeRange, setActorAgeRange] = useState("");
  const [actorGender, setActorGender] = useState("");
  const [actorLanguages, setActorLanguages] = useState("");
  const [actorSkills, setActorSkills] = useState("");
  const [actorExperience, setActorExperience] = useState("");
  const [actorDailyRate, setActorDailyRate] = useState("");
  const [actorProjectRate, setActorProjectRate] = useState("");
  const [actorAvailability, setActorAvailability] = useState("");
  const [actorShowreel, setActorShowreel] = useState("");
  const [crewMemberName, setCrewMemberName] = useState("");
  const [crewRole, setCrewRole] = useState("");
  const [crewDepartment, setCrewDepartment] = useState("");
  const [crewExperience, setCrewExperience] = useState("");
  const [crewDailyRate, setCrewDailyRate] = useState("");
  const [crewAvailability, setCrewAvailability] = useState("");
  const [crewSkills, setCrewSkills] = useState("");
  const [crewPortfolio, setCrewPortfolio] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationType, setLocationType] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [locationDailyRate, setLocationDailyRate] = useState("");
  const [locationHourlyRate, setLocationHourlyRate] = useState("");
  const [locationAvailability, setLocationAvailability] = useState("");
  const [locationPermits, setLocationPermits] = useState("");
  const [locationRestrictions, setLocationRestrictions] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentCategory, setEquipmentCategory] = useState("");
  const [equipmentSpecs, setEquipmentSpecs] = useState("");
  const [equipmentDailyRate, setEquipmentDailyRate] = useState("");
  const [equipmentQuantity, setEquipmentQuantity] = useState("");
  const [equipmentAvailability, setEquipmentAvailability] = useState("");
  const searchParams = useSearchParams();

  useEffect(() => {
    setConsentReady(searchParams.get("termsAccepted") === "1");
  }, [searchParams]);

  function handleCreatorTypeChange(next: typeof creatorType) {
    setCreatorType(next);
    if (next === "content" || next === "music") {
      setAccountStructure("");
      setTeamSeatCap(2);
    } else if (["equipment", "location", "crew", "casting", "catering", "funder"].includes(next)) {
      setAccountStructure("COMPANY");
      setTeamSeatCap(2);
    } else {
      setAccountStructure("");
      setTeamSeatCap(2);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const type = creatorType || "content";
    const trimmedEmail = email.trim().toLowerCase();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (type === "content" || type === "music") {
      if (accountStructure !== "INDIVIDUAL" && accountStructure !== "COMPANY") {
        setError("Select Individual creator or Company / team account before continuing.");
        return;
      }
      if (accountStructure === "COMPANY" && (teamSeatCap < 1 || teamSeatCap > 5)) {
        setError("Choose a team size between 1 and 5.");
        return;
      }
    }
    setLoading(true);
    try {
      const regRes = await fetch("/api/creator/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
          type,
          accountStructure: type === "content" || type === "music" ? accountStructure : accountStructure || "COMPANY",
          teamSeatCap:
            (type === "content" || type === "music") && accountStructure === "COMPANY" ? teamSeatCap : undefined,
          companyName,
          contactEmail,
          city,
          country,
          website,
          bio,
          socialLinks,
          education,
          goals,
          previousWork,
          isAfda,
          actorProfile: creatorType === "casting" ? {
            fullName: actorFullName || undefined,
            ageRange: actorAgeRange || undefined,
            gender: actorGender || undefined,
            languages: actorLanguages.split(",").map((v) => v.trim()).filter(Boolean),
            skills: actorSkills.split(",").map((v) => v.trim()).filter(Boolean),
            experienceLevel: actorExperience || undefined,
            dailyRate: actorDailyRate ? Number(actorDailyRate) : undefined,
            projectRate: actorProjectRate ? Number(actorProjectRate) : undefined,
            availability: actorAvailability || undefined,
            showreel: actorShowreel || undefined,
            pastWork: previousWork || undefined,
            contactInfo: contactEmail || email,
          } : undefined,
          crewProfile: creatorType === "crew" ? {
            name: crewMemberName || undefined,
            role: crewRole || undefined,
            department: crewDepartment || undefined,
            experienceLevel: crewExperience || undefined,
            dailyRate: crewDailyRate ? Number(crewDailyRate) : undefined,
            availability: crewAvailability || undefined,
            location: city || undefined,
            skills: crewSkills.split(",").map((v) => v.trim()).filter(Boolean),
            portfolio: crewPortfolio || undefined,
          } : undefined,
          locationProfile: creatorType === "location" ? {
            name: locationName || undefined,
            address: locationAddress || undefined,
            type: locationType || undefined,
            description: bio || undefined,
            availability: locationAvailability || undefined,
            rentalCostPerDay: locationDailyRate ? Number(locationDailyRate) : undefined,
            rentalCostPerHour: locationHourlyRate ? Number(locationHourlyRate) : undefined,
            permitRequirements: locationPermits || undefined,
            restrictions: locationRestrictions || undefined,
            region: city || undefined,
          } : undefined,
          equipmentProfile: creatorType === "equipment" ? {
            name: equipmentName || undefined,
            category: equipmentCategory || undefined,
            specifications: equipmentSpecs || undefined,
            dailyRentalRate: equipmentDailyRate ? Number(equipmentDailyRate) : undefined,
            quantityAvailable: equipmentQuantity ? Number(equipmentQuantity) : undefined,
            availability: equipmentAvailability || undefined,
            location: city || undefined,
          } : undefined,
        }),
      });
      const regData = regRes.ok ? null : (await regRes.json().catch(() => ({})));
      if (!regRes.ok) {
        setLoading(false);
        setError((regData?.error as string) || "Registration failed. Please try again.");
        return;
      }
      const res = await signIn("credentials-creator", {
        email: trimmedEmail,
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
          funder: "/funders/verification",
        };
        window.location.href = redirects[type] ?? "/creator/command-center";
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
          {!consentReady ? (
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-900/8 bg-slate-950 px-3 py-1 text-sm font-semibold text-amber-200 shadow-sm">
                Creator Portal
              </div>
              <h1 className="mb-2 font-display text-2xl font-semibold text-slate-950">Creator Terms Acknowledgement</h1>
              <p className="mb-6 text-sm text-slate-600">
                Continue to the dedicated terms screen to acknowledge legal, monetization, and payment conditions before creator signup.
              </p>
              <Link
                href="/auth/creator/signup/terms"
                className="inline-flex w-full items-center justify-center rounded-xl bg-slate-950 py-3 font-semibold text-white shadow-[0_18px_40px_-22px_rgba(15,23,42,0.85)] transition hover:-translate-y-0.5 hover:bg-slate-900"
              >
                Review terms and continue
              </Link>
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
                  onChange={(e) => handleCreatorTypeChange(e.target.value as typeof creatorType)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
                  required
                >
                  <option value="" disabled>
                    Select what you create
                  </option>
                  <option value="content">Films / Shows</option>
                  <option value="music">Music</option>
                  <option value="equipment">Equipment Co.</option>
                  <option value="location">Location / Property</option>
                  <option value="crew">Crew Team</option>
                  <option value="casting">Casting Agency</option>
                  <option value="catering">Catering</option>
                  <option value="funder">Funder / Investor</option>
                </select>
              </div>
              {(creatorType === "content" || creatorType === "music") && (
                <div className="space-y-3 rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-white p-4">
                  <p className="text-sm font-semibold text-slate-900">Studio account type</p>
                  <p className="text-xs leading-relaxed text-slate-600">
                    Choose how your Story Time account is structured. This is stored on your profile for verification and
                    team workflows later.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setAccountStructure("INDIVIDUAL")}
                      className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                        accountStructure === "INDIVIDUAL"
                          ? "border-amber-500 bg-white shadow-md ring-1 ring-amber-300/60"
                          : "border-slate-200 bg-white/80 hover:border-slate-300"
                      }`}
                    >
                      <span className="font-semibold text-slate-900">Individual creator</span>
                      <span className="mt-1 block text-xs text-slate-600">Single login — you manage your catalogue and payouts alone.</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountStructure("COMPANY")}
                      className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                        accountStructure === "COMPANY"
                          ? "border-amber-500 bg-white shadow-md ring-1 ring-amber-300/60"
                          : "border-slate-200 bg-white/80 hover:border-slate-300"
                      }`}
                    >
                      <span className="font-semibold text-slate-900">Company / team</span>
                      <span className="mt-1 block text-xs text-slate-600">
                        Multi-user studio — you are the admin; teammates join by invite (up to five logins total).
                      </span>
                    </button>
                  </div>
                  {accountStructure === "COMPANY" && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-700">Team size (logins)</label>
                      <p className="mb-2 text-[11px] leading-snug text-slate-500">
                        Total seats including you as the main admin. Each seat is a separate profile/login after you
                        invite and approve them.
                      </p>
                      <select
                        value={teamSeatCap}
                        onChange={(e) => setTeamSeatCap(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 shadow-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n === 1
                              ? "1 — admin only (add teammates later)"
                              : `${n} — you + ${n - 1} teammate${n === 2 ? "" : "s"}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
              {["equipment", "location", "crew", "casting", "catering", "funder"].includes(creatorType) ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Account setup</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAccountStructure("INDIVIDUAL")}
                      className={`rounded-xl border px-4 py-2 text-sm ${
                        accountStructure === "INDIVIDUAL"
                          ? "border-amber-400 bg-amber-100/60 text-slate-900"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      Individual
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountStructure("COMPANY")}
                      className={`rounded-xl border px-4 py-2 text-sm ${
                        accountStructure === "COMPANY"
                          ? "border-amber-400 bg-amber-100/60 text-slate-900"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      Company
                    </button>
                  </div>
                </div>
              ) : null}
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
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
                />
                <p className="mt-1.5 text-xs text-slate-500">At least 8 characters.</p>
              </div>
              {["equipment", "location", "crew", "casting", "catering", "funder"].includes(creatorType) ? (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      {accountStructure === "COMPANY" ? "Company name" : "Public profile name"}
                    </label>
                    <input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder={accountStructure === "COMPANY" ? "Studio / Company name" : "Your public professional name"}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
                    />
                    <input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Country"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
                    />
                  </div>
                </>
              ) : null}

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
                onClick={() => {
                  if (!creatorType || !email.trim() || password.length < 8) return;
                  if (
                    (creatorType === "content" || creatorType === "music") &&
                    accountStructure !== "INDIVIDUAL" &&
                    accountStructure !== "COMPANY"
                  ) {
                    return;
                  }
                  setStep(2);
                }}
                disabled={
                  !creatorType ||
                  !email.trim() ||
                  password.length < 8 ||
                  ((creatorType === "content" || creatorType === "music") &&
                    accountStructure !== "INDIVIDUAL" &&
                    accountStructure !== "COMPANY")
                }
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
              {["equipment", "location", "crew", "casting", "catering", "funder"].includes(creatorType) ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Contact email</label>
                      <input
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="bookings@company.com"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Website</label>
                      <input
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/80"
                      />
                    </div>
                  </div>
                </>
              ) : null}
              {creatorType === "casting" ? (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">Initial actor profile</p>
                  <input value={actorFullName} onChange={(e) => setActorFullName(e.target.value)} placeholder="Actor full name" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={actorAgeRange} onChange={(e) => setActorAgeRange(e.target.value)} placeholder="Age range" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                    <input value={actorGender} onChange={(e) => setActorGender(e.target.value)} placeholder="Gender" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                  </div>
                  <input value={actorLanguages} onChange={(e) => setActorLanguages(e.target.value)} placeholder="Languages (comma separated)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                  <input value={actorSkills} onChange={(e) => setActorSkills(e.target.value)} placeholder="Skills / accents (comma separated)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={actorExperience} onChange={(e) => setActorExperience(e.target.value)} placeholder="Experience level" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                    <input value={actorAvailability} onChange={(e) => setActorAvailability(e.target.value)} placeholder="Availability" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={actorDailyRate} onChange={(e) => setActorDailyRate(e.target.value)} placeholder="Daily rate (ZAR)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                    <input value={actorProjectRate} onChange={(e) => setActorProjectRate(e.target.value)} placeholder="Project rate (ZAR)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                  </div>
                  <input
                    value={actorShowreel}
                    onChange={(e) => setActorShowreel(e.target.value)}
                    placeholder="Vimeo, YouTube, or direct link to your reel (upload more after signup)"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950"
                  />
                </div>
              ) : null}
              {creatorType === "crew" ? (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">Primary crew profile</p>
                  <input value={crewMemberName} onChange={(e) => setCrewMemberName(e.target.value)} placeholder="Name" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={crewRole} onChange={(e) => setCrewRole(e.target.value)} placeholder="Role" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                    <input value={crewDepartment} onChange={(e) => setCrewDepartment(e.target.value)} placeholder="Department" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                  </div>
                  <input value={crewSkills} onChange={(e) => setCrewSkills(e.target.value)} placeholder="Skills / tools (comma separated)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={crewExperience} onChange={(e) => setCrewExperience(e.target.value)} placeholder="Experience level" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                    <input value={crewAvailability} onChange={(e) => setCrewAvailability(e.target.value)} placeholder="Availability" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                  </div>
                  <input value={crewDailyRate} onChange={(e) => setCrewDailyRate(e.target.value)} placeholder="Daily rate (ZAR)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                  <input value={crewPortfolio} onChange={(e) => setCrewPortfolio(e.target.value)} placeholder="Portfolio / past work" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                </div>
              ) : null}
              {creatorType === "location" ? (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">Initial location profile</p>
                  <input value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Location name" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={locationType} onChange={(e) => setLocationType(e.target.value)} placeholder="Type (house, studio, etc.)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                    <input value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} placeholder="Address" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={locationDailyRate} onChange={(e) => setLocationDailyRate(e.target.value)} placeholder="Daily rental (ZAR)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                    <input value={locationHourlyRate} onChange={(e) => setLocationHourlyRate(e.target.value)} placeholder="Hourly rental (ZAR)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                  </div>
                  <input value={locationAvailability} onChange={(e) => setLocationAvailability(e.target.value)} placeholder="Availability calendar / rules" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                  <input value={locationPermits} onChange={(e) => setLocationPermits(e.target.value)} placeholder="Permit requirements" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                  <input value={locationRestrictions} onChange={(e) => setLocationRestrictions(e.target.value)} placeholder="Restrictions (noise, time limits, etc.)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                </div>
              ) : null}
              {creatorType === "equipment" ? (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">Initial equipment profile</p>
                  <input value={equipmentName} onChange={(e) => setEquipmentName(e.target.value)} placeholder="Equipment name" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={equipmentCategory} onChange={(e) => setEquipmentCategory(e.target.value)} placeholder="Category (camera, lighting...)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                    <input value={equipmentQuantity} onChange={(e) => setEquipmentQuantity(e.target.value)} placeholder="Quantity available" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                  </div>
                  <input value={equipmentSpecs} onChange={(e) => setEquipmentSpecs(e.target.value)} placeholder="Specifications" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={equipmentDailyRate} onChange={(e) => setEquipmentDailyRate(e.target.value)} placeholder="Daily rental rate (ZAR)" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                    <input value={equipmentAvailability} onChange={(e) => setEquipmentAvailability(e.target.value)} placeholder="Availability" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-950" />
                  </div>
                </div>
              ) : null}
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

export default function CreatorSignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <CreatorSignUpPageInner />
    </Suspense>
  );
}
