"use client";

import { motion } from "framer-motion";
import { useMotion } from "./motion-provider";
import { hoverPhysicsProps } from "@/lib/motion/presets";

export function HoverPhysics({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { intensity, prefersReducedMotion } = useMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div className={className} {...hoverPhysicsProps(intensity)}>
      {children}
    </motion.div>
  );
}
