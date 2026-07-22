"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { DashboardSidebarShell, type DashboardNavSection } from "@/components/layout/dashboard-sidebar-shell";
import { NotificationBell } from "@/components/layout/notification-bell";
const navSections: DashboardNavSection[] = [
  {
    title: "Operations",
    items: [
      { href: "/admin", label: "Overview" },
      { href: "/admin/review", label: "Review hub" },
      { href: "/admin/script-reviews", label: "Executive script reviews", highlight: true },
      { href: "/admin/projects", label: "Projects" },
    ],
  },
  {
    title: "Catalogue & rights",
    items: [
      { href: "/admin/content", label: "Content" },
      { href: "/admin/encode-health", label: "Encode health" },
      { href: "/admin/credit-people", label: "Credit identities" },
      { href: "/admin/originals", label: "Originals", highlight: true },
      { href: "/admin/music", label: "Music" },
    ],
  },
  {
    title: "Marketplace",
    items: [
      { href: "/admin/crew", label: "Crew" },
      { href: "/admin/cast", label: "Cast" },
      { href: "/admin/locations", label: "Locations" },
      { href: "/admin/marketplace-vendors", label: "Equipment & catering" },
    ],
  },
  {
    title: "Platform",
    items: [
      { href: "/admin/users", label: "Users" },
      { href: "/admin/creators", label: "Creators" },
      { href: "/admin/requests", label: "Requests" },
      { href: "/admin/revenue", label: "Revenue" },
      { href: "/admin/payments", label: "Payments" },
      { href: "/admin/promo-codes", label: "Promo codes" },
      { href: "/admin/funders", label: "Funders" },
      { href: "/admin/funding-programs", label: "Funding programs" },
      { href: "/admin/payout-verification", label: "Payout KYC" },
      { href: "/admin/activity", label: "Activity" },
      { href: "/admin/ai", label: "AI OS" },
      { href: "/admin/competition", label: "Competition" },
      { href: "/browse", label: "View site" },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(249,115,22,0.02)_100%)]" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />

      <DashboardSidebarShell
        className="relative z-10"
        brandHref="/admin"
        brandLabel={
          <>
            <span className="storytime-brand-text">STORY TIME</span> Admin
          </>
        }
        headerEnd={
          <>
            <NotificationBell />
            <button
              onClick={handleSignOut}
              className="hidden transition md:inline-flex md:items-center md:gap-1.5 md:text-slate-400 md:hover:text-red-400"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </>
        }
        navSections={navSections}
        sidebarFooter={
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-slate-400 transition hover:bg-slate-900/70 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        }
      >
        {children}
      </DashboardSidebarShell>
    </div>
  );
}
