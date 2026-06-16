"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useMotion } from "./motion-provider";
import { pageVariants } from "@/lib/motion/presets";
import { consumeSkipRouteEnterAnimation } from "@/lib/navigation/route-transition";

/** Browse route shell — opacity + translate only (GPU). */
export function CinematicRoute({ children }: { children: React.ReactNode }) {
  const { intensity, prefersReducedMotion } = useMotion();
  const [skipEnter] = useState(() => consumeSkipRouteEnterAnimation());

  if (prefersReducedMotion) {
    return <div className="cinematic-route">{children}</div>;
  }

  return (
    <motion.div
      className="cinematic-route"
      variants={pageVariants(intensity)}
      initial={skipEnter ? false : "initial"}
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}
