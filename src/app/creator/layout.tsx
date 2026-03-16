"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { NotificationBell } from "@/components/layout/notification-bell";

const primaryNavItems = [
  { href: "/creator/dashboard", label: "My Projects" },
  { href: "/creator/network", label: "Network" },
  { href: "/creator/revenue", label: "Analytics" },
  { href: "/creator/messages", label: "Messages" },
  { href: "/creator/originals/submit", label: "Originals", highlight: true },
];

export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#0c1222] text-slate-100">
      <div className="border-b border-slate-800 px-6 md:px-12 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition"
              aria-label={sidebarOpen ? "Hide menu" : "Show menu"}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
            <Link href="/creator/dashboard" className="text-xl font-semibold text-white">
              <span className="text-orange-500">STORY TIME</span> Creator
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              onClick={handleSignOut}
              className="hidden md:inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-400 transition"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 flex gap-6">
        {sidebarOpen && (
          <aside className="w-56 shrink-0">
            <nav className="space-y-1">
              {primaryNavItems.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "flex items-center px-3 py-2 rounded-lg text-sm transition",
                      isActive
                        ? "bg-slate-800 text-white"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/60",
                      item.highlight ? "font-medium text-orange-400 hover:text-orange-300" : "",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <div className="mt-3 border-t border-slate-800 pt-2 space-y-1">
                <p className="px-3 text-[11px] uppercase tracking-wide text-slate-500">
                  Pipeline
                </p>
                <Link
                  href="/creator/pre-production"
                  className={[
                    "flex items-center px-3 py-2 rounded-lg text-sm transition",
                    pathname.startsWith("/creator/pre-production")
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60",
                  ].join(" ")}
                >
                  Pre-Production
                </Link>
                <Link
                  href="/creator/production"
                  className={[
                    "flex items-center px-3 py-2 rounded-lg text-sm transition",
                    pathname.startsWith("/creator/production")
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60",
                  ].join(" ")}
                >
                  Production
                </Link>
                <Link
                  href="/creator/post-production"
                  className={[
                    "flex items-center px-3 py-2 rounded-lg text-sm transition",
                    pathname.startsWith("/creator/post-production")
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60",
                  ].join(" ")}
                >
                  Post-Production
                </Link>
              </div>

              <button
                onClick={handleSignOut}
                className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-slate-900/70 transition w-full text-left md:hidden"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </nav>
          </aside>
        )}

        <main className="flex-1 min-w-0">
          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 hover:text-white transition"
            >
              <PanelLeftOpen className="w-3 h-3" />
              Show menu
            </button>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
