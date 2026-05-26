"use client";

import { motion } from "framer-motion";
import { useMotion } from "./motion-provider";
import { staggerContainerVariants, staggerItemVariants } from "@/lib/motion/presets";

export function StaggerReveal({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "ul";
}) {
  const { intensity, prefersReducedMotion } = useMotion();
  const Component = motion[Tag];

  if (prefersReducedMotion) {
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <Component
      className={className}
      variants={staggerContainerVariants(intensity)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
    >
      {children}
    </Component>
  );
}

export function StaggerItem({
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
    <motion.div className={className} variants={staggerItemVariants(intensity)}>
      {children}
    </motion.div>
  );
}
