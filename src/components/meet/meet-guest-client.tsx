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
  } | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const [preview, setPreview] = useState<MediaStream | null>(null);
  const [previewReady, setPreviewReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    void navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((s) => {
        stream = s;
        setPreview(s);
        setPreviewReady(true);
        if (previewRef.current) previewRef.current.srcObject = s;
      })
      .catch(() => setPreviewReady(false));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => {
    if (previewRef.current && preview) previewRef.current.srcObject = preview;
  }, [preview]);

  if (props.ended || left) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0a0a0b] px-6 text-center">
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
      <div className="min-h-screen bg-[#0a0a0b] px-3 py-4 md:px-6 md:py-6">
        <MeetRoomClient
          meetingId={session.meetingId}
          title={session.title}
          code={session.code}
          displayName={session.name}
          guestMode
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
      preview?.getTracks().forEach((t) => t.stop());
      setSession({
        meetingId: json.meeting.id,
        title: json.meeting.title,
        code: json.meeting.code,
        name: name.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Join failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b] px-4 py-12">
      <div className="w-full max-w-lg space-y-5">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#121214] shadow-2xl">
          <div className="relative aspect-video bg-black">
            {previewReady ? (
              <video
                ref={previewRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full scale-x-[-1] object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
                <Video className="h-8 w-8" />
                <p className="text-xs">Camera preview unavailable — you can still join</p>
              </div>
            )}
            <div className="pointer-events-none absolute left-3 top-3 select-none text-3xl font-black tracking-tight text-white/20">
              ST
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#121214] p-6 shadow-2xl md:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-300/85">
            Story Time Meet
          </p>
          <h1 className="mt-3 font-display text-2xl font-semibold leading-snug text-white">
            {props.meetingTitle || "Join as guest"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            You’ve been invited to a live Meet. Enter your name to join the waiting room — no Story
            Time account required. The host will admit you.
          </p>
          <p className="mt-2 text-xs text-slate-500">Meeting code · {props.code}</p>

          <form
            className="mt-6 space-y-4"
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
                className="border-white/10 bg-black/40 text-white"
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
                className="border-white/10 bg-black/40 text-white"
              />
            </label>
            {error ? <p className="text-xs text-red-300">{error}</p> : null}
            <Button
              type="submit"
              className="w-full bg-orange-500 text-white hover:bg-orange-400"
              disabled={busy || name.trim().length < 2}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Ask to join
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
