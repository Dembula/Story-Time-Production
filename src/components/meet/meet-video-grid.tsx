"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import type { MeetRemotePeer } from "@/hooks/use-meet-rtc";
import { Pin } from "lucide-react";

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
  if (count === 2) return "grid-cols-1 md:grid-cols-2";
  if (count <= 4) return "grid-cols-2";
  if (count <= 9) return "grid-cols-2 md:grid-cols-3";
  return "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
}

function Tile({
  tile,
  pinned,
  onPin,
  showPin,
}: {
  tile: MeetTile;
  pinned?: boolean;
  onPin?: () => void;
  showPin?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = tile.stream;
  }, [tile.stream]);

  return (
    <div
      className={[
        "relative min-h-0 overflow-hidden rounded-xl bg-black/80 ring-1 ring-white/10",
        pinned ? "ring-2 ring-orange-400/60" : "",
      ].join(" ")}
    >
      {!tile.videoOff && tile.stream ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={tile.isLocal}
          className={[
            "h-full w-full object-cover",
            tile.mirrored ? "scale-x-[-1]" : "",
            tile.isScreen ? "object-contain bg-black" : "",
          ].join(" ")}
        />
      ) : (
        <div className="flex h-full min-h-[140px] w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#161618] to-[#0a0a0b]">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-orange-400/25 bg-orange-500/10 text-2xl font-semibold text-orange-100">
            {(tile.name || "?").slice(0, 1).toUpperCase()}
          </div>
          <p className="text-xs text-slate-500">{tile.videoOff ? "Camera off" : "Connecting…"}</p>
        </div>
      )}

      <div className="pointer-events-none absolute left-2 top-2 opacity-70">
        <Image
          src="/st-mark.png"
          alt=""
          width={72}
          height={34}
          className="h-7 w-auto object-contain mix-blend-screen"
          aria-hidden
        />
      </div>

      <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2">
        <span className="max-w-[70%] truncate rounded-md border border-white/10 bg-black/50 px-2 py-0.5 text-[11px] text-white backdrop-blur-md">
          {tile.name}
          {tile.isScreen ? " · screen" : ""}
          {tile.isGuest ? " · guest" : ""}
        </span>
        {showPin && onPin ? (
          <button
            type="button"
            onClick={onPin}
            title={pinned ? "Unpin" : "Pin"}
            className="rounded-md border border-white/15 bg-black/45 p-1.5 text-white backdrop-blur-md hover:bg-black/70"
          >
            <Pin className={`h-3.5 w-3.5 ${pinned ? "fill-orange-400 text-orange-300" : ""}`} />
          </button>
        ) : null}
      </div>

      {tile.reaction ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-6xl drop-shadow-lg animate-bounce">
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
  const remoteTiles: MeetTile[] = props.remotes.map((r) => ({
    id: r.peerId,
    name: r.name,
    stream: r.stream,
    isGuest: r.isGuest,
    reaction: r.reaction,
  }));

  const screenTile: MeetTile | null = props.screenStream
    ? {
        id: "screen-local",
        name: props.screenName || "Screen share",
        stream: props.screenStream,
        isScreen: true,
        isLocal: true,
      }
    : null;

  const tiles = useMemo(() => {
    const list = [props.local, ...remoteTiles];
    if (screenTile) list.unshift(screenTile);
    return list;
  }, [props.local, remoteTiles, screenTile]);

  const pinned = tiles.find((t) => t.id === props.pinnedId) ?? (screenTile && props.pinnedId === "screen-local" ? screenTile : null) ?? (screenTile ?? null);
  const others = tiles.filter((t) => t.id !== pinned?.id);

  if (pinned) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2 p-2 md:flex-row md:gap-3 md:p-3">
        <div className="min-h-0 flex-1">
          <Tile
            tile={pinned}
            pinned
            showPin
            onPin={() => props.onPin(pinned.id === props.pinnedId ? null : pinned.id)}
          />
        </div>
        {others.length ? (
          <div className="flex max-h-[28%] gap-2 overflow-x-auto md:max-h-none md:w-48 md:flex-col md:overflow-y-auto lg:w-56">
            {others.map((t) => (
              <div key={t.id} className="aspect-video w-40 shrink-0 md:w-full">
                <Tile tile={t} showPin onPin={() => props.onPin(t.id)} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`grid h-full min-h-0 gap-2 p-2 md:gap-3 md:p-3 ${gridClass(tiles.length)}`}>
      {tiles.map((t) => (
        <Tile key={t.id} tile={t} showPin onPin={() => props.onPin(t.id)} />
      ))}
    </div>
  );
}
