"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MeetRoomClient } from "@/components/meet/meet-room-client";

type Props = {
  code: string;
  meetingTitle?: string | null;
  meetingId?: string | null;
  ended?: boolean;
};

export function MeetGuestClient(props: Props) {
  const search = useSearchParams();
  const left = search.get("left") === "1";
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState(search.get("passcode") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<{
    meetingId: string;
    title: string;
    code: string;
    name: string;
    stream: MediaStream | null;
  } | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const [preview, setPreview] = useState<MediaStream | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const handedOffRef = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    void navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 720 },
          height: { ideal: 1280 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        for (const track of s.getTracks()) track.enabled = true;
        stream = s;
        setPreview(s);
        setPreviewReady(true);
        if (previewRef.current) {
          previewRef.current.srcObject = s;
          void previewRef.current.play().catch(() => undefined);
        }
      })
      .catch(() => {
        if (!cancelled) setPreviewReady(false);
      });
    return () => {
      cancelled = true;
      if (!handedOffRef.current) stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (previewRef.current && preview) {
      previewRef.current.srcObject = preview;
      void previewRef.current.play().catch(() => undefined);
    }
  }, [preview]);

  if (props.ended || left) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-[#0a0a0b] px-6 text-center">
        <Video className="h-10 w-10 text-slate-600" />
        <h1 className="text-lg font-semibold text-white">You’ve left the meeting</h1>
        <p className="max-w-md text-sm text-slate-400">
          Thanks for joining Story Time Meet. You can close this tab.
        </p>
      </div>
    );
  }

  if (session) {
    return (
      <div className="min-h-[100dvh] bg-black">
        <MeetRoomClient
          meetingId={session.meetingId}
          title={session.title}
          code={session.code}
          displayName={session.name}
          guestMode
          initialStream={session.stream}
        />
      </div>
    );
  }

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/meet/rtc/guest/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code: props.code,
          name: name.trim(),
          passcode: passcode.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not join");
      // Hand preview media into the room so mobile doesn’t re-prompt / black-screen.
      handedOffRef.current = true;
      setSession({
        meetingId: json.meeting.id,
        title: json.meeting.title,
        code: json.meeting.code,
        name: name.trim(),
        stream: preview,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Join failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#0a0a0b]">
      <div className="relative min-h-[42dvh] flex-1 bg-black sm:min-h-0 sm:flex-none">
        <div className="absolute inset-0 sm:relative sm:mx-auto sm:mt-8 sm:aspect-video sm:max-w-lg sm:overflow-hidden sm:rounded-2xl sm:border sm:border-white/10">
          {previewReady ? (
            <video
              ref={previewRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full scale-x-[-1] object-cover"
            />
          ) : (
            <div className="flex h-full min-h-[42dvh] flex-col items-center justify-center gap-2 bg-[#121214] text-slate-500 sm:min-h-[240px]">
              <Video className="h-8 w-8" />
              <p className="px-6 text-center text-xs">
                Camera preview unavailable — you can still join
              </p>
            </div>
          )}
          <div className="pointer-events-none absolute left-4 top-4 opacity-90 sm:left-3 sm:top-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/st-mark.png" alt="" className="h-8 w-auto object-contain mix-blend-screen" />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 sm:hidden">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-300/90">
              Story Time Meet
            </p>
            <p className="mt-1 text-lg font-semibold text-white">
              {props.meetingTitle || "Join as guest"}
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-10 -mt-4 rounded-t-3xl border-t border-white/10 bg-[#121214] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 shadow-2xl sm:mx-auto sm:mt-5 sm:mb-10 sm:w-full sm:max-w-lg sm:rounded-2xl sm:border sm:px-8 sm:py-8">
        <div className="hidden sm:block">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-300/85">
            Story Time Meet
          </p>
          <h1 className="mt-3 font-display text-2xl font-semibold leading-snug text-white">
            {props.meetingTitle || "Join as guest"}
          </h1>
        </div>
        <p className="text-sm leading-relaxed text-slate-400 sm:mt-3">
          Enter your name to join the waiting room — no Story Time account required. The host will
          admit you.
        </p>
        <p className="mt-2 text-xs text-slate-500">Meeting code · {props.code}</p>

        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void join();
          }}
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-300">Your name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="How should others see you?"
              required
              minLength={2}
              autoComplete="name"
              className="h-12 border-white/10 bg-black/40 text-base text-white sm:h-10 sm:text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-300">
              Passcode <span className="text-slate-500">(if the host shared one)</span>
            </span>
            <Input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Optional"
              className="h-12 border-white/10 bg-black/40 text-base text-white sm:h-10 sm:text-sm"
            />
          </label>
          {error ? <p className="text-xs text-red-300">{error}</p> : null}
          <Button
            type="submit"
            className="h-12 w-full bg-orange-500 text-base text-white hover:bg-orange-400 sm:h-10 sm:text-sm"
            disabled={busy || name.trim().length < 2}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Ask to join
          </Button>
        </form>
      </div>
    </div>
  );
}
