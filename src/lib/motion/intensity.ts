import type { DeviceClass } from "@/components/adaptive/adaptive-provider";
import type { MotionIntensity } from "./tokens";

/** Map device + user preference → animation richness. */
export function resolveMotionIntensity(options: {
  deviceClass?: DeviceClass;
  prefersReducedMotion?: boolean;
}): MotionIntensity {
  if (options.prefersReducedMotion) return "minimal";
  if (options.deviceClass === "mobile") return "standard";
  if (options.deviceClass === "tv") return "rich";
  return "standard";
}
