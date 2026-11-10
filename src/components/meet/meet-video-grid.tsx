"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { MeetRemotePeer } from "@/hooks/use-meet-rtc";
import { MonitorUp, Pin, PinOff } from "lucide-react";

export type MeetTile = {
  id: string;
  name: string;
  stream: MediaStream | null;
  mirrored?: boolean;
  isLocal?: boolean;
  isScreen?: boolean;
  /** Local sharer: show status card instead of live screen (avoids hall-of-mirrors). */
  screenPlaceholder?: boolean;
  isGuest?: boolean;
  reaction?: string | null;
  videoOff?: boolean;
  badge?: string | null;
};

function gridClass(count: number) {
  if (count <= 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-1 sm:grid-cols-2";
  if (count <= 4) return "grid-cols-2";
  if (count <= 9) return "grid-cols-2 md:grid-cols-3";
  return "grid-cols-2 md:grid-cols-3 xl:grid-cols-4";
}

function usePreferContain(stream: MediaStream | null, forceContain?: boolean) {
  const [contain, setContain] = useState(Boolean(forceContain));
  useEffect(() => {
    if (forceContain) {
      setContain(true);
      return;
    }
    const track = stream?.getVideoTracks()[0];
    if (!track) {
      setContain(false);
      return;
    }
    const apply = () => {
      const s = track.getSettings?.() ?? {};
      const w = Number(s.width) || 0;
      const h = Number(s.height) || 0;
      setContain(Boolean(w && h && h > w * 1.05));
    };
    apply();
    track.addEventListener?.("unmute", apply);
    return () => track.removeEventListener?.("unmute", apply);
  }, [stream, forceContain]);
  return contain;
}

/** Stable identity for video tracks only — ignore mute flicker so we don't thrash playback. */
function streamVideoTrackKey(stream: MediaStream | null | undefined) {
  if (!stream) return "none";
  const videos = stream.getVideoTracks();
  if (!videos.length) return "novideo";
  return videos.map((t) => `${t.id}:${t.readyState}`).join("|");
}

function Tile({
  tile,
  pinned,
  onPin,
  showPin,
  fill,
}: {
  tile: MeetTile;
  pinned?: boolean;
  onPin?: () => void;
  showPin?: boolean;
  fill?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const preferContain = usePreferContain(tile.stream, tile.isScreen);
  const [hasFrames, setHasFrames] = useState(false);
  const [showConnecting, setShowConnecting] = useState(true);
  const [trackKey, setTrackKey] = useState(() => streamVideoTrackKey(tile.stream));
  const boundStreamRef = useRef<MediaStream | null>(null);

  // Watch for real track add/remove (not mute) so late remote video can attach.
  useEffect(() => {
    const stream = tile.stream;
    if (!stream) {
      setTrackKey("none");
      return;
    }
    const bump = () => setTrackKey(streamVideoTrackKey(stream));
    bump();
    stream.addEventListener("addtrack", bump);
    stream.addEventListener("removetrack", bump);
    return () => {
      stream.removeEventListener("addtrack", bump);
      stream.removeEventListener("removetrack", bump);
    };
  }, [tile.stream]);

  useEffect(() => {
    const el = ref.current;
    if (!el || tile.screenPlaceholder || tile.videoOff || !tile.stream) return;

    el.muted = Boolean(tile.isLocal);
    setHasFrames(false);
    setShowConnecting(true);

    const ensureBound = (force = false) => {
      if (!tile.stream) return;
      if (force || el.srcObject !== tile.stream || boundStreamRef.current !== tile.stream) {
        el.srcObject = tile.stream;
        boundStreamRef.current = tile.stream;
      }
      void el.play().catch(() => undefined);
    };

    // Soft play kick — never null/reset srcObject on a timer (that caused the forever loop).
    const kickPlay = () => {
      void el.play().catch(() => undefined);
      if (el.videoWidth > 0 || (el.readyState >= 2 && !el.paused)) {
        setHasFrames(true);
        setShowConnecting(false);
      }
    };

    ensureBound(true);
    const track = tile.stream.getVideoTracks()[0];
    const onUnmute = () => {
      ensureBound(false);
      kickPlay();
    };
    track?.addEventListener("unmute", onUnmute);

    const markReady = () => {
      setHasFrames(true);
      setShowConnecting(false);
    };
    el.addEventListener("playing", markReady);
    el.addEventListener("loadeddata", kickPlay);
    el.addEventListener("canplay", kickPlay);

    const kicks = [150, 500, 1200].map((ms) => window.setTimeout(kickPlay, ms));
    // Never leave the overlay up forever — hide after a few seconds even if events are flaky.
    const hideOverlay = window.setTimeout(() => setShowConnecting(false), 3500);

    let frameHandle = 0;
    const videoEl = el as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (h: number) => void;
    };
    if (typeof videoEl.requestVideoFrameCallback === "function") {
      frameHandle = videoEl.requestVideoFrameCallback(() => markReady());
    }

    return () => {
      for (const id of kicks) window.clearTimeout(id);
      window.clearTimeout(hideOverlay);
      track?.removeEventListener("unmute", onUnmute);
      el.removeEventListener("playing", markReady);
      el.removeEventListener("loadeddata", kickPlay);
      el.removeEventListener("canplay", kickPlay);
      if (frameHandle && typeof videoEl.cancelVideoFrameCallback === "function") {
        videoEl.cancelVideoFrameCallback(frameHandle);
      }
    };
  }, [tile.stream, tile.isLocal, tile.screenPlaceholder, tile.videoOff, trackKey]);

  const videoTrackLive = Boolean(
    tile.stream?.getVideoTracks().some((t) => t.readyState === "live" && t.enabled),
  );

  return (
    <div
      className={[
        "relative overflow-hidden rounded-xl bg-black ring-1 ring-white/10",
        fill ? "h-full w-full min-h-0" : "aspect-video w-full",
        pinned ? "ring-2 ring-orange-400/70" : "",
      ].join(" ")}
    >
      {tile.screenPlaceholder ? (
        <div className="flex h-full min-h-[140px] w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#1a1510] via-[#121214] to-[#0a0a0b] px-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-400/30 bg-orange-500/15 text-orange-200">
            <MonitorUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Sharing screen</p>
            <p className="mt-1 max-w-[16rem] text-[11px] leading-relaxed text-slate-400">
              Others see your shared window here. This preview stays blank so you don’t get a mirror
              loop.
            </p>
          </div>
        </div>
      ) : !tile.videoOff && tile.stream ? (
        <video
          ref={ref}
          data-meet-tile-video="1"
          autoPlay
          playsInline
          muted={tile.isLocal}
          className={[
            "h-full w-full bg-black",
            preferContain || tile.isScreen ? "object-contain" : "object-cover",
            tile.mirrored && !tile.isScreen ? "scale-x-[-1]" : "",
          ].join(" ")}
        />
      ) : (
        <div className="flex h-full min-h-[120px] w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#161618] to-[#0a0a0b]">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-orange-400/25 bg-orange-500/10 text-xl font-semibold text-orange-100">
            {(tile.name || "?").slice(0, 1).toUpperCase()}
          </div>
          <p className="text-xs text-slate-500">{tile.videoOff ? "Camera off" : "Connecting…"}</p>
        </div>
      )}

      {!tile.screenPlaceholder &&
      !tile.videoOff &&
      tile.stream &&
      showConnecting &&
      !hasFrames &&
      videoTrackLive ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-slate-300">
          {tile.isScreen ? "Waiting for screen…" : "Connecting video…"}
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-2 top-2 opacity-80">
        <Image
          src="/st-mark.png"
          alt=""
          width={64}
          height={30}
          className="h-6 w-auto object-contain mix-blend-screen"
          aria-hidden
        />
      </div>

      {showPin && onPin ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPin();
          }}
          title={pinned ? "Unpin" : "Pin"}
          className={[
            "absolute right-2 top-2 z-10 inline-flex min-h-9 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium backdrop-blur-md",
            pinned
              ? "border-orange-400/40 bg-orange-500/25 text-orange-50"
              : "border-white/20 bg-black/60 text-white hover:bg-black/80",
          ].join(" ")}
        >
          {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          {pinned ? "Unpin" : "Pin"}
        </button>
      ) : null}

      <div className="absolute bottom-3 left-2 right-2 sm:bottom-3">
        <span className="inline-block max-w-full truncate rounded-md border border-white/10 bg-black/60 px-2 py-1 text-[11px] text-white backdrop-blur-md">
          {tile.name}
          {tile.badge ? ` · ${tile.badge}` : ""}
          {!tile.badge && tile.isGuest ? " · guest" : ""}
        </span>
      </div>

      {tile.reaction ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-5xl drop-shadow-lg animate-bounce sm:text-6xl">
          {tile.reaction}
        </div>
      ) : null}
    </div>
  );
}

export function MeetVideoGrid(props: {
  local: MeetTile;
  remotes: MeetRemotePeer[];
  /** When true, local screen tile is a non-mirrored status card (sharer view). */
  localScreenSharing?: boolean;
  pinnedId: string | null;
  onPin: (id: string | null) => void;
}) {
  const tiles = useMemo(() => {
    const remoteTiles: MeetTile[] = [];
    for (const r of props.remotes) {
      remoteTiles.push({
        id: r.peerId,
        name: r.name,
        stream: r.stream,
        isGuest: r.isGuest,
        reaction: r.reaction,
        badge: r.isGuest ? "guest" : null,
      });
      if (r.screenStream && r.screenStream.getVideoTracks().length > 0) {
        remoteTiles.push({
          id: `screen-${r.peerId}`,
          name: "Shared screen",
          stream: r.screenStream,
          isScreen: true,
          badge: r.name,
        });
      }
    }

    const list: MeetTile[] = [
      {
        ...props.local,
        name: props.localScreenSharing ? "Sharing screen" : props.local.name,
        badge: props.localScreenSharing ? props.local.name : props.local.badge,
      },
      ...remoteTiles,
    ];

    if (props.localScreenSharing) {
      list.unshift({
        id: "screen-local",
        name: "Shared screen",
        stream: null,
        isScreen: true,
        isLocal: true,
        screenPlaceholder: true,
        badge: "pinned for others",
      });
    }

    return list;
  }, [props.local, props.remotes, props.localScreenSharing]);

  const rootRef = useRef<HTMLDivElement>(null);

  // Mobile Safari often pauses remote A/V until play() is kicked again after tracks unmute.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLVideoElement>("[data-meet-tile-video='1']").forEach((el) => {
      if (el.paused) void el.play().catch(() => undefined);
    });
  }, [tiles]);

  const pinned = props.pinnedId ? tiles.find((t) => t.id === props.pinnedId) ?? null : null;
  const others = pinned ? tiles.filter((t) => t.id !== pinned.id) : tiles;

  if (pinned) {
    return (
      <div
        ref={rootRef}
        className="flex h-full min-h-0 flex-col gap-2 p-2 pb-[7.5rem] sm:flex-row sm:gap-3 sm:p-3 sm:pb-28"
      >
        <div className="relative min-h-[42%] flex-1 sm:min-h-0">
          <Tile tile={pinned} pinned fill showPin onPin={() => props.onPin(null)} />
        </div>
        {others.length ? (
          <div className="flex max-h-[36%] gap-2 overflow-x-auto pb-1 sm:max-h-none sm:w-44 sm:flex-col sm:overflow-y-auto lg:w-52">
            {others.map((t) => (
              <div key={t.id} className="w-[9.5rem] shrink-0 sm:w-full">
                <Tile tile={t} showPin onPin={() => props.onPin(t.id)} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`grid h-full min-h-0 auto-rows-fr gap-2 p-2 pb-[7.5rem] sm:gap-3 sm:p-3 sm:pb-28 ${gridClass(tiles.length)}`}
    >
      {tiles.map((t) => (
        <Tile key={t.id} tile={t} fill showPin onPin={() => props.onPin(t.id)} />
      ))}
    </div>
  );
}
