"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { NotificationBell } from "@/components/layout/notification-bell";

const navItems = [
  { href: "/casting-agency/dashboard", label: "Dashboard" },
  { href: "/casting-agency/inquiries", label: "Requests / Offers" },
  { href: "/casting-agency/invitations", label: "Casting invitations" },
  { href: "/casting-agency/contracts", label: "Contracts" },
  { href: "/casting-agency/talent", label: "Talent" },
  { href: "/casting-agency/profile", label: "Profile" },
  { href: "/browse", label: "View Platform" },
];

export default function CastingAgencyLayout({
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/8 bg-white/[0.03] px-6 py-4 backdrop-blur-xl md:px-12">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/casting-agency/dashboard" className="text-xl font-semibold text-white">
            <span className="storytime-brand-text">STORY TIME</span> Casting
          </Link>
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
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 flex gap-6">
        <aside className="w-56 shrink-0">
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

