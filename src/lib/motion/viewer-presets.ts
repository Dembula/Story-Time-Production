import type { Transition, Variants } from "framer-motion";
import { motionDurations, motionEasings } from "./tokens";

/** Premium viewer springs — slightly softer than dashboard defaults. */
export const viewerSprings = {
  nav: { type: "spring" as const, stiffness: 380, damping: 34, mass: 0.9 },
  sheet: { type: "spring" as const, stiffness: 255, damping: 32, mass: 1.05 },
  chip: { type: "spring" as const, stiffness: 400, damping: 30, mass: 0.8 },
  lift: { type: "spring" as const, stiffness: 330, damping: 28, mass: 0.85 },
  message: { type: "spring" as const, stiffness: 290, damping: 30, mass: 0.95 },
  stagger: { type: "spring" as const, stiffness: 260, damping: 28, mass: 1 },
} as const;

export const viewerTransition: Transition = {
  duration: motionDurations.base,
  ease: [0.22, 1, 0.36, 1],
};

export function viewerOverlayVariants(): Variants {
  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: motionDurations.fast, ease: motionEasings.enter } },
    exit: { opacity: 0, transition: { duration: motionDurations.instant, ease: motionEasings.exit } },
  };
}

export function viewerSheetVariants(isMobile = false): Variants {
  return {
    hidden: isMobile ? { opacity: 0, y: 32, scale: 0.985 } : { opacity: 0, y: 18, scale: 0.97 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: viewerSprings.sheet,
    },
    exit: {
      opacity: 0,
      y: isMobile ? 24 : 12,
      scale: 0.985,
      transition: { duration: motionDurations.fast, ease: motionEasings.exit },
    },
  };
}

export function viewerDropdownVariants(): Variants {
  return {
    hidden: { opacity: 0, y: -6, scale: 0.98 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: viewerSprings.chip,
    },
    exit: {
      opacity: 0,
      y: -4,
      scale: 0.99,
      transition: { duration: motionDurations.instant, ease: motionEasings.exit },
    },
  };
}

export function viewerMessageVariants(): Variants {
  return {
    hidden: { opacity: 0, y: 10, scale: 0.98 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: viewerSprings.message,
    },
  };
}

export function viewerListContainerVariants(): Variants {
  return {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05, delayChildren: 0.03 },
    },
  };
}

export function viewerListItemVariants(): Variants {
  return {
    hidden: { opacity: 0, y: 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: viewerSprings.stagger,
    },
  };
}

export function viewerHoverLiftProps(reducedMotion = false) {
  if (reducedMotion) return {};
  return {
    whileHover: { y: -3, scale: 1.01 },
    whileTap: { scale: 0.985, y: 0 },
    transition: viewerSprings.lift,
    style: { willChange: "transform" as const },
  };
}
