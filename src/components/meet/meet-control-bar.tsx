"use client";

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  PhoneOff,
  Smile,
  Users,
  Link2,
  StickyNote,
  Minimize2,
  Maximize2,
  Shield,
} from "lucide-react";

const REACTIONS = ["👍", "👏", "❤️", "😂", "🎉", "🔥"];

type Props = {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  minimized?: boolean;
  showMinimize?: boolean;
  showHostMenu?: boolean;
  waitingRoomLocked?: boolean;
  waitingCount?: number;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreen: () => void;
  onLeave: () => void;
  onCopyLink: () => void;
  onToggleParticipants: () => void;
  onToggleNotes: () => void;
  onReact: (emoji: string) => void;
  onMinimize?: () => void;
  onExpand?: () => void;
  onToggleLock?: () => void;
  onEndForAll?: () => void;
};

function CtrlBtn({
  onClick,
  active,
  danger,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={[
        "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full p-3 transition touch-manipulation",
        danger
          ? "bg-rose-600 text-white hover:bg-rose-500"
          : active
            ? "bg-orange-500 text-white shadow-[0_0_20px_-6px_rgba(249,115,22,0.7)]"
            : "bg-white/[0.08] text-white ring-1 ring-white/10 hover:bg-white/[0.14]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function MeetControlBar(props: Props) {
  if (props.minimized) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-[#121214]/95 px-2 py-2 shadow-2xl backdrop-blur-md">
        <CtrlBtn onClick={props.onToggleMute} active={props.isMuted} title={props.isMuted ? "Unmute" : "Mute"}>
          {props.isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </CtrlBtn>
        <CtrlBtn
          onClick={props.onToggleScreen}
          active={props.isScreenSharing}
          title="Share screen"
        >
          <MonitorUp className="h-4 w-4" />
        </CtrlBtn>
        {props.onExpand ? (
          <CtrlBtn onClick={props.onExpand} title="Expand Meet">
            <Maximize2 className="h-4 w-4" />
          </CtrlBtn>
        ) : null}
        <CtrlBtn onClick={props.onLeave} danger title="Leave">
          <PhoneOff className="h-4 w-4" />
        </CtrlBtn>
      </div>
    );
  }

  return (
    <div className="flex max-w-[100vw] flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-white/15 bg-black/55 px-2 py-2.5 shadow-2xl backdrop-blur-xl sm:gap-2 sm:px-3 sm:py-3">
      <CtrlBtn onClick={props.onToggleMute} active={props.isMuted} title={props.isMuted ? "Unmute" : "Mute"}>
        {props.isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
      </CtrlBtn>
      <CtrlBtn
        onClick={props.onToggleVideo}
        active={props.isVideoOff}
        title={props.isVideoOff ? "Show video" : "Hide video"}
      >
        {props.isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
      </CtrlBtn>
      <CtrlBtn
        onClick={props.onToggleScreen}
        active={props.isScreenSharing}
        title="Share screen"
      >
        <MonitorUp className="h-5 w-5" />
      </CtrlBtn>

      <div className="mx-0.5 flex items-center gap-0.5 rounded-full border border-white/8 bg-black/40 px-1.5 py-1 sm:mx-1 sm:px-2">
        <Smile className="mr-0.5 hidden h-3.5 w-3.5 text-slate-500 sm:block" />
        {REACTIONS.slice(0, 4).map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="min-h-9 min-w-9 rounded-md px-1 text-base transition hover:bg-white/10 touch-manipulation sm:min-h-0 sm:min-w-0 sm:px-1.5 sm:py-0.5"
            onClick={() => props.onReact(emoji)}
            title="React"
          >
            {emoji}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={props.onToggleParticipants}
        title={
          props.waitingCount
            ? `Participants · ${props.waitingCount} waiting`
            : "Participants"
        }
        className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/[0.08] p-3 text-white ring-1 ring-white/10 touch-manipulation hover:bg-white/[0.14]"
      >
        <Users className="h-5 w-5" />
        {props.waitingCount && props.waitingCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-black">
            {props.waitingCount > 9 ? "9+" : props.waitingCount}
          </span>
        ) : null}
      </button>
      <CtrlBtn onClick={props.onToggleNotes} title="VA notes">
        <StickyNote className="h-5 w-5" />
      </CtrlBtn>
      <span className="hidden sm:contents">
        <CtrlBtn onClick={props.onCopyLink} title="Copy invite link">
          <Link2 className="h-5 w-5" />
        </CtrlBtn>
        {props.showMinimize && props.onMinimize ? (
          <CtrlBtn onClick={props.onMinimize} title="Minimize — keep using Story Time">
            <Minimize2 className="h-5 w-5" />
          </CtrlBtn>
        ) : null}
      </span>
      {props.showHostMenu && props.onToggleLock ? (
        <CtrlBtn
          onClick={props.onToggleLock}
          active={props.waitingRoomLocked}
          title={props.waitingRoomLocked ? "Unlock waiting room" : "Lock waiting room"}
        >
          <Shield className="h-5 w-5" />
        </CtrlBtn>
      ) : null}
      {props.showHostMenu && props.onEndForAll ? (
        <button
          type="button"
          onClick={props.onEndForAll}
          title="End meeting for everyone"
          className="rounded-full bg-rose-900/80 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-rose-100 ring-1 ring-rose-500/40 touch-manipulation hover:bg-rose-800"
        >
          End for all
        </button>
      ) : null}
      <CtrlBtn onClick={props.onLeave} danger title="Leave">
        <PhoneOff className="h-5 w-5" />
      </CtrlBtn>
    </div>
  );
}
