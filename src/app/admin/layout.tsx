"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { NotificationBell } from "@/components/layout/notification-bell";

const navItems = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/projects", label: "Projects & Pipeline" },
  { href: "/admin/creators", label: "Creators & Network" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/requests", label: "Requests & Reviews" },
  { href: "/admin/revenue", label: "Revenue & Reporting" },
  { href: "/admin/crew", label: "Crew" },
  { href: "/admin/cast", label: "Cast" },
  { href: "/admin/music", label: "Music" },
  { href: "/admin/locations", label: "Locations" },
  { href: "/admin/originals", label: "Originals", highlight: true },
  { href: "/admin/activity", label: "Activity" },
  { href: "/admin/competition", label: "Competition" },
  { href: "/browse", label: "View Site" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(249,115,22,0.02)_100%)] pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />

      <header className="relative border-b border-white/8 bg-white/[0.03] px-6 py-4 backdrop-blur-xl md:px-12">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/admin" className="text-xl font-semibold text-white tracking-tight">
            <span className="storytime-brand-text">STORY TIME</span> Admin
          </Link>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              onClick={handleSignOut}
              className="hidden md:inline-flex items-center gap-1.5 text-slate-400 hover:text-red-400 transition"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-6 flex gap-6">
        <aside className="w-60 shrink-0">
          <nav className="space-y-1 text-sm">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "flex items-center px-3 py-2 rounded-lg transition",
                    active
                      ? "bg-white/[0.08] text-white shadow-panel"
                      : "text-slate-400 hover:bg-white/[0.05] hover:text-white",
                    item.highlight ? "font-medium text-orange-400 hover:text-orange-300" : "",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={handleSignOut}
              className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-slate-900/70 transition w-full text-left md:hidden"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </nav>
        </aside>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

