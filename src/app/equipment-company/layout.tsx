"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { CompanyPackageGate } from "@/components/layout/company-package-gate";
import { DashboardSidebarShell } from "@/components/layout/dashboard-sidebar-shell";
import { NotificationBell } from "@/components/layout/notification-bell";

const navItems = [
  { href: "/equipment-company/dashboard", label: "Dashboard" },
  { href: "/equipment-company/listings", label: "Fleet & kit" },
  { href: "/equipment-company/deals", label: "Rental pipeline" },
  { href: "/equipment-company/requests", label: "Request inbox" },
  { href: "/equipment-company/messages", label: "Messages" },
  { href: "/equipment-company/wallet", label: "Wallet" },
  { href: "/equipment-company/account", label: "Company account" },
];

export default function EquipmentCompanyLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  return (
    <DashboardSidebarShell
      brandHref="/equipment-company/dashboard"
      brandLabel={
        <>
          <span className="storytime-brand-text">STORY TIME</span> Equipment
        </>
      }
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
