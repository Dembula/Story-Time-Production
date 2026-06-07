"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Bell, ChevronLeft, Handshake, LayoutDashboard, LogOut, ShieldCheck, WalletCards } from "lucide-react";
import { DashboardSidebarShell } from "@/components/layout/dashboard-sidebar-shell";
import { NotificationBell } from "@/components/layout/notification-bell";

const NAV_ITEMS = [
  { href: "/funders", label: "Dashboard", icon: LayoutDashboard },
  { href: "/funders/opportunities", label: "Opportunities", icon: Bell },
  { href: "/funders/deals", label: "Deals", icon: Handshake },
  { href: "/funders/portfolio", label: "Portfolio", icon: WalletCards },
  { href: "/funders/wallet", label: "Wallet", icon: WalletCards },
  { href: "/funders/verification", label: "Verification", icon: ShieldCheck },
];

export default function FundersLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session } = useSession();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  return (
    <DashboardSidebarShell
      brandHref="/funders"
      brandLabel={
        <>
          <span className="storytime-brand-text">STORY TIME</span> Funders
        </>
      }
      headerEnd={
        <>
          <Link
            href="/"
            className="hidden items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.08] hover:text-white sm:inline-flex"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Home
          </Link>
          <NotificationBell />
          <button
            onClick={handleSignOut}
            className="hidden items-center gap-1 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-900/35 md:inline-flex"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </>
      }
      navSections={[{ title: "Funder workspace", items: NAV_ITEMS }]}
      sidebarFooter={
        <>
          <div className="mb-3 rounded-lg border border-white/8 bg-white/[0.03] p-3 text-xs text-slate-400">
            Signed in as <span className="font-medium text-slate-200">{session?.user?.email ?? "funder"}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300 transition hover:bg-red-900/35 md:hidden"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </>
      }
      mainClassName="space-y-4"
    >
      {children}
    </DashboardSidebarShell>
  );
}
