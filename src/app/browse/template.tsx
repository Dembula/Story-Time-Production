"use client";

import { CinematicRoute } from "@/components/motion/cinematic-route";

export default function BrowseTemplate({ children }: { children: React.ReactNode }) {
  return <CinematicRoute>{children}</CinematicRoute>;
}
