"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

const navItems = [
  { href: "/equipment-company/dashboard", label: "Dashboard" },
  { href: "/equipment-company/requests", label: "Requests / Offers" },
  { href: "/equipment-company/listings", label: "My Listings" },
  { href: "/equipment-company/messages", label: "Messages" },
  { href: "/equipment-company/account", label: "Account" },
];

export default function EquipmentCompanyLayout({
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
    <div className="min-h-screen bg-[#0c1222]">
      <header className="border-b border-slate-800 px-6 md:px-12 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/equipment-company/dashboard" className="text-xl font-semibold text-white">
            <span className="text-orange-500">STORY TIME</span> Equipment
          </Link>
          <button
            onClick={handleSignOut}
            className="hidden md:inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-400 transition"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
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
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60",
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

