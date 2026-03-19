"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function MusicCreatorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

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
          <div className="flex items-center gap-6">
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
