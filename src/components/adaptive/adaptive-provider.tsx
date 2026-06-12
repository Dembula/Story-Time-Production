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
  const tvUa =
    /(smart-tv|smarttv|hbbtv|googletv|appletv|netcast|viera|tizen|webos|web0s|roku|aftt|xbox|playstation|bravia|firetv|fire tv|crkey|chromecast|freebox|nettv|philips|sharp|sony|tv safari)/i;
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

    const fine = window.matchMedia("(pointer: fine)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    html.dataset.pointerFine = fine ? "true" : "false";
    html.dataset.pointerCoarse = coarse ? "true" : "false";
  }, [state]);

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

