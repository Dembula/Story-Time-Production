"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Bell, ChevronLeft, LayoutDashboard, LogOut, ShieldCheck, WalletCards, Handshake } from "lucide-react";
import { NotificationBell } from "@/components/layout/notification-bell";

const NAV_ITEMS = [
  { href: "/funders", label: "Dashboard", icon: LayoutDashboard },
  { href: "/funders/opportunities", label: "Opportunities", icon: Bell },
  { href: "/funders/deals", label: "Deals", icon: Handshake },
  { href: "/funders/portfolio", label: "Portfolio", icon: WalletCards },
  { href: "/funders/verification", label: "Verification", icon: ShieldCheck },
];

export default function FundersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background text-slate-100">
      <header className="border-b border-white/8 bg-white/[0.03] px-4 py-4 backdrop-blur-xl md:px-10">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.08] hover:text-white"
            >
              {sidebarOpen ? "Hide menu" : "Show menu"}
            </button>
            <Link href="/funders" className="text-lg font-semibold text-white">
              <span className="storytime-brand-text">STORY TIME</span> Funders
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.08] hover:text-white"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Home
            </Link>
            <NotificationBell />
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-900/35"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-5 md:px-10">
        {sidebarOpen ? (
          <aside className="w-64 shrink-0 rounded-2xl border border-white/8 bg-slate-950/70 p-3">
            <p className="px-2 pb-2 text-[11px] uppercase tracking-wide text-slate-500">Funder workspace</p>
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                      active ? "bg-white/[0.1] text-white shadow-panel" : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-4 rounded-lg border border-white/8 bg-white/[0.03] p-3 text-xs text-slate-400">
              Signed in as <span className="font-medium text-slate-200">{session?.user?.email ?? "funder"}</span>
            </div>
          </aside>
        ) : null}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
