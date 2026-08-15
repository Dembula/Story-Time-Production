import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { defaultHomeForRole } from "@/lib/auth-sign-in-path";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { Hero } from "@/components/landing/Hero";
import { LandingCta } from "@/components/landing/LandingCta";
import { Security } from "@/components/landing/Security";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session?.user?.role === "ADMIN") redirect("/admin");
  if (session?.user?.role === "CONTENT_CREATOR") redirect("/creator/command-center");
  if (session?.user?.role === "MUSIC_CREATOR") redirect("/music-creator/dashboard");
  if (session?.user?.role === "EQUIPMENT_COMPANY") redirect("/company/onboarding/subscription");
  if (session?.user?.role === "LOCATION_OWNER") redirect("/company/onboarding/subscription");
  if (session?.user?.role === "CREW_TEAM") redirect("/company/onboarding/subscription");
  if (session?.user?.role === "CASTING_AGENCY") redirect("/company/onboarding/subscription");
  if (session?.user?.role === "CATERING_COMPANY") redirect("/company/onboarding/subscription");
  if (session?.user?.role === "FUNDER") redirect(defaultHomeForRole("FUNDER"));
  if (session) redirect(defaultHomeForRole(session.user.role));

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white">
      <LandingHeader />
      <Hero />
      <LandingCta />
      <Security />
      <LandingFooter />
    </div>
  );
}
