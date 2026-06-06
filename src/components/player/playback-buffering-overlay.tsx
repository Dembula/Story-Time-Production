"use client";

import { useEffect, useState } from "react";
import { useMediaState } from "@vidstack/react";
import { StoryTimeLoader, StoryTimeLoaderOverlay } from "@/components/ui/storytime-loader";

const BUFFERING_SHOW_MS = 280;

/** Story Time overlay while the stream stalls mid-playback (inside MediaPlayer context). */
export function PlaybackBufferingOverlay() {
  const waiting = useMediaState("waiting");
  const seeking = useMediaState("seeking");
  const canPlay = useMediaState("canPlay");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const shouldBuffer = (waiting || seeking) && canPlay;
    if (!shouldBuffer) {
      setVisible(false);
      return;
    }

    const timer = window.setTimeout(() => setVisible(true), BUFFERING_SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [waiting, seeking, canPlay]);

  if (!visible) return null;

  return (
    <StoryTimeLoaderOverlay mode="inset">
      <StoryTimeLoader size="md" />
    </StoryTimeLoaderOverlay>
  );
}
