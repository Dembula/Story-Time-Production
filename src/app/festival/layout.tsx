"use client";

import { signOut } from "next-auth/react";
import {
  Clapperboard,
  Film,
  LayoutDashboard,
  LogOut,
  Receipt,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { DashboardSidebarShell } from "@/components/layout/dashboard-sidebar-shell";
import { NotificationBell } from "@/components/layout/notification-bell";
import { PayoutKycBanner } from "@/components/payout-kyc/payout-kyc-banner";

const festivalNavSections = [
  {
    title: "Overview",
    items: [
      { href: "/festival", label: "Dashboard", icon: LayoutDashboard },
      { href: "/festival/festivals", label: "My festivals", icon: Film },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/festival/submissions", label: "Submissions", icon: Clapperboard },
      { href: "/festival/review", label: "Review hub", icon: ShieldCheck },
      { href: "/festival/screening", label: "Screening", icon: Film },
      { href: "/festival/team", label: "Team", icon: Users },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/festival/payouts", label: "Revenue", icon: Receipt },
      { href: "/festival/wallet", label: "Wallet", icon: Wallet },
      { href: "/payout-verification", label: "KYB / Banking", icon: ShieldCheck },
    ],
  },
];

export default function FestivalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const navSections = useMemo(() => festivalNavSections, []);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  if (pathname.startsWith("/festival/join/")) {
    return <>{children}</>;
  }

  return (
    <DashboardSidebarShell
      brandHref="/festival"
      brandLabel="Festivals"
      className="text-slate-100 adaptive-tv-surface"
      headerEnd={
        <>
          <NotificationBell />
          <button
            onClick={handleSignOut}
            className="hidden md:inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-400 transition"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </>
      }
      navSections={navSections}
      sidebarFooter={
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-slate-400 transition hover:bg-slate-900/70 hover:text-red-400"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      }
    >
      <div className="space-y-4">
        <PayoutKycBanner />
        {children}
      </div>
    </DashboardSidebarShell>
  );
}
