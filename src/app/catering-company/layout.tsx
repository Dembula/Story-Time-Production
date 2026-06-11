"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { CompanyPackageGate } from "@/components/layout/company-package-gate";
import { DashboardSidebarShell } from "@/components/layout/dashboard-sidebar-shell";
import { NotificationBell } from "@/components/layout/notification-bell";
import { PlatformRoleSwitcher } from "@/components/auth/platform-role-switcher";

const navItems = [
  { href: "/catering-company/dashboard", label: "Dashboard" },
  { href: "/catering-company/profile", label: "Menu & gallery" },
  { href: "/catering-company/deals", label: "Event pipeline" },
  { href: "/catering-company/bookings", label: "Bookings inbox" },
  { href: "/catering-company/messages", label: "Messages" },
  { href: "/catering-company/revenue", label: "Revenue" },
  { href: "/catering-company/wallet", label: "Wallet" },
];

export default function CateringCompanyLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  return (
    <DashboardSidebarShell
      brandHref="/catering-company/dashboard"
      brandLabel={
        <>
          <span className="storytime-brand-text">STORY TIME</span> Catering
        </>
      }
      headerEnd={
        <>
          <PlatformRoleSwitcher />
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
