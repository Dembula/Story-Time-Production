"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { User, LogOut, Film, Music, LayoutDashboard, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";

const CONTENT_TYPES = [
  { label: "Movies", value: "MOVIE" },
  { label: "Series", value: "SERIES" },
  { label: "Shows", value: "SHOW" },
  { label: "Podcasts", value: "PODCAST" },
  { label: "Student Films", value: "AFDA" },
  { label: "Music Library", value: "MUSIC" },
];

export function Navbar() {
  const { data: session } = useSession();
  const { deviceClass } = useAdaptiveUi();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeProfile, setActiveProfile] = useState<{ id: string; name: string; age: number } | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (role !== "SUBSCRIBER") {
      setActiveProfile(null);
      return;
    }

    fetch("/api/viewer/profiles/active")
      .then((r) => r.json())
      .then((data) => setActiveProfile(data?.profile ?? null))
      .catch(() => setActiveProfile(null));
  }, [session]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut({ callbackUrl: "/" });
  };

  const compactNav = deviceClass === "mobile";
  const tvMode = deviceClass === "tv";

  return (
    <nav
      className={[
        "fixed top-0 left-0 right-0 z-50 adaptive-tv-surface flex items-center justify-between transition-all duration-200",
        compactNav ? "px-3 py-2" : "px-4 sm:px-6 py-3",
        scrolled
          ? "border-b border-white/10 bg-[#080c16]/92 shadow-panel backdrop-blur-2xl"
          : "border-b border-white/6 bg-[#080c16]/58 backdrop-blur-xl",
      ].join(" ")}
    >
      <div className="flex items-center gap-3 sm:gap-8">
        <Link href="/browse" className="flex items-center gap-3">
          <Image src="/logo.png" alt="Story Time" width={compactNav ? 32 : 40} height={compactNav ? 32 : 40} className="rounded-xl shadow-glow" />
          <span className={`${tvMode ? "text-2xl" : "text-lg"} font-semibold tracking-[0.14em] text-white`}>STORY <span className="storytime-brand-text">TIME</span></span>
        </Link>
        <div className={`${compactNav ? "hidden" : "hidden md:flex"} gap-5 xl:gap-8`}>
          <Link href="/browse" className="text-sm text-slate-300 hover:text-white transition font-medium">
            Home
          </Link>
          {CONTENT_TYPES.map((t) => (
            <Link
              key={t.value}
              href={t.value === "AFDA" ? "/browse?filter=afda" : t.value === "MUSIC" ? "/browse?filter=music" : `/browse?type=${t.value}`}
              className="text-sm text-slate-300 hover:text-white transition font-medium"
            >
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {compactNav && (
          <button
            type="button"
            onClick={() => setNavOpen((v) => !v)}
            className="adaptive-interactive rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-slate-200"
            aria-label="Toggle navigation"
            aria-expanded={navOpen}
          >
            Menu
          </button>
        )}
        {session && <NotificationBell />}

        {session ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="adaptive-interactive ml-2 flex items-center gap-2.5 rounded-xl border border-white/6 bg-white/[0.03] p-2 hover:border-white/12 hover:bg-white/[0.05]"
            >
              <User className="w-5 h-5 text-slate-400" />
              {session.user?.image ? (
                <img src={session.user.image} alt="" className="h-8 w-8 rounded-full ring-1 ring-white/15" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/18 text-sm font-semibold text-orange-300 ring-1 ring-orange-400/20">
                  {(session.user?.name || "?")[0]}
                </div>
              )}
              {(session.user as { role?: string })?.role === "SUBSCRIBER" && activeProfile ? (
                <span className="hidden max-w-[8rem] truncate text-sm font-medium text-white md:inline">
                  {activeProfile.name}
                </span>
              ) : null}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="storytime-panel absolute right-0 top-full z-50 mt-3 w-56 rounded-2xl py-2">
                  <div className="border-b border-white/8 px-4 py-3">
                    <p className="font-medium text-white truncate">
                      {(session.user as { role?: string })?.role === "SUBSCRIBER" && activeProfile
                        ? activeProfile.name
                        : session.user?.name}
                    </p>
                    <p className="text-sm text-slate-400 truncate">
                      {(session.user as { role?: string })?.role === "SUBSCRIBER" && activeProfile
                        ? `Profile age ${activeProfile.age}`
                        : session.user?.email}
                    </p>
                    {(session.user as { role?: string })?.role === "SUBSCRIBER" && activeProfile ? (
                      <p className="mt-1 truncate text-xs text-slate-500">Account: {session.user?.email}</p>
                    ) : null}
                  </div>
                  <Link href="/browse" className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white" onClick={() => setMenuOpen(false)}>
                    Browse
                  </Link>
                  <Link href="/browse/settings" className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white" onClick={() => setMenuOpen(false)}>
                    <Settings className="w-4 h-4" /> Settings
                  </Link>
                  {(session.user as { role?: string })?.role === "SUBSCRIBER" && (
                    <Link href="/profiles" className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white" onClick={() => setMenuOpen(false)}>
                      <User className="w-4 h-4" /> Who&apos;s watching?
                    </Link>
                  )}
                  {(session.user as { role?: string })?.role === "CONTENT_CREATOR" && (
                    <Link href="/creator/dashboard" className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white" onClick={() => setMenuOpen(false)}>
                      <Film className="w-4 h-4" /> Creator Dashboard
                    </Link>
                  )}
                  {(session.user as { role?: string })?.role === "MUSIC_CREATOR" && (
                    <Link href="/music-creator/dashboard" className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white" onClick={() => setMenuOpen(false)}>
                      <Music className="w-4 h-4" /> Music Dashboard
                    </Link>
                  )}
                  {(session.user as { role?: string })?.role === "ADMIN" && (
                    <Link href="/admin" className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white" onClick={() => setMenuOpen(false)}>
                      <LayoutDashboard className="w-4 h-4" /> Admin
                    </Link>
                  )}
                  <button onClick={handleSignOut} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white">
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 ml-2">
            <Link href="/auth/signin" className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/[0.05] hover:text-white">
              Sign In
            </Link>
            <Link href="/auth/signup" className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400">
              Sign Up
            </Link>
            <Link href="/auth/creator/signin" className="border-l border-white/8 pl-4 text-sm font-medium text-orange-300 hover:text-orange-200">
              Creator
            </Link>
          </div>
        )}
      </div>

      {compactNav && navOpen && (
        <div className="absolute left-0 right-0 top-full border-b border-white/10 bg-[#080c16]/95 px-3 py-2 backdrop-blur-xl">
          <div className="grid grid-cols-2 gap-1">
            <Link href="/browse" className="adaptive-interactive rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.05]" onClick={() => setNavOpen(false)}>
              Home
            </Link>
            {CONTENT_TYPES.map((t) => (
              <Link
                key={t.value}
                href={t.value === "AFDA" ? "/browse?filter=afda" : t.value === "MUSIC" ? "/browse?filter=music" : `/browse?type=${t.value}`}
                className="adaptive-interactive rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.05] hover:text-white"
                onClick={() => setNavOpen(false)}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      )}

    </nav>
  );
}
