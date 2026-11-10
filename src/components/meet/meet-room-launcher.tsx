"use client";

import { useEffect } from "react";
import { useMeetLive } from "@/components/meet/meet-live-provider";

/** Boots the persistent Meet surface from the room route (call lives in MeetLiveProvider). */
export function MeetRoomLauncher(props: {
  meetingId: string;
  title: string;
  code: string;
  displayName: string;
}) {
  const live = useMeetLive();

  useEffect(() => {
    live.ensureCall({
      meetingId: props.meetingId,
      title: props.title,
      code: props.code,
      displayName: props.displayName,
    });
  }, [live, props.meetingId, props.title, props.code, props.displayName]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 px-4 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-300/85">
        Story Time Meet
      </p>
      <p className="text-sm text-slate-400">Opening your call…</p>
      <p className="text-xs text-slate-500">
        Minimize anytime to keep sharing while you use the rest of Story Time.
      </p>
    </div>
  );
}
