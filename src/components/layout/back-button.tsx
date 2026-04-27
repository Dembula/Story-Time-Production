"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popStateRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      if (typeof window !== "undefined" && popStateRef.current) {
        window.removeEventListener("popstate", popStateRef.current);
        popStateRef.current = null;
      }
    };
  }, []);

  const handleBack = useCallback(() => {
    if (typeof window === "undefined") {
      router.push(fallback);
      return;
    }

    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (popStateRef.current) {
      window.removeEventListener("popstate", popStateRef.current);
      popStateRef.current = null;
    }

    const before = `${window.location.pathname}${window.location.search}`;

    const onPopState = () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      window.removeEventListener("popstate", onPopState);
      popStateRef.current = null;
    };
    popStateRef.current = onPopState;
    window.addEventListener("popstate", onPopState);

    router.back();

    fallbackTimerRef.current = setTimeout(() => {
      fallbackTimerRef.current = null;
      window.removeEventListener("popstate", onPopState);
      popStateRef.current = null;
      const after = `${window.location.pathname}${window.location.search}`;
      if (after === before) {
        router.push(fallback);
      }
    }, 500);
  }, [router, fallback]);

  return (
    <button
      type="button"
      onClick={handleBack}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/50 transition mb-4"
    >
      <ArrowLeft className="w-4 h-4" />
      Back
    </button>
  );
}
