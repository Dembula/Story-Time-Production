"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type DeviceClass = "mobile" | "tablet" | "desktop" | "tv";
export type DeviceBreakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
export type InputMode = "touch" | "mouse" | "remote";
export type OrientationMode = "portrait" | "landscape";

type AdaptiveState = {
  width: number;
  deviceClass: DeviceClass;
  breakpoint: DeviceBreakpoint;
  inputMode: InputMode;
  orientation: OrientationMode;
  isTouchLike: boolean;
};

const AdaptiveUiContext = createContext<AdaptiveState | null>(null);

function breakpointFromWidth(width: number): DeviceBreakpoint {
  if (width <= 480) return "xs";
  if (width <= 768) return "sm";
  if (width <= 1024) return "md";
  if (width <= 1440) return "lg";
  if (width <= 1920) return "xl";
  return "xxl";
}

function isLikelyTv(width: number, ua: string): boolean {
  const tvUa = /(smart-tv|smarttv|hbbtv|googletv|appletv|netcast|viera|tizen|webos|roku|aftt|xbox|playstation)/i;
  return width >= 1921 || tvUa.test(ua);
}

function classFromBreakpoint(bp: DeviceBreakpoint): DeviceClass {
  if (bp === "xs" || bp === "sm") return "mobile";
  if (bp === "md") return "tablet";
  if (bp === "xxl") return "tv";
  return "desktop";
}

function getInputMode(bp: DeviceBreakpoint, width: number, ua: string): InputMode {
  if (isLikelyTv(width, ua)) return "remote";
  const coarse = typeof window.matchMedia === "function" ? window.matchMedia("(pointer: coarse)").matches : false;
  if (coarse && (bp === "xs" || bp === "sm" || bp === "md")) return "touch";
  return "mouse";
}

function computeAdaptiveState(): AdaptiveState {
  const width = window.innerWidth;
  const bp = breakpointFromWidth(width);
  const ua = navigator.userAgent ?? "";
  const deviceClass = isLikelyTv(width, ua) ? "tv" : classFromBreakpoint(bp);
  const inputMode = getInputMode(bp, width, ua);
  const orientation: OrientationMode = window.innerHeight >= window.innerWidth ? "portrait" : "landscape";
  return {
    width,
    breakpoint: bp,
    deviceClass,
    inputMode,
    orientation,
    isTouchLike: inputMode === "touch" || inputMode === "remote",
  };
}

export function AdaptiveUiProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdaptiveState>({
    width: 1366,
    breakpoint: "lg",
    deviceClass: "desktop",
    inputMode: "mouse",
    orientation: "landscape",
    isTouchLike: false,
  });

  useEffect(() => {
    const update = () => {
      try {
        setState(computeAdaptiveState());
      } catch {
        // Keep last known safe state if a browser/webview lacks a required API.
      }
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.dataset.deviceClass = state.deviceClass;
    html.dataset.breakpoint = state.breakpoint;
    html.dataset.inputMode = state.inputMode;
    html.dataset.orientation = state.orientation;
  }, [state]);

  useEffect(() => {
    if (state.inputMode !== "remote") return;

    const isEditableTarget = (el: HTMLElement | null) => {
      if (!el) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      return el.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) return;

      const active = document.activeElement as HTMLElement | null;
      if (isEditableTarget(active)) return;

      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => {
        const style = window.getComputedStyle(el);
        const visible = style.visibility !== "hidden" && style.display !== "none";
        return visible && el.offsetParent !== null;
      });

      if (nodes.length === 0) return;
      const currentIndex = active ? nodes.indexOf(active) : -1;
      const forward = key === "ArrowRight" || key === "ArrowDown";
      let nextIndex = currentIndex;
      if (nextIndex === -1) nextIndex = 0;
      else nextIndex = forward ? Math.min(nodes.length - 1, nextIndex + 1) : Math.max(0, nextIndex - 1);
      const next = nodes[nextIndex];
      if (!next) return;

      event.preventDefault();
      next.focus();
      next.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.inputMode]);

  const value = useMemo(() => state, [state]);
  return <AdaptiveUiContext.Provider value={value}>{children}</AdaptiveUiContext.Provider>;
}

export function useAdaptiveUi() {
  const ctx = useContext(AdaptiveUiContext);
  if (!ctx) {
    throw new Error("useAdaptiveUi must be used inside AdaptiveUiProvider");
  }
  return ctx;
}

