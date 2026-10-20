"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { DashboardSidebarShell } from "@/components/layout/dashboard-sidebar-shell";
import { NotificationBell } from "@/components/layout/notification-bell";

const festivalNavSections = [
  {
    title: "Overview",
    items: [
      { href: "/festival", label: "Dashboard" },
      { href: "/festival/festivals", label: "My festivals" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/festival/submissions", label: "Submissions" },
      { href: "/festival/review", label: "Review hub" },
      { href: "/festival/screening", label: "Screening" },
      { href: "/festival/team", label: "Team" },
      { href: "/festival/payouts", label: "Revenue" },
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
      {children}
    </DashboardSidebarShell>
  );
}
