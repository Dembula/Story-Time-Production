"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { CompanyPackageGate } from "@/components/layout/company-package-gate";
import { DashboardSidebarShell } from "@/components/layout/dashboard-sidebar-shell";
import { NotificationBell } from "@/components/layout/notification-bell";
import { mergeStakeholderNavSections } from "@/lib/stakeholder-ecosystem/portal-nav";

const businessNavItems = [
  { href: "/crew-team/dashboard", label: "Dashboard" },
  { href: "/crew-team/team", label: "Crew roster" },
  { href: "/crew-team/deals", label: "Jobs pipeline" },
  { href: "/crew-team/invitations", label: "Project invites" },
  { href: "/crew-team/requests", label: "Request inbox" },
  { href: "/crew-team/contracts", label: "Contracts" },
  { href: "/crew-team/profile", label: "Company profile" },
  { href: "/crew-team/wallet", label: "Wallet" },
];

export default function CrewTeamLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  return (
    <DashboardSidebarShell
      brandHref="/crew-team/dashboard"
      brandLabel={
        <>
          <span className="storytime-brand-text">STORY TIME</span> Crew Team
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
      navSections={mergeStakeholderNavSections("crew-team", businessNavItems)}
      sidebarFooter={
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-slate-400 transition hover:bg-slate-900/70 hover:text-red-400"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      }
    >
      <CompanyPackageGate>{children}</CompanyPackageGate>
    </DashboardSidebarShell>
  );
}
