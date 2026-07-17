"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { User, Search, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ViewerProfileMenu } from "@/components/layout/viewer-profile-menu";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
import {
  VIEWER_NAV_CATEGORIES,
  VIEWER_NAV_MORE_CATEGORIES,
} from "@/lib/content-types";

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { deviceClass } = useAdaptiveUi();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeProfile, setActiveProfile] = useState<{ id: string; name: string; age: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [menuPanelPos, setMenuPanelPos] = useState({ top: 72, right: 16 });
  const [menuButtonEl, setMenuButtonEl] = useState<HTMLButtonElement | null>(null);
  const [browseQuery, setBrowseQuery] = useState("");
  const moreRef = useRef<HTMLDivElement>(null);

  const role = (session?.user as { role?: string } | undefined)?.role;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const syncQuery = () => setBrowseQuery(window.location.search);
    syncQuery();
    window.addEventListener("popstate", syncQuery);
    return () => window.removeEventListener("popstate", syncQuery);
  }, [pathname]);

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

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut({ callbackUrl: "/" });
  };

  const compactNav = deviceClass === "mobile";
  const tvMode = deviceClass === "tv";
  const params = new URLSearchParams(browseQuery);
  const currentType = params.get("type");
  const currentFilter = params.get("filter");
  const moreActive = VIEWER_NAV_MORE_CATEGORIES.some((item) =>
    item.href.includes("filter=")
      ? currentFilter === "afda"
      : currentType === item.value,
  );

  if (pathname.includes("/watch")) return null;

  function navLinkClass(href: string) {
    const active =
      href === "/browse"
        ? pathname === "/browse" && !currentType && !currentFilter
        : href.includes("filter=")
          ? currentFilter === "afda" && pathname.startsWith("/browse")
          : href.includes("type=")
            ? currentType === href.split("type=")[1] && pathname.startsWith("/browse")
            : pathname.includes(href.split("?")[1] ?? href);
    return [
      "relative text-sm font-medium transition whitespace-nowrap",
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
      <div className="flex min-w-0 items-center gap-3 sm:gap-6 xl:gap-8">
        <Link href="/browse" className="flex shrink-0 items-center gap-3">
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
        <div className={`${compactNav ? "hidden" : "hidden lg:flex"} items-center gap-4 xl:gap-6`}>
          <Link href="/browse" className={`${navLinkClass("/browse")} adaptive-interactive rounded-md px-1`}>
            Home
          </Link>
          {VIEWER_NAV_CATEGORIES.map((t) => (
            <Link
              key={t.value}
              href={t.href}
              onClick={() => setBrowseQuery(t.href.includes("?") ? `?${t.href.split("?")[1]}` : "")}
              className={`${navLinkClass(t.href)} adaptive-interactive rounded-md px-1`}
            >
              {t.label}
            </Link>
          ))}
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              className={[
                "adaptive-interactive inline-flex items-center gap-1 rounded-md px-1 text-sm font-medium transition whitespace-nowrap",
                moreOpen || moreActive ? "text-white" : "text-slate-300 hover:text-white",
              ].join(" ")}
            >
              More
              <ChevronDown className={`h-3.5 w-3.5 transition ${moreOpen ? "rotate-180" : ""}`} />
            </button>
            {moreOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full z-50 mt-3 min-w-[12.5rem] rounded-2xl border border-white/12 bg-black/95 p-2 shadow-[0_16px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl"
              >
                {VIEWER_NAV_MORE_CATEGORIES.map((item) => (
                  <Link
                    key={item.value}
                    href={item.href}
                    role="menuitem"
                    onClick={() => {
                      setMoreOpen(false);
                      setBrowseQuery(item.href.includes("?") ? `?${item.href.split("?")[1]}` : "");
                    }}
                    className={[
                      "block rounded-xl px-3 py-2 text-sm transition",
                      (item.href.includes("filter=")
                        ? currentFilter === "afda"
                        : currentType === item.value)
                        ? "bg-white/[0.08] text-white"
                        : "text-slate-300 hover:bg-white/[0.06] hover:text-white",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!compactNav && (
          <Link
            href="/browse/search"
            className={`hidden md:inline-flex adaptive-interactive items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium transition hover:border-white/16 hover:bg-white/[0.07] ${
              pathname.startsWith("/browse/search") ? "text-white" : "text-slate-300 hover:text-white"
            }`}
          >
            <Search className="h-4 w-4" />
            Search
          </Link>
        )}
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
