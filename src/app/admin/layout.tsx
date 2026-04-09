"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { NotificationBell } from "@/components/layout/notification-bell";

const navSections: { title: string; items: { href: string; label: string; highlight?: boolean }[] }[] = [
  {
    title: "Operations",
    items: [
      { href: "/admin", label: "Overview" },
      { href: "/admin/review", label: "Review hub" },
      { href: "/admin/projects", label: "Projects" },
    ],
  },
  {
    title: "Catalogue & rights",
    items: [
      { href: "/admin/content", label: "Content" },
      { href: "/admin/originals", label: "Originals", highlight: true },
      { href: "/admin/music", label: "Music" },
    ],
  },
  {
    title: "Marketplace",
    items: [
      { href: "/admin/crew", label: "Crew" },
      { href: "/admin/cast", label: "Cast" },
      { href: "/admin/locations", label: "Locations" },
    ],
  },
  {
    title: "Platform",
    items: [
      { href: "/admin/creators", label: "Creators" },
      { href: "/admin/requests", label: "Requests" },
      { href: "/admin/revenue", label: "Revenue" },
      { href: "/admin/activity", label: "Activity" },
      { href: "/admin/competition", label: "Competition" },
      { href: "/browse", label: "View site" },
    ],
  },
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
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(249,115,22,0.02)_100%)]" />
      <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />

      <header className="relative border-b border-white/8 bg-white/[0.03] px-6 py-4 backdrop-blur-xl md:px-12">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/admin" className="text-xl font-semibold tracking-tight text-white">
            <span className="storytime-brand-text">STORY TIME</span> Admin
          </Link>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              onClick={handleSignOut}
              className="hidden transition md:inline-flex md:items-center md:gap-1.5 md:text-slate-400 md:hover:text-red-400"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="relative mx-auto flex max-w-7xl gap-6 px-4 py-6 md:px-8">
        <aside className="w-56 shrink-0 md:w-60">
          <nav className="space-y-5 text-sm">
            {navSections.map((section) => (
              <div key={section.title}>
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {section.title}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active =
                      item.href === "/admin"
                        ? pathname === "/admin"
                        : item.href === "/browse"
                          ? pathname === "/browse" || pathname.startsWith("/browse/")
                          : pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={[
                          "flex items-center rounded-lg px-3 py-2 transition",
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
                </div>
              </div>
            ))}
            <button
              onClick={handleSignOut}
              className="mt-2 flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-sm text-slate-400 transition hover:bg-slate-900/70 hover:text-red-400 md:hidden"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
