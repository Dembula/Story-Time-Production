"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Download, User } from "lucide-react";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";

const tabs = [
  { href: "/browse", label: "Home", icon: Home, match: (p: string) => p === "/browse" || p.startsWith("/browse/content") },
  { href: "/browse/search", label: "Search", icon: Search, match: (p: string) => p.startsWith("/browse/search") },
  { href: "/browse/downloads", label: "Downloads", icon: Download, match: (p: string) => p.startsWith("/browse/downloads") },
  { href: "/browse/settings", label: "Profile", icon: User, match: (p: string) => p.startsWith("/browse/settings") || p.startsWith("/browse/account") },
];

export function BrowseMobileNav() {
  const { deviceClass } = useAdaptiveUi();
  const pathname = usePathname();

  if (deviceClass !== "mobile") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#080c16]/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-xl md:hidden">
      <ul className="grid grid-cols-4 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.match(pathname);
          return (
            <li key={tab.label}>
              <Link
                href={tab.href}
                className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-medium transition ${
                  active ? "text-orange-300" : "text-slate-400"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-orange-300" : ""}`} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
