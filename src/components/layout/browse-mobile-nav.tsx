"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Download, User } from "lucide-react";
import { motion } from "framer-motion";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
import { useMotion } from "@/components/motion/motion-provider";
import { viewerSprings } from "@/lib/motion/viewer-presets";

const tabs = [
  { href: "/browse", label: "Home", icon: Home, match: (p: string) => p === "/browse" || p.startsWith("/browse/content") },
  { href: "/browse/search", label: "Search", icon: Search, match: (p: string) => p.startsWith("/browse/search") },
  { href: "/browse/downloads", label: "Downloads", icon: Download, match: (p: string) => p.startsWith("/browse/downloads") },
  { href: "/browse/settings", label: "Profile", icon: User, match: (p: string) => p.startsWith("/browse/settings") || p.startsWith("/browse/account") },
];

export function BrowseMobileNav() {
  const { deviceClass } = useAdaptiveUi();
  const { prefersReducedMotion } = useMotion();
  const pathname = usePathname();

  if (deviceClass !== "mobile") return null;

  return (
    <motion.nav
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...viewerSprings.sheet, delay: 0.08 }}
      className="browse-mobile-nav fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/94 px-2 pb-[max(env(safe-area-inset-bottom),0.45rem)] pt-2 backdrop-blur-2xl md:hidden"
    >
      <ul className="grid grid-cols-4 gap-1 rounded-2xl border border-white/10 bg-black/80 p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.55)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.match(pathname);
          return (
            <li key={tab.label}>
              <Link
                href={tab.href}
                className={`viewer-motion-surface relative flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-medium ${
                  active ? "text-orange-200" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {active && !prefersReducedMotion ? (
                  <motion.span
                    layoutId="viewer-mobile-nav-active"
                    className="absolute inset-0 rounded-xl border border-orange-300/25 bg-orange-500/15 shadow-[0_6px_18px_rgba(251,146,60,0.25)]"
                    transition={viewerSprings.nav}
                  />
                ) : active ? (
                  <span className="absolute inset-0 rounded-xl border border-orange-300/25 bg-orange-500/15 shadow-[0_6px_18px_rgba(251,146,60,0.25)]" />
                ) : null}
                <Icon className={`relative z-[1] h-5 w-5 transition-colors ${active ? "text-orange-200" : "text-slate-400"}`} />
                <span className="relative z-[1]">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </motion.nav>
  );
}
