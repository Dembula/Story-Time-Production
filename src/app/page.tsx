import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { Hero } from "@/components/landing/Hero";
import { Stats } from "@/components/landing/Stats";
import { Features } from "@/components/landing/Features";
import { Vision } from "@/components/landing/Vision";
import { LandingCta } from "@/components/landing/LandingCta";
import { Security } from "@/components/landing/Security";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session?.user?.role === "ADMIN") redirect("/admin");
  if (session?.user?.role === "CONTENT_CREATOR") redirect("/creator/dashboard");
  if (session?.user?.role === "MUSIC_CREATOR") redirect("/music-creator/dashboard");
  if (session?.user?.role === "EQUIPMENT_COMPANY") redirect("/company/onboarding/subscription");
  if (session?.user?.role === "LOCATION_OWNER") redirect("/company/onboarding/subscription");
  if (session?.user?.role === "CREW_TEAM") redirect("/company/onboarding/subscription");
  if (session?.user?.role === "CASTING_AGENCY") redirect("/company/onboarding/subscription");
  if (session?.user?.role === "CATERING_COMPANY") redirect("/company/onboarding/subscription");
  if (session) redirect("/profiles");

  return (
    <div className="min-h-screen bg-[#0c1222] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(249,115,22,0.06),transparent_50%)]" />
      <LandingHeader />
      <Hero />
      <Stats />
      <Features />
      <Vision />
      <LandingCta />
      <Security />
      <LandingFooter />
    </div>
  );
}
