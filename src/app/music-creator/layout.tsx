"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CreatorStudioActingLabel } from "@/components/creator/creator-studio-switcher";
import { NotificationBell } from "@/components/layout/notification-bell";
import { CREATOR_STUDIO_PROFILES_QUERY_KEY } from "@/lib/pricing";

export default function MusicCreatorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const { data: studioPayload } = useQuery({
    queryKey: [...CREATOR_STUDIO_PROFILES_QUERY_KEY],
    queryFn: () => fetch("/api/creator/studio-profiles").then((r) => r.json()),
    enabled: role === "MUSIC_CREATOR",
  });
  const showCompanyAdmin = Boolean(studioPayload?.companies?.length);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/8 bg-white/[0.03] px-6 py-4 backdrop-blur-xl md:px-12">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/music-creator/dashboard" className="text-xl font-semibold text-white">
            <span className="storytime-brand-text">STORY TIME</span> <span className="text-orange-200">Music</span>
          </Link>
          <div className="flex flex-wrap items-center gap-4 md:gap-6">
            <CreatorStudioActingLabel />
            <NotificationBell />
            {role === "MUSIC_CREATOR" ? (
              <Link
                href="/creator/company/control"
                className={`text-sm transition ${
                  pathname.startsWith("/creator/company/control")
                    ? "font-medium text-orange-300"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Account control
              </Link>
            ) : null}
            {showCompanyAdmin ? (
              <Link
                href="/music-creator/company"
                className={`text-sm transition ${
                  pathname.startsWith("/music-creator/company")
                    ? "font-medium text-orange-300"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Company admin
              </Link>
            ) : null}
            <Link href="/music-creator/dashboard" className="text-sm text-slate-400 hover:text-white transition">Dashboard</Link>
            <Link href="/music-creator/upload" className="text-sm text-slate-400 hover:text-white transition">Upload</Link>
            <Link href="/music-creator/sync-requests" className="text-sm text-slate-400 hover:text-white transition">Sync Requests</Link>
            <Link href="/music-creator/revenue" className="text-sm text-slate-400 hover:text-white transition">Revenue</Link>
            <Link href="/music-creator/messages" className="text-sm text-slate-400 hover:text-white transition">Messages</Link>
            <Link href="/music-creator/account" className="text-sm text-slate-400 hover:text-white transition">Account</Link>
            <Link href="/music-creator/originals" className="text-sm font-medium text-orange-300 hover:text-orange-200 transition">Originals</Link>
            <Link href="/browse" className="text-sm text-slate-400 hover:text-white transition">Browse</Link>
            <button onClick={handleSignOut} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-400 transition">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
