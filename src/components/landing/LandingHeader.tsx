"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [authMenuOpen, setAuthMenuOpen] = useState<"signin" | "signup" | null>(null);
  const authMenuRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    type LegacyMediaQueryList = MediaQueryList & {
      addListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void) => void;
    };
    const mediaQuery = typeof window.matchMedia === "function" ? window.matchMedia("(orientation: portrait)") : null;
    const legacyMediaQuery = mediaQuery as LegacyMediaQueryList | null;
    const updateMode = () => {
      const portrait = mediaQuery ? mediaQuery.matches : window.innerHeight >= window.innerWidth;
      setIsPortraitMobile(window.innerWidth < 768 && portrait);
      setAuthMenuOpen(null);
    };
    updateMode();
    if (mediaQuery && "addEventListener" in mediaQuery) {
      mediaQuery.addEventListener("change", updateMode);
    } else if (legacyMediaQuery?.addListener) {
      legacyMediaQuery.addListener(updateMode);
    }
    window.addEventListener("resize", updateMode);
    return () => {
      if (mediaQuery && "removeEventListener" in mediaQuery) {
        mediaQuery.removeEventListener("change", updateMode);
      } else if (legacyMediaQuery?.removeListener) {
        legacyMediaQuery.removeListener(updateMode);
      }
      window.removeEventListener("resize", updateMode);
    };
  }, []);

  useEffect(() => {
    if (!authMenuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!authMenuRef.current?.contains(event.target as Node)) {
        setAuthMenuOpen(null);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [authMenuOpen]);

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-50 transition-all duration-200",
        scrolled
          ? "border-b border-white/10 bg-[#080c16]/92 shadow-panel backdrop-blur-2xl"
          : "border-b border-white/6 bg-[#080c16]/58 backdrop-blur-xl",
      ].join(" ")}
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 sm:py-3 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/logo.png" alt="Story Time" width={40} height={40} className="rounded-xl shadow-glow" />
          <span className="text-sm sm:text-lg font-semibold tracking-[0.12em] sm:tracking-[0.14em] text-white">STORY <span className="storytime-brand-text">TIME</span></span>
        </Link>
        <nav ref={authMenuRef} className="relative flex items-center gap-1 sm:gap-2">
          {isPortraitMobile ? (
            <>
              <button
                type="button"
                onClick={() => setAuthMenuOpen((prev) => (prev === "signin" ? null : "signin"))}
                className="rounded-xl px-2.5 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.05] hover:text-white"
                aria-expanded={authMenuOpen === "signin"}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setAuthMenuOpen((prev) => (prev === "signup" ? null : "signup"))}
                className="rounded-xl px-2.5 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.05] hover:text-white"
                aria-expanded={authMenuOpen === "signup"}
              >
                Sign Up
              </button>

              {authMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-white/10 bg-[#0b1324]/96 p-1.5 shadow-panel backdrop-blur-xl">
                  {authMenuOpen === "signin" ? (
                    <>
                      <Link
                        href="/auth/signin"
                        className="block rounded-lg px-3 py-2 text-xs text-slate-200 hover:bg-white/[0.06]"
                        onClick={() => setAuthMenuOpen(null)}
                      >
                        Sign In
                      </Link>
                      <Link
                        href="/auth/creator/signin"
                        className="block rounded-lg px-3 py-2 text-xs text-orange-300 hover:bg-orange-500/10"
                        onClick={() => setAuthMenuOpen(null)}
                      >
                        Creator Sign In
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/auth/signup"
                        className="block rounded-lg px-3 py-2 text-xs text-slate-200 hover:bg-white/[0.06]"
                        onClick={() => setAuthMenuOpen(null)}
                      >
                        Sign Up
                      </Link>
                      <Link
                        href="/auth/creator/signup"
                        className="block rounded-lg px-3 py-2 text-xs text-orange-300 hover:bg-orange-500/10"
                        onClick={() => setAuthMenuOpen(null)}
                      >
                        Creator Sign Up
                      </Link>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <Link href="/auth/signin" className="rounded-xl px-2.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium text-slate-300 hover:bg-white/[0.05] hover:text-white">
                Sign In
              </Link>
              <Link href="/auth/signup" className="rounded-xl px-2.5 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-medium text-slate-300 hover:bg-white/[0.05] hover:text-white">
                Sign Up
              </Link>
              <span className="mx-1 hidden md:block h-5 w-px bg-white/10" />
              <Link href="/auth/creator/signin" className="hidden md:inline-flex rounded-xl px-4 py-2.5 text-sm font-medium text-orange-300 hover:bg-orange-500/10 hover:text-orange-200">
                Creator Sign In
              </Link>
              <Link href="/auth/creator/signup" className="hidden md:inline-flex rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow hover:-translate-y-0.5 hover:bg-orange-400">
                Creator Sign Up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
