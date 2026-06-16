"use client";

import type { VideoHTMLAttributes } from "react";
import { resolveNativeVideoSafeUrl } from "@/lib/playback-sources";

type NativeSafeVideoProps = VideoHTMLAttributes<HTMLVideoElement> & {
  videoUrl: string | null | undefined;
};

/** MP4-only native preview — never assigns HLS/stream manifests. */
export function NativeSafeVideo({ videoUrl, ...props }: NativeSafeVideoProps) {
  const safeSrc = resolveNativeVideoSafeUrl(videoUrl);
  if (!safeSrc) return null;

  return (
    <video
      {...props}
      src={safeSrc}
      playsInline
      disableRemotePlayback
    />
  );
}
