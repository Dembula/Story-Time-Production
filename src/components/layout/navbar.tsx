"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { User, LogOut, Film, Music, LayoutDashboard, Settings, CreditCard, Wallet } from "lucide-react";
import { useState } from "react";
import { NotificationBell } from "@/components/layout/notification-bell";

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
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut({ callbackUrl: "/" });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800/80 backdrop-blur-xl bg-[#0c1222]/95 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-10">
        <Link href="/browse" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Story Time" width={36} height={36} className="rounded-lg" />
          <span className="text-lg font-semibold text-white">STORY TIME</span>
        </Link>
        <div className="hidden md:flex gap-8">
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
        {session && <NotificationBell />}

        {session ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2.5 p-2 hover:bg-slate-800/50 rounded-lg transition ml-2"
            >
              <User className="w-5 h-5 text-slate-400" />
              {session.user?.image ? (
                <img src={session.user.image} alt="" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-sm font-semibold text-orange-400">
                  {(session.user?.name || "?")[0]}
                </div>
              )}
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-slate-700 bg-[#0c1222] py-2 shadow-xl z-50">
                  <div className="px-4 py-3 border-b border-slate-700">
                    <p className="font-medium text-white truncate">{session.user?.name}</p>
                    <p className="text-sm text-slate-400 truncate">{session.user?.email}</p>
                  </div>
                  <Link href="/browse" className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white" onClick={() => setMenuOpen(false)}>
                    Browse
                  </Link>
                  <Link href="/browse/settings" className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white" onClick={() => setMenuOpen(false)}>
                    <Settings className="w-4 h-4" /> Settings
                  </Link>
                  {(session.user as { role?: string })?.role === "SUBSCRIBER" && (
                    <Link href="/profiles" className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white" onClick={() => setMenuOpen(false)}>
                      <User className="w-4 h-4" /> Who&apos;s watching?
                    </Link>
                  )}
                  <Link href="/browse/account" className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white" onClick={() => setMenuOpen(false)}>
                    <CreditCard className="w-4 h-4" /> My account
                  </Link>
                  <Link href="/browse/settings#payment" className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white" onClick={() => setMenuOpen(false)}>
                    <Wallet className="w-4 h-4" /> Payment methods
                  </Link>
                  {(session.user as { role?: string })?.role === "CONTENT_CREATOR" && (
                    <Link href="/creator/dashboard" className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white" onClick={() => setMenuOpen(false)}>
                      <Film className="w-4 h-4" /> Creator Dashboard
                    </Link>
                  )}
                  {(session.user as { role?: string })?.role === "MUSIC_CREATOR" && (
                    <Link href="/music-creator/dashboard" className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white" onClick={() => setMenuOpen(false)}>
                      <Music className="w-4 h-4" /> Music Dashboard
                    </Link>
                  )}
                  {(session.user as { role?: string })?.role === "ADMIN" && (
                    <Link href="/admin" className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white" onClick={() => setMenuOpen(false)}>
                      <LayoutDashboard className="w-4 h-4" /> Admin
                    </Link>
                  )}
                  <button onClick={handleSignOut} className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800/50 hover:text-white text-left">
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 ml-2">
            <Link href="/auth/signin" className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-lg transition">
              Sign In
            </Link>
            <Link href="/auth/signup" className="px-4 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition">
              Sign Up
            </Link>
            <Link href="/auth/creator/signin" className="px-4 py-2 text-sm font-medium text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded-lg transition border-l border-slate-700 pl-4">
              Creator
            </Link>
          </div>
        )}
      </div>

    </nav>
  );
}
