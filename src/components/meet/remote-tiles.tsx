"use client";

import { useEffect, useRef } from "react";
import type { MeetRemotePeer } from "@/hooks/use-meet-rtc";

function RemoteTile({ peer }: { peer: MeetRemotePeer }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = peer.stream;
  }, [peer.stream]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0b]">
      <video ref={ref} autoPlay playsInline className="h-full w-full object-cover" />
      <div className="absolute bottom-2 left-2 rounded-md border border-white/10 bg-black/55 px-2 py-0.5 text-xs text-white backdrop-blur-sm">
        {peer.name}
        {peer.isGuest ? (
          <span className="ml-1 text-[10px] uppercase text-slate-400">guest</span>
        ) : null}
      </div>
      <div className="pointer-events-none absolute left-2 top-2 select-none text-lg font-black text-white/15">
        ST
      </div>
      {peer.reaction ? (
        <div className="absolute inset-0 flex items-center justify-center text-5xl animate-pulse">
          {peer.reaction}
        </div>
      ) : null}
    </div>
  );
}

export function MeetRemoteTiles({ peers }: { peers: MeetRemotePeer[] }) {
  if (!peers.length) return null;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {peers.map((p) => (
        <RemoteTile key={p.peerId} peer={p} />
      ))}
    </div>
  );
}
