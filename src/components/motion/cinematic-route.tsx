"use client";

import { motion } from "framer-motion";
import { useMotion } from "./motion-provider";
import { pageVariants } from "@/lib/motion/presets";

/** Browse route shell — opacity + translate only (GPU). */
export function CinematicRoute({ children }: { children: React.ReactNode }) {
  const { intensity, prefersReducedMotion } = useMotion();

  if (prefersReducedMotion) {
    return <div className="cinematic-route">{children}</div>;
  }

  return (
    <motion.div
      className="cinematic-route"
      variants={pageVariants(intensity)}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}
