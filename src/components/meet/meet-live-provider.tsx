"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { MeetRoomClient } from "@/components/meet/meet-room-client";
import { setActiveMeetSnapshot } from "@/lib/meet/active-session";

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

const DOCK_W = 320;
const DOCK_H = 220;

export function MeetLiveProvider({ children }: { children: ReactNode }) {
  const [call, setCall] = useState<MeetLiveCall | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [dockPos, setDockPos] = useState<{ x: number; y: number } | null>(null);
  const callIdRef = useRef<string | null>(null);
  const dragRef = useRef<{
    ox: number;
    oy: number;
    startX: number;
    startY: number;
  } | null>(null);

  const ensureCall = useCallback((next: MeetLiveCall) => {
    const same = callIdRef.current === next.meetingId;
    callIdRef.current = next.meetingId;
    setCall((prev) => {
      if (prev?.meetingId === next.meetingId) {
        return { ...prev, ...next };
      }
      return next;
    });
    // Only expand when joining a different meeting — never undo an intentional minimize.
    if (!same) {
      setMinimized(false);
      setDockPos(null);
    }
  }, []);

  const minimize = useCallback(() => {
    setMinimized(true);
    setDockPos((prev) => {
      if (prev) return prev;
      if (typeof window === "undefined") return { x: 24, y: 24 };
      return {
        x: Math.max(12, window.innerWidth - DOCK_W - 16),
        y: Math.max(12, window.innerHeight - DOCK_H - 16),
      };
    });
  }, []);

  const expand = useCallback(() => setMinimized(false), []);
  const clearCall = useCallback(() => {
    callIdRef.current = null;
    setCall(null);
    setMinimized(false);
    setDockPos(null);
  }, []);

  const onDockPointerDown = (e: ReactPointerEvent) => {
    if (!minimized) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, video")) return;
    const pos = dockPos ?? {
      x: Math.max(12, window.innerWidth - DOCK_W - 16),
      y: Math.max(12, window.innerHeight - DOCK_H - 16),
    };
    dragRef.current = {
      ox: pos.x,
      oy: pos.y,
      startX: e.clientX,
      startY: e.clientY,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onDockPointerMove = (e: ReactPointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const maxX = Math.max(8, window.innerWidth - DOCK_W - 8);
    const maxY = Math.max(8, window.innerHeight - 120);
    setDockPos({
      x: Math.min(maxX, Math.max(8, dragRef.current.ox + dx)),
      y: Math.min(maxY, Math.max(8, dragRef.current.oy + dy)),
    });
  };

  const onDockPointerUp = (e: ReactPointerEvent) => {
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    setActiveMeetSnapshot({ call, minimized });
    return () => setActiveMeetSnapshot({ call: null, minimized: false });
  }, [call, minimized]);

  const value = useMemo(
    () => ({ call, minimized, ensureCall, minimize, expand, clearCall }),
    [call, minimized, ensureCall, minimize, expand, clearCall],
  );

  const dockStyle =
    minimized && dockPos
      ? {
          left: dockPos.x,
          top: dockPos.y,
          width: DOCK_W,
          maxWidth: "calc(100vw - 1rem)",
        }
      : minimized
        ? {
            right: 16,
            bottom: 16,
            width: DOCK_W,
            maxWidth: "calc(100vw - 1rem)",
          }
        : undefined;

  return (
    <MeetLiveContext.Provider value={value}>
      {children}
      {call ? (
        <div
          className={
            minimized
              ? "fixed z-[120] touch-none"
              : "fixed inset-0 z-[120] bg-black"
          }
          style={dockStyle}
          onPointerDown={minimized ? onDockPointerDown : undefined}
          onPointerMove={minimized ? onDockPointerMove : undefined}
          onPointerUp={minimized ? onDockPointerUp : undefined}
          onPointerCancel={minimized ? onDockPointerUp : undefined}
        >
          <div className={minimized ? "h-full w-full cursor-grab active:cursor-grabbing" : "h-full w-full"}>
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
