"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { MeetRemotePeer } from "@/hooks/use-meet-rtc";
import { Pin, PinOff } from "lucide-react";

export type MeetTile = {
  id: string;
  name: string;
  stream: MediaStream | null;
  mirrored?: boolean;
  isLocal?: boolean;
  isScreen?: boolean;
  isGuest?: boolean;
  reaction?: string | null;
  videoOff?: boolean;
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

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = tile.stream;
    setHasFrames(false);
    const tryPlay = () => {
      void el.play().catch(() => undefined);
    };
    tryPlay();
    const onPlaying = () => setHasFrames(true);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("loadeddata", tryPlay);
    return () => {
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("loadeddata", tryPlay);
    };
  }, [tile.stream]);

  return (
    <div
      className={[
        "relative overflow-hidden rounded-xl bg-black ring-1 ring-white/10",
        fill ? "h-full w-full min-h-0" : "aspect-video w-full",
        pinned ? "ring-2 ring-orange-400/70" : "",
      ].join(" ")}
    >
      {!tile.videoOff && tile.stream ? (
        <video
          ref={ref}
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

      {tile.isScreen && tile.stream && !hasFrames ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55 text-xs text-slate-300">
          Waiting for screen frames…
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
            "absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium backdrop-blur-md",
            pinned
              ? "border-orange-400/40 bg-orange-500/25 text-orange-50"
              : "border-white/20 bg-black/60 text-white hover:bg-black/80",
          ].join(" ")}
        >
          {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          {pinned ? "Unpin" : "Pin"}
        </button>
      ) : null}

      {/* Keep name above the floating control bar */}
      <div className="absolute bottom-3 left-2 right-2 sm:bottom-3">
        <span className="inline-block max-w-full truncate rounded-md border border-white/10 bg-black/60 px-2 py-1 text-[11px] text-white backdrop-blur-md">
          {tile.name}
          {tile.isScreen ? " · screen" : ""}
          {tile.isGuest ? " · guest" : ""}
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
  screenStream?: MediaStream | null;
  screenName?: string;
  pinnedId: string | null;
  onPin: (id: string | null) => void;
}) {
  const tiles = useMemo(() => {
    const remoteTiles: MeetTile[] = props.remotes.map((r) => ({
      id: r.peerId,
      name: r.name,
      stream: r.stream,
      isGuest: r.isGuest,
      reaction: r.reaction,
      isScreen: Boolean(r.isScreenShare),
    }));
    const list: MeetTile[] = [props.local, ...remoteTiles];
    if (props.screenStream) {
      list.unshift({
        id: "screen-local",
        name: props.screenName || "Screen share",
        stream: props.screenStream,
        isScreen: true,
        isLocal: true,
      });
    }
    return list;
  }, [props.local, props.remotes, props.screenStream, props.screenName]);

  const pinned = props.pinnedId ? tiles.find((t) => t.id === props.pinnedId) ?? null : null;
  const others = pinned ? tiles.filter((t) => t.id !== pinned.id) : tiles;

  if (pinned) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2 p-2 pb-28 sm:flex-row sm:gap-3 sm:p-3 sm:pb-28">
        <div className="relative min-h-[42%] flex-1 sm:min-h-0">
          <Tile tile={pinned} pinned fill showPin onPin={() => props.onPin(null)} />
        </div>
        {others.length ? (
          <div className="flex max-h-[34%] gap-2 overflow-x-auto pb-1 sm:max-h-none sm:w-44 sm:flex-col sm:overflow-y-auto lg:w-52">
            {others.map((t) => (
              <div key={t.id} className="w-40 shrink-0 sm:w-full">
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
      className={`grid h-full min-h-0 auto-rows-fr gap-2 p-2 pb-28 sm:gap-3 sm:p-3 sm:pb-28 ${gridClass(tiles.length)}`}
    >
      {tiles.map((t) => (
        <Tile key={t.id} tile={t} fill showPin onPin={() => props.onPin(t.id)} />
      ))}
    </div>
  );
}
