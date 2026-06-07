"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { CompanyPackageGate } from "@/components/layout/company-package-gate";
import { DashboardSidebarShell } from "@/components/layout/dashboard-sidebar-shell";
import { NotificationBell } from "@/components/layout/notification-bell";

const navItems = [
  { href: "/casting-agency/dashboard", label: "Dashboard" },
  { href: "/casting-agency/talent", label: "Talent roster" },
  { href: "/casting-agency/auditions", label: "Auditions" },
  { href: "/casting-agency/availability", label: "Availability" },
  { href: "/casting-agency/deals", label: "Deal pipeline" },
  { href: "/casting-agency/inquiries", label: "Inquiries" },
  { href: "/casting-agency/invitations", label: "Invitations" },
  { href: "/casting-agency/contracts", label: "Contracts" },
  { href: "/casting-agency/wallet", label: "Wallet" },
  { href: "/casting-agency/profile", label: "Agency profile" },
  { href: "/browse", label: "View Platform" },
];

export default function CastingAgencyLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  return (
    <DashboardSidebarShell
      brandHref="/casting-agency/dashboard"
      brandLabel={
        <>
          <span className="storytime-brand-text">STORY TIME</span> Casting
        </>
      }
      headerEnd={
        <>
          <NotificationBell />
          <button
            onClick={handleSignOut}
            className="hidden items-center gap-1.5 text-sm text-slate-400 transition hover:text-red-400 md:inline-flex"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </>
      }
      navSections={[{ items: navItems }]}
      sidebarFooter={
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-slate-400 transition hover:bg-slate-900/70 hover:text-red-400 md:hidden"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      }
    >
      <CompanyPackageGate>{children}</CompanyPackageGate>
    </DashboardSidebarShell>
  );
}
