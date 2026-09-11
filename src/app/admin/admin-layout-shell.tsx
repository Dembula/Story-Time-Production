"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { DashboardSidebarShell } from "@/components/layout/dashboard-sidebar-shell";
import { NotificationBell } from "@/components/layout/notification-bell";
import type { DashboardNavSection } from "@/components/layout/dashboard-sidebar-shell";

type Props = {
  children: React.ReactNode;
  navSections: DashboardNavSection[];
};

export function AdminLayoutShell({ children, navSections }: Props) {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(249,115,22,0.02)_100%)]" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />

      <DashboardSidebarShell
        className="relative z-10"
        brandHref="/admin"
        brandLabel="Admin"
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
