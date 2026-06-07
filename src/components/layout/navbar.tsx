"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { User } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ViewerProfileMenu } from "@/components/layout/viewer-profile-menu";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";

const CONTENT_TYPES = [
  { label: "Movies", value: "MOVIE", href: "/browse?type=MOVIE" },
  { label: "Series", value: "SERIES", href: "/browse?type=SERIES" },
  { label: "Shows", value: "SHOW", href: "/browse?type=SHOW" },
  { label: "Podcasts", value: "PODCAST", href: "/browse?type=PODCAST" },
  { label: "Student Films", value: "AFDA", href: "/browse?filter=afda" },
  { label: "Music Library", value: "MUSIC", href: "/browse?filter=music" },
];

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { deviceClass } = useAdaptiveUi();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeProfile, setActiveProfile] = useState<{ id: string; name: string; age: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [menuPanelPos, setMenuPanelPos] = useState({ top: 72, right: 16 });
  const [menuButtonEl, setMenuButtonEl] = useState<HTMLButtonElement | null>(null);

  const role = (session?.user as { role?: string } | undefined)?.role;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (role !== "SUBSCRIBER") {
      setActiveProfile(null);
      return;
    }
    fetch("/api/viewer/profiles/active")
      .then((r) => r.json())
      .then((data) => setActiveProfile(data?.profile ?? null))
      .catch(() => setActiveProfile(null));
  }, [role]);

  useEffect(() => {
    if (!menuOpen || !menuButtonEl) return;
    const syncPos = () => {
      const rect = menuButtonEl.getBoundingClientRect();
      setMenuPanelPos({
        top: Math.round(rect.bottom + 10),
        right: Math.max(8, Math.round(window.innerWidth - rect.right)),
      });
    };
    syncPos();
    window.addEventListener("resize", syncPos);
    window.addEventListener("scroll", syncPos, true);
    return () => {
      window.removeEventListener("resize", syncPos);
      window.removeEventListener("scroll", syncPos, true);
    };
  }, [menuOpen, menuButtonEl]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut({ callbackUrl: "/" });
  };

  const compactNav = deviceClass === "mobile";
  const tvMode = deviceClass === "tv";

  function navLinkClass(href: string) {
    const active =
      href === "/browse"
        ? pathname === "/browse"
        : pathname.includes(href.split("?")[1] ?? href);
    return [
      "relative text-sm font-medium transition",
      active ? "text-white" : "text-slate-300 hover:text-white",
    ].join(" ");
  }

  return (
    <nav
      className={[
        "fixed top-0 left-0 right-0 z-50 flex items-center justify-between transition-[background,box-shadow,border-color] duration-300",
        compactNav ? "px-3 py-2.5" : "px-4 py-3 sm:px-6",
        scrolled
          ? "border-b border-white/12 bg-black/94 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-2xl"
          : "border-b border-transparent bg-gradient-to-b from-black/88 to-transparent backdrop-blur-md",
      ].join(" ")}
    >
      <div className="flex items-center gap-3 sm:gap-8">
        <Link href="/browse" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Story Time"
            width={compactNav ? 32 : 40}
            height={compactNav ? 32 : 40}
            className="rounded-xl shadow-glow"
          />
          <span className={`${tvMode ? "text-2xl" : "text-lg"} font-semibold tracking-[0.14em] text-white`}>
            STORY <span className="storytime-brand-text">TIME</span>
          </span>
        </Link>
        <div className={`${compactNav ? "hidden" : "hidden md:flex"} gap-6 xl:gap-7`}>
          <Link href="/browse" className={navLinkClass("/browse")}>
            Home
          </Link>
          {CONTENT_TYPES.map((t) => (
            <Link key={t.value} href={t.href} className={navLinkClass(t.href)}>
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
              ref={setMenuButtonEl}
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="ml-1 flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.04] p-1.5 pl-2.5 transition hover:border-white/14 hover:bg-white/[0.07]"
            >
              {session.user?.image ? (
                <Image
                  src={session.user.image}
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full ring-1 ring-white/15"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/18 text-sm font-semibold text-orange-300">
                  {(session.user?.name || "?")[0]}
                </div>
              )}
              {role === "SUBSCRIBER" && activeProfile ? (
                <span className="hidden max-w-[7rem] truncate text-sm font-medium text-white md:inline">
                  {activeProfile.name}
                </span>
              ) : (
                <User className="hidden h-4 w-4 text-slate-400 md:block" />
              )}
            </button>
            {mounted && (
              <ViewerProfileMenu
                open={menuOpen}
                onClose={() => setMenuOpen(false)}
                position={menuPanelPos}
                session={session}
                role={role}
                activeProfile={activeProfile}
                onSignOut={handleSignOut}
              />
            )}
          </div>
        ) : (
          <div className="ml-2 flex items-center gap-2">
            <Link href="/auth/signin" className="rounded-xl px-3 py-2 text-sm font-medium text-slate-300 hover:text-white">
              Sign In
            </Link>
            <Link href="/auth/signup" className="rounded-xl viewer-btn-primary px-4 py-2 text-sm font-semibold">
              Sign Up
            </Link>
          </div>
        )}
      </div>

    </nav>
  );
}
