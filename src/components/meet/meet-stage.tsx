"use client";

import { useEffect, useRef } from "react";

type Props = {
  localStream: MediaStream | null;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  screenStream: MediaStream | null;
  displayName: string;
  reaction?: string | null;
};

export function MeetStage(props: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && props.localStream && !props.isScreenSharing) {
      videoRef.current.srcObject = props.localStream;
    }
  }, [props.localStream, props.isScreenSharing, props.isVideoOff]);

  useEffect(() => {
    if (screenRef.current && props.screenStream) {
      screenRef.current.srcObject = props.screenStream;
    }
  }, [props.screenStream]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0b] shadow-[0_0_0_1px_rgba(255,140,0,0.06)]">
      {props.isScreenSharing && props.screenStream ? (
        <video ref={screenRef} autoPlay playsInline className="h-full w-full object-contain" />
      ) : !props.isVideoOff && props.localStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full scale-x-[-1] object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#141416] to-[#0a0a0b]">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-orange-400/20 bg-orange-500/10 text-3xl font-semibold text-orange-100">
            {(props.displayName || "You").slice(0, 1).toUpperCase()}
          </div>
          <p className="text-sm text-slate-400">
            {props.isVideoOff ? "Camera is off" : "Starting camera…"}
          </p>
        </div>
      )}

      {/* Transparent ST watermark */}
      <div
        className="pointer-events-none absolute left-4 top-3 select-none font-black tracking-tight text-white/[0.18]"
        style={{ fontSize: "2.75rem", lineHeight: 1 }}
        aria-hidden
      >
        ST
      </div>

      {props.isScreenSharing ? (
        <div className="absolute left-4 top-14 rounded-full border border-orange-400/30 bg-orange-500/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-orange-100">
          Sharing screen
        </div>
      ) : null}

      <div className="absolute bottom-3 left-3 rounded-lg border border-white/10 bg-black/55 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
        {props.displayName || "You"}
      </div>

      {props.reaction ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-7xl drop-shadow-lg animate-bounce">
          {props.reaction}
        </div>
      ) : null}
    </div>
  );
}
