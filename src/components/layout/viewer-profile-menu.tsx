"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  LogOut,
  Film,
  Music,
  LayoutDashboard,
  Settings,
  Clock,
  Download,
  Bookmark,
  CreditCard,
} from "lucide-react";
import { modalVariants } from "@/lib/motion/presets";
import { isOfflineDownloadEnabled } from "@/lib/platform/offline-downloads";

type ProfileMenuProps = {
  open: boolean;
  onClose: () => void;
  position: { top: number; right: number };
  session: {
    user?: { name?: string | null; email?: string | null; image?: string | null };
  };
  role?: string;
  activeProfile: { id: string; name: string; age: number } | null;
  onSignOut: () => void;
};

const subscriberLinks = [
  { href: "/profiles", label: "Profile", icon: User },
  { href: "/browse#continue-watching", label: "Continue Watching", icon: Clock },
  { href: "/browse/downloads", label: "Downloads", icon: Download },
  { href: "/browse/my-list", label: "My List", icon: Bookmark },
  { href: "/browse/settings", label: "Account & preferences", icon: Settings },
  { href: "/browse/account", label: "Subscription", icon: CreditCard },
] as const;

export function ViewerProfileMenu({
  open,
  onClose,
  position,
  session,
  role,
  activeProfile,
  onSignOut,
}: ProfileMenuProps) {
  const pathname = usePathname();
  const downloadsEnabled = isOfflineDownloadEnabled();
  const visibleSubscriberLinks = subscriberLinks.filter(
    (link) => link.href !== "/browse/downloads" || downloadsEnabled,
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[1200] bg-black/75 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="menu"
            className="fixed z-[1210] w-72 overflow-hidden rounded-2xl border border-white/14 bg-black py-1 shadow-2xl ring-1 ring-black/40"
            style={{ top: `${position.top}px`, right: `${position.right}px` }}
            variants={modalVariants()}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="border-b border-white/8 px-4 py-3.5">
              <p className="truncate font-semibold text-white">
                {role === "SUBSCRIBER" && activeProfile ? activeProfile.name : session.user?.name}
              </p>
              <p className="truncate text-sm text-slate-400">
                {role === "SUBSCRIBER" && activeProfile
                  ? `Profile · age ${activeProfile.age}`
                  : session.user?.email}
              </p>
            </div>

            <div className="py-1">
              {role === "SUBSCRIBER" &&
                visibleSubscriberLinks.map((link) => {
                  const Icon = link.icon;
                  const active = pathname === link.href || pathname.startsWith(link.href + "/");
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      role="menuitem"
                      onClick={onClose}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm transition ${
                        active
                          ? "bg-orange-500/10 text-orange-100"
                          : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-80" />
                      {link.label}
                    </Link>
                  );
                })}

              {role === "CONTENT_CREATOR" && (
                <Link
                  href="/creator/dashboard"
                  onClick={onClose}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white"
                >
                  <Film className="h-4 w-4" /> Creator Dashboard
                </Link>
              )}
              {role === "MUSIC_CREATOR" && (
                <Link
                  href="/music-creator/dashboard"
                  onClick={onClose}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white"
                >
                  <Music className="h-4 w-4" /> Music Dashboard
                </Link>
              )}
              {role === "ADMIN" && (
                <Link
                  href="/admin"
                  onClick={onClose}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white"
                >
                  <LayoutDashboard className="h-4 w-4" /> Admin
                </Link>
              )}
            </div>

            <div className="border-t border-white/8 py-1">
              <button
                type="button"
                role="menuitem"
                onClick={onSignOut}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
