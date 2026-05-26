"use client";

import { Shield } from "lucide-react";

type CaptureProtectionBadgeProps = {
  active: boolean;
  drmConfigured: boolean;
  screenCaptured: boolean;
  signedUrl?: boolean;
};

export function CaptureProtectionBadge({
  active,
  drmConfigured,
  screenCaptured,
  signedUrl,
}: CaptureProtectionBadgeProps) {
  if (!active && !screenCaptured) return null;

  let message = "Protection on — all watch sessions";
  if (screenCaptured) {
    message = "Protected playback — capture blocked on supported devices";
  } else if (drmConfigured) {
    message = "Hardware DRM — capture-black on supported devices";
  } else if (signedUrl) {
    message = "Signed stream — playback URL expires after this session";
  }

  return (
    <div className="pointer-events-none absolute bottom-24 left-4 z-[12] flex items-center gap-2 rounded-lg border border-white/10 bg-black/55 px-3 py-1.5 text-[11px] text-slate-200 backdrop-blur-md">
      <Shield className="h-3.5 w-3.5 text-orange-300" />
      <span>{message}</span>
    </div>
  );
}
