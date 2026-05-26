"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAdaptiveUi } from "@/components/adaptive/adaptive-provider";
import { resolveMotionIntensity } from "@/lib/motion/intensity";
import type { MotionIntensity } from "@/lib/motion/tokens";

type MotionContextValue = {
  intensity: MotionIntensity;
  prefersReducedMotion: boolean;
};

const MotionContext = createContext<MotionContextValue>({
  intensity: "standard",
  prefersReducedMotion: false,
});

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const { deviceClass } = useAdaptiveUi();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const onChange = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const value = useMemo(
    () => ({
      intensity: resolveMotionIntensity({ deviceClass, prefersReducedMotion }),
      prefersReducedMotion,
    }),
    [deviceClass, prefersReducedMotion],
  );

  return <MotionContext.Provider value={value}>{children}</MotionContext.Provider>;
}

export function useMotion() {
  return useContext(MotionContext);
}
