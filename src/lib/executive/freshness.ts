import type { DataFreshness } from "@/lib/executive/types";

export function liveFreshness(generatedAt = new Date()): DataFreshness {
  return {
    mode: "LIVE",
    generatedAt: generatedAt.toISOString(),
    label: `Updated ${generatedAt.toLocaleTimeString()}`,
  };
}

export function delayedFreshness(generatedAt: Date, delayLabel: string): DataFreshness {
  return {
    mode: "DELAYED",
    generatedAt: generatedAt.toISOString(),
    label: delayLabel,
  };
}

export function dailyFreshness(generatedAt: Date): DataFreshness {
  return {
    mode: "DAILY",
    generatedAt: generatedAt.toISOString(),
    label: `Daily · ${generatedAt.toLocaleDateString()}`,
  };
}

export function secondsAgoLabel(generatedAt: Date, now = new Date()): string {
  const sec = Math.max(0, Math.floor((now.getTime() - generatedAt.getTime()) / 1000));
  if (sec < 60) return `Updated ${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `Updated ${min}m ago`;
  return `Updated ${Math.floor(min / 60)}h ago`;
}
