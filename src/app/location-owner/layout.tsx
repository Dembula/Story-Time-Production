"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { CompanyPackageGate } from "@/components/layout/company-package-gate";
import { DashboardSidebarShell } from "@/components/layout/dashboard-sidebar-shell";
import { NotificationBell } from "@/components/layout/notification-bell";
import { WalletBalanceChip } from "@/components/layout/wallet-balance-chip";

const navItems = [
  { href: "/location-owner/dashboard", label: "Dashboard" },
  { href: "/location-owner/listings", label: "Properties" },
  { href: "/location-owner/deals", label: "Booking pipeline" },
  { href: "/location-owner/bookings", label: "Booking inbox" },
  { href: "/location-owner/messages", label: "Messages" },
  { href: "/location-owner/wallet", label: "Wallet" },
  { href: "/location-owner/account", label: "Account" },
  { href: "/browse", label: "View Platform" },
];

export default function LocationOwnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  return (
    <DashboardSidebarShell
      brandHref="/location-owner/dashboard"
      brandLabel={
        <>
          <span className="storytime-brand-text">STORY TIME</span> Locations
        </>
      }
      headerEnd={
        <>
          <WalletBalanceChip />
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
