import type { Transition, Variants } from "framer-motion";
import { motionDurations, motionEasings, motionSprings, motionStagger } from "./tokens";
import type { MotionIntensity } from "./tokens";

function scaleDuration(base: number, intensity: MotionIntensity): number {
  if (intensity === "minimal") return base * 0.65;
  if (intensity === "rich") return base * 1.15;
  return base;
}

export function pageEnterTransition(intensity: MotionIntensity = "standard"): Transition {
  return {
    duration: scaleDuration(motionDurations.page, intensity),
    ease: motionEasings.enter,
  };
}

export function pageVariants(intensity: MotionIntensity = "standard"): Variants {
  return {
    initial: { opacity: 0, y: intensity === "minimal" ? 6 : 14 },
    animate: {
      opacity: 1,
      y: 0,
      transition: pageEnterTransition(intensity),
    },
    exit: {
      opacity: 0,
      y: intensity === "minimal" ? -4 : -10,
      transition: { duration: scaleDuration(motionDurations.fast, intensity), ease: motionEasings.exit },
    },
  };
}

export function staggerContainerVariants(intensity: MotionIntensity = "standard"): Variants {
  return {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: intensity === "rich" ? motionStagger.relaxed : motionStagger.base,
        delayChildren: 0.04,
      },
    },
  };
}

export function staggerItemVariants(intensity: MotionIntensity = "standard"): Variants {
  return {
    hidden: { opacity: 0, y: intensity === "minimal" ? 8 : 18 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        ...motionSprings.soft,
        opacity: { duration: scaleDuration(motionDurations.base, intensity) },
      },
    },
  };
}

/** Hover lift — transform + opacity only (GPU). */
export function hoverPhysicsProps(intensity: MotionIntensity = "standard") {
  const scale = intensity === "minimal" ? 1.02 : intensity === "rich" ? 1.06 : 1.04;
  return {
    whileHover: { scale, y: -4 },
    whileTap: { scale: 0.98 },
    transition: motionSprings.hover,
    style: { willChange: "transform" as const },
  };
}

export function modalVariants(): Variants {
  return {
    hidden: { opacity: 0, scale: 0.96, y: 12 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { ...motionSprings.cinematic },
    },
    exit: {
      opacity: 0,
      scale: 0.98,
      y: 8,
      transition: { duration: motionDurations.fast, ease: motionEasings.exit },
    },
  };
}

export function fadeOverlayVariants(): Variants {
  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: motionDurations.base } },
    exit: { opacity: 0, transition: { duration: motionDurations.fast } },
  };
}
