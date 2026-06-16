"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaPlayerInstance } from "@vidstack/react";
import {
  getClientCaptureProtectionConfig,
  hardenVideoElement,
  registerCaptureHandle,
  subscribeScreenCaptureChanges,
} from "@/lib/content-capture-protection";
import { usesAppleNativePlayer } from "@/lib/player/native-player-guard";

type UseCaptureProtectedPlaybackOptions = {
  contentId: string;
  playerRef: React.RefObject<MediaPlayerInstance | null>;
  enabled?: boolean;
};

export function useCaptureProtectedPlayback({
  contentId,
  playerRef,
  enabled = true,
}: UseCaptureProtectedPlaybackOptions) {
  const [screenCaptured, setScreenCaptured] = useState(false);
  const config = getClientCaptureProtectionConfig();
  const active = enabled && config.enabled;
  const hardenedRef = useRef<WeakSet<HTMLVideoElement>>(new WeakSet());

  useEffect(() => {
    if (!active) return;
    registerCaptureHandle(contentId);
    return subscribeScreenCaptureChanges(setScreenCaptured);
  }, [active, contentId]);

  useEffect(() => {
    if (!active) return;

    const attach = () => {
      if (usesAppleNativePlayer()) return;
      const root = playerRef.current?.el;
      const video = root?.querySelector("video");
      if (!video || hardenedRef.current.has(video)) return;
      hardenVideoElement(video);
      hardenedRef.current.add(video);
    };

    attach();
    const interval = window.setInterval(attach, 800);
    return () => window.clearInterval(interval);
  }, [active, playerRef]);

  return {
    active,
    screenCaptured,
    drmConfigured: config.drmConfigured,
    watermarkEnabled: config.watermarkEnabled,
    mode: config.mode,
  };
}
