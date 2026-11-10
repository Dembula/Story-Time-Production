"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MeetRoomClient } from "@/components/meet/meet-room-client";

export type MeetLiveCall = {
  meetingId: string;
  title: string;
  code: string;
  displayName: string;
};

type MeetLiveContextValue = {
  call: MeetLiveCall | null;
  minimized: boolean;
  ensureCall: (call: MeetLiveCall) => void;
  minimize: () => void;
  expand: () => void;
  clearCall: () => void;
};

const MeetLiveContext = createContext<MeetLiveContextValue | null>(null);

export function useMeetLive() {
  const ctx = useContext(MeetLiveContext);
  if (!ctx) {
    throw new Error("useMeetLive must be used within MeetLiveProvider");
  }
  return ctx;
}

export function useMeetLiveOptional() {
  return useContext(MeetLiveContext);
}

export function MeetLiveProvider({ children }: { children: ReactNode }) {
  const [call, setCall] = useState<MeetLiveCall | null>(null);
  const [minimized, setMinimized] = useState(false);

  const ensureCall = useCallback((next: MeetLiveCall) => {
    setCall((prev) => {
      if (prev?.meetingId === next.meetingId) {
        return { ...prev, ...next };
      }
      return next;
    });
    setMinimized(false);
  }, []);

  const minimize = useCallback(() => setMinimized(true), []);
  const expand = useCallback(() => setMinimized(false), []);
  const clearCall = useCallback(() => {
    setCall(null);
    setMinimized(false);
  }, []);

  const value = useMemo(
    () => ({ call, minimized, ensureCall, minimize, expand, clearCall }),
    [call, minimized, ensureCall, minimize, expand, clearCall],
  );

  return (
    <MeetLiveContext.Provider value={value}>
      {children}
      {call ? (
        <div
          className={
            minimized
              ? "pointer-events-none fixed bottom-4 right-4 z-[120] w-[min(100vw-1.5rem,22rem)]"
              : "fixed inset-0 z-[120] bg-black"
          }
        >
          <div className={minimized ? "pointer-events-auto" : "h-full w-full"}>
            <MeetRoomClient
              meetingId={call.meetingId}
              title={call.title}
              code={call.code}
              displayName={call.displayName}
              minimized={minimized}
              onMinimize={minimize}
              onExpand={expand}
              onEnded={clearCall}
              persistAcrossNavigation
            />
          </div>
        </div>
      ) : null}
    </MeetLiveContext.Provider>
  );
}
