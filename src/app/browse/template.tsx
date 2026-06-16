"use client";

import { CinematicRoute } from "@/components/motion/cinematic-route";
import { BrowseRouteTransition } from "@/components/navigation/browse-route-transition";

export default function BrowseTemplate({ children }: { children: React.ReactNode }) {
  return (
    <BrowseRouteTransition>
      <CinematicRoute>{children}</CinematicRoute>
    </BrowseRouteTransition>
  );
}
