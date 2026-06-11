"use client";

import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DashboardSidebarShell, type DashboardNavSection } from "@/components/layout/dashboard-sidebar-shell";
import { NotificationBell } from "@/components/layout/notification-bell";
import { CreatorPackageGate } from "@/components/creator/creator-package-gate";
import { CreatorStudioActingLabel } from "@/components/creator/creator-studio-switcher";
import { CREATOR_STUDIO_PROFILES_QUERY_KEY } from "@/lib/pricing";

export default function MusicCreatorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role;

  const { data: studioPayload } = useQuery({
    queryKey: [...CREATOR_STUDIO_PROFILES_QUERY_KEY],
    queryFn: () => fetch("/api/creator/studio-profiles").then((r) => r.json()),
    enabled: role === "MUSIC_CREATOR",
  });

  const showCompanyAdmin = Boolean(studioPayload?.companies?.length);

  const navSections = useMemo((): DashboardNavSection[] => {
    const items: Array<{ href: string; label: string; highlight?: boolean }> = [];

    if (showCompanyAdmin) {
      items.push({ href: "/creator/company/control", label: "Account control" });
      items.push({ href: "/music-creator/company", label: "Company admin" });
    }

    items.push(
      { href: "/music-creator/dashboard", label: "Dashboard" },
      { href: "/music-creator/upload", label: "Upload" },
      { href: "/music-creator/sync-requests", label: "Sync Requests" },
      { href: "/music-creator/revenue", label: "Revenue" },
      { href: "/music-creator/messages", label: "Messages" },
      { href: "/music-creator/account", label: "Account" },
      { href: "/music-creator/wallet", label: "Wallet" },
      { href: "/music-creator/originals", label: "Originals", highlight: true }
    );

    return [{ items }];
  }, [role, showCompanyAdmin]);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  if (pathname.startsWith("/music-creator/onboarding")) {
    return <>{children}</>;
  }

  return (
    <DashboardSidebarShell
      brandHref="/music-creator/dashboard"
      brandLabel={
        <>
          <span className="storytime-brand-text">STORY TIME</span> Music
        </>
      }
      headerEnd={
        <>
          <CreatorStudioActingLabel />
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
          className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-slate-400 transition hover:bg-slate-900/70 hover:text-red-400 md:hidden"
        >
          <LogOut className="w-4 h-4" /> Logout
        </button>
      }
    >
      <CreatorPackageGate>{children}</CreatorPackageGate>
    </DashboardSidebarShell>
  );
}
