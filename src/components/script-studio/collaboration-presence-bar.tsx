"use client";

import { creatorToolSelectSm } from "@/lib/ui/creator-tool-select";

import Image from "next/image";
import type { CollaborationPeer, ProjectCollaborator } from "./use-script-collaboration";

type CollaborationPresenceBarProps = {
  peers: CollaborationPeer[];
  collaborators: ProjectCollaborator[];
  myColor: string;
  collaborationMode: "writer" | "producer" | "read_only";
  onModeChange?: (mode: "writer" | "producer" | "read_only") => void;
  canWrite: boolean;
};

export function CollaborationPresenceBar({
  peers,
  collaborators,
  myColor,
  collaborationMode,
  onModeChange,
  canWrite,
}: CollaborationPresenceBarProps) {
  const writingPeers = peers.filter((p) => p.isWriting || p.isTyping);
  const onlineCount = peers.length + 1;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          Live · {onlineCount} in studio
        </span>
        <div className="flex items-center -space-x-2">
          <span
            className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-900 text-[10px] font-bold text-white"
            style={{ backgroundColor: myColor }}
            title="You"
          >
            You
          </span>
          {peers.slice(0, 6).map((peer) => (
            <span
              key={peer.userId}
              className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border-2 border-slate-900"
              style={{ backgroundColor: peer.color }}
              title={peer.displayName}
            >
              {peer.image ? (
                <Image src={peer.image} alt="" width={28} height={28} className="object-cover" />
              ) : (
                <span className="text-[9px] font-bold text-white">
                  {peer.displayName.slice(0, 2).toUpperCase()}
                </span>
              )}
              {(peer.isWriting || peer.isTyping) && (
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-slate-900" />
              )}
            </span>
          ))}
        </div>
        {onModeChange ? (
          <select
            value={collaborationMode}
            onChange={(e) =>
              onModeChange(e.target.value as "writer" | "producer" | "read_only")
            }
            className={creatorToolSelectSm("ml-auto text-[10px]")}
          >
            <option value="writer">Writer mode</option>
            <option value="producer">Producer mode</option>
            <option value="read_only">Read-only</option>
          </select>
        ) : null}
        {!canWrite ? (
          <span className="text-[10px] text-amber-400">View only</span>
        ) : null}
      </div>

      {writingPeers.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-[11px]">
          {writingPeers.map((peer) => (
            <span
              key={peer.userId}
              className="rounded-full px-2 py-0.5"
              style={{ backgroundColor: `${peer.color}22`, color: peer.color }}
            >
              {peer.displayName} is writing
              {peer.activeSceneHeading ? ` · ${peer.activeSceneHeading.slice(0, 40)}` : ""}
            </span>
          ))}
        </div>
      ) : peers.length > 0 ? (
        <p className="text-[11px] text-slate-500">
          {peers.map((p) => p.displayName).join(", ")} {peers.length === 1 ? "is" : "are"} in the
          script with you.
        </p>
      ) : collaborators.length > 1 ? (
        <p className="text-[11px] text-slate-500">
          {collaborators.length} project collaborators can join this screenplay.
        </p>
      ) : null}
    </div>
  );
}
