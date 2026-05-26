/**
 * Central motion design tokens — single source of timing language.
 * All durations in seconds for Framer Motion compatibility.
 */

export const motionDurations = {
  instant: 0.12,
  fast: 0.22,
  base: 0.38,
  slow: 0.55,
  cinematic: 0.72,
  page: 0.48,
} as const;

export const motionStagger = {
  tight: 0.04,
  base: 0.06,
  relaxed: 0.09,
  row: 0.05,
} as const;

/** Spring configs — GPU-friendly (transform/opacity only in presets). */
export const motionSprings = {
  snappy: { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.85 },
  soft: { type: "spring" as const, stiffness: 280, damping: 28, mass: 1 },
  cinematic: { type: "spring" as const, stiffness: 200, damping: 26, mass: 1.1 },
  hover: { type: "spring" as const, stiffness: 360, damping: 24, mass: 0.75 },
} as const;

export const motionEasings = {
  enter: [0.16, 1, 0.3, 1] as const,
  exit: [0.4, 0, 0.2, 1] as const,
  emphasis: [0.22, 1, 0.36, 1] as const,
  inOut: [0.45, 0, 0.15, 1] as const,
} as const;

/** Depth scale for layered UI (hover / focus / modal). */
export const motionDepth = {
  rest: 1,
  hover: 1.04,
  focus: 1.02,
  elevated: 1.06,
  modal: 1,
} as const;

export type MotionIntensity = "minimal" | "standard" | "rich";
