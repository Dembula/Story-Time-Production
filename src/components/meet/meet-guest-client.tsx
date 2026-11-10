"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";
import { MeetRoomClient } from "@/components/meet/meet-room-client";

type Props = {
  code: string;
  meetingTitle?: string | null;
  meetingId?: string | null;
  ended?: boolean;
  requiresPasscode?: boolean;
  waitingRoom?: boolean;
};

type DeviceLists = {
  audioIn: MediaDeviceInfo[];
  audioOut: MediaDeviceInfo[];
  videoIn: MediaDeviceInfo[];
};

const NAME_KEY = "st-meet-guest-name";

function deviceLabel(d: MediaDeviceInfo, fallback: string) {
  return d.label?.trim() || fallback;
}

export function MeetGuestClient(props: Props) {
  const router = useRouter();
  const search = useSearchParams();
  const left = search.get("left") === "1";
  const linkPasscode = search.get("passcode")?.trim() || "";

  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState(linkPasscode);
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
  const streamRef = useRef<MediaStream | null>(null);
  const handedOffRef = useRef(false);

  const [preview, setPreview] = useState<MediaStream | null>(null);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [devices, setDevices] = useState<DeviceLists>({
    audioIn: [],
    audioOut: [],
    videoIn: [],
  });
  const [micId, setMicId] = useState("");
  const [speakerId, setSpeakerId] = useState("");
  const [cameraId, setCameraId] = useState("");
  const [mediaError, setMediaError] = useState<string | null>(null);

  const passcodeLockedInLink = Boolean(linkPasscode);
  const showPasscodeField = Boolean(props.requiresPasscode) && !passcodeLockedInLink;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved) setName(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const next: DeviceLists = {
        audioIn: list.filter((d) => d.kind === "audioinput"),
        audioOut: list.filter((d) => d.kind === "audiooutput"),
        videoIn: list.filter((d) => d.kind === "videoinput"),
      };
      setDevices(next);
      setMicId((prev) => prev || next.audioIn[0]?.deviceId || "");
      setSpeakerId((prev) => prev || next.audioOut[0]?.deviceId || "");
      setCameraId((prev) => prev || next.videoIn[0]?.deviceId || "");
    } catch {
      /* ignore */
    }
  }, []);

  const startPreview = useCallback(
    async (opts?: { videoDeviceId?: string; audioDeviceId?: string; withVideo?: boolean }) => {
      const wantVideo = opts?.withVideo ?? camOn;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            ...(opts?.audioDeviceId || micId
              ? { deviceId: { exact: opts?.audioDeviceId || micId } }
              : {}),
          },
          video: wantVideo
            ? {
                facingMode: "user",
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30, max: 30 },
                ...(opts?.videoDeviceId || cameraId
                  ? { deviceId: { exact: opts?.videoDeviceId || cameraId } }
                  : {}),
              }
            : false,
        });
        if (!handedOffRef.current) {
          streamRef.current?.getTracks().forEach((t) => t.stop());
        }
        for (const track of stream.getAudioTracks()) track.enabled = micOn;
        for (const track of stream.getVideoTracks()) track.enabled = wantVideo;
        streamRef.current = stream;
        setPreview(stream);
        setMediaError(null);
        await refreshDevices();
        return stream;
      } catch {
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
          if (!handedOffRef.current) {
            streamRef.current?.getTracks().forEach((t) => t.stop());
          }
          for (const track of audioOnly.getAudioTracks()) track.enabled = micOn;
          streamRef.current = audioOnly;
          setPreview(audioOnly);
          setCamOn(false);
          setMediaError("Camera unavailable — you can still join with audio.");
          await refreshDevices();
          return audioOnly;
        } catch {
          setMediaError("Could not access camera/mic. You can still join — enable access for best quality.");
          setPreview(null);
          return null;
        }
      }
    },
    [camOn, cameraId, micId, micOn, refreshDevices],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stream = await startPreview({ withVideo: true });
      if (cancelled && stream && !handedOffRef.current) {
        stream.getTracks().forEach((t) => t.stop());
      }
    })();
    return () => {
      cancelled = true;
      if (!handedOffRef.current) {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
    // Initial lobby mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (previewRef.current && preview) {
      previewRef.current.srcObject = preview;
      void previewRef.current.play().catch(() => undefined);
    }
  }, [preview]);

  useEffect(() => {
    const el = previewRef.current as HTMLVideoElement & {
      setSinkId?: (id: string) => Promise<void>;
    } | null;
    if (!el?.setSinkId || !speakerId) return;
    void el.setSinkId(speakerId).catch(() => undefined);
  }, [speakerId, preview]);

  const toggleCamera = async () => {
    const next = !camOn;
    setCamOn(next);
    if (next) {
      await startPreview({ withVideo: true });
      return;
    }
    preview?.getVideoTracks().forEach((t) => {
      t.enabled = false;
      t.stop();
      preview.removeTrack(t);
    });
    setPreview(preview ? new MediaStream(preview.getTracks()) : null);
  };

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    preview?.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
  };

  const canJoin = name.trim().length >= 2 && (!showPasscodeField || passcode.trim().length > 0);

  async function join() {
    if (!canJoin) return;
    setBusy(true);
    setError(null);
    try {
      try {
        localStorage.setItem(NAME_KEY, name.trim());
      } catch {
        /* ignore */
      }
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

      const stream = streamRef.current;
      if (stream) {
        stream.getAudioTracks().forEach((t) => {
          t.enabled = micOn;
        });
        stream.getVideoTracks().forEach((t) => {
          t.enabled = camOn;
        });
      }
      handedOffRef.current = true;
      setSession({
        meetingId: json.meeting.id,
        title: json.meeting.title,
        code: json.meeting.code,
        name: name.trim(),
        stream,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Join failed");
    } finally {
      setBusy(false);
    }
  }

  const headerTitle = useMemo(
    () => props.meetingTitle?.trim() || "Story Time Meet",
    [props.meetingTitle],
  );

  if (props.ended || left) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-[#0a0a0b] px-6 text-center">
        <Video className="h-10 w-10 text-slate-600" />
        <h1 className="text-lg font-semibold text-white">
          {left ? "You’ve left the meeting" : "This meeting isn’t available"}
        </h1>
        <p className="max-w-md text-sm text-slate-400">
          {left
            ? "Thanks for joining Story Time Meet. You can close this tab."
            : "This Meet ended or was cancelled by the host. Ask them for a new invite if you still need to meet."}
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

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#1b1a19] text-white">
      {/* Top brand + meeting title */}
      <header className="flex flex-col items-center px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] text-center">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/st-mark.png" alt="" className="h-7 w-auto object-contain opacity-95" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300/90">
            Story Time Meet
          </p>
        </div>
        <h1 className="mt-3 max-w-3xl text-balance text-xl font-semibold tracking-tight text-white sm:text-2xl md:text-[1.65rem]">
          {headerTitle}
        </h1>
        <p className="mt-1.5 text-xs text-slate-400">
          {props.waitingRoom === false
            ? "Check your devices, then join the meeting."
            : "Check your devices, then join the lobby — the host will admit you."}
        </p>
      </header>

      {/* Main lobby card — Teams-style two column */}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-3 pb-4 pt-2 sm:px-6 lg:flex-row lg:items-stretch lg:gap-5 lg:pb-6">
        {/* Camera preview */}
        <section className="relative flex min-h-[240px] flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#11100f] shadow-2xl lg:min-h-[360px]">
          {camOn && preview?.getVideoTracks().some((t) => t.readyState === "live") ? (
            <video
              ref={previewRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#161514]">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                <VideoOff className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-300">Your camera is turned off</p>
              {mediaError ? (
                <p className="max-w-xs px-4 text-center text-[11px] text-slate-500">{mediaError}</p>
              ) : null}
            </div>
          )}

          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void toggleCamera()}
              className={[
                "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-medium backdrop-blur-md touch-manipulation",
                camOn
                  ? "border-white/15 bg-black/55 text-white hover:bg-black/70"
                  : "border-rose-400/30 bg-rose-500/25 text-rose-50",
              ].join(" ")}
            >
              {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              {camOn ? "Camera on" : "Camera off"}
            </button>
            {devices.videoIn.length > 1 && camOn ? (
              <select
                value={cameraId}
                onChange={(e) => {
                  const id = e.target.value;
                  setCameraId(id);
                  void startPreview({ videoDeviceId: id, withVideo: true });
                }}
                className="min-h-10 max-w-[14rem] truncate rounded-lg border border-white/15 bg-black/55 px-2 text-xs text-white backdrop-blur-md outline-none"
              >
                {devices.videoIn.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {deviceLabel(d, `Camera ${i + 1}`)}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </section>

        {/* Audio + identity */}
        <section className="flex w-full flex-col justify-between gap-4 rounded-xl border border-white/10 bg-[#201f1e] p-4 shadow-2xl lg:w-[22.5rem] lg:shrink-0 lg:p-5">
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Computer audio
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Choose the mic and speakers you’ll use in this Meet.
              </p>
            </div>

            <div className="space-y-3 rounded-xl border border-white/8 bg-black/25 p-3">
              <label className="block space-y-1.5">
                <span className="flex items-center justify-between text-[11px] font-medium text-slate-300">
                  Microphone
                  <button
                    type="button"
                    onClick={toggleMic}
                    className={[
                      "inline-flex h-8 w-8 items-center justify-center rounded-full touch-manipulation",
                      micOn ? "bg-white/10 text-white" : "bg-rose-500/30 text-rose-50",
                    ].join(" ")}
                    title={micOn ? "Mute" : "Unmute"}
                  >
                    {micOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                  </button>
                </span>
                <select
                  value={micId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setMicId(id);
                    void startPreview({ audioDeviceId: id, withVideo: camOn });
                  }}
                  className="h-11 w-full rounded-lg border border-white/10 bg-[#121110] px-3 text-sm text-white outline-none focus:border-orange-400/40"
                >
                  {(devices.audioIn.length ? devices.audioIn : [{ deviceId: "", label: "Default microphone" } as MediaDeviceInfo]).map(
                    (d, i) => (
                      <option key={d.deviceId || `mic-${i}`} value={d.deviceId}>
                        {deviceLabel(d, `Microphone ${i + 1}`)}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
                  <Volume2 className="h-3.5 w-3.5 text-slate-500" />
                  Speakers
                </span>
                <select
                  value={speakerId}
                  onChange={(e) => setSpeakerId(e.target.value)}
                  className="h-11 w-full rounded-lg border border-white/10 bg-[#121110] px-3 text-sm text-white outline-none focus:border-orange-400/40"
                >
                  {(devices.audioOut.length
                    ? devices.audioOut
                    : [{ deviceId: "", label: "Default speakers" } as MediaDeviceInfo]
                  ).map((d, i) => (
                    <option key={d.deviceId || `spk-${i}`} value={d.deviceId}>
                      {deviceLabel(d, `Speakers ${i + 1}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium text-slate-300">Your name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="How should others see you?"
                required
                minLength={2}
                autoComplete="name"
                className="h-11 w-full rounded-lg border border-white/10 bg-[#121110] px-3 text-base text-white outline-none placeholder:text-slate-600 focus:border-orange-400/40 sm:text-sm"
              />
            </label>

            {showPasscodeField ? (
              <label className="block space-y-1.5">
                <span className="text-[11px] font-medium text-slate-300">Passcode</span>
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Required by host"
                  className="h-11 w-full rounded-lg border border-white/10 bg-[#121110] px-3 text-base text-white outline-none focus:border-orange-400/40 sm:text-sm"
                />
              </label>
            ) : passcodeLockedInLink ? (
              <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-100/90">
                Passcode included in your invite link — you’re ready to join.
              </p>
            ) : null}

            {error ? (
              <p className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="order-2 min-h-11 rounded-lg border border-white/15 bg-transparent px-4 text-sm font-medium text-slate-200 touch-manipulation hover:bg-white/[0.06] sm:order-1"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy || !canJoin}
              onClick={() => void join()}
              className="order-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-orange-500 px-5 text-sm font-semibold text-white touch-manipulation hover:bg-orange-400 disabled:opacity-50 sm:order-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Join now
            </button>
          </div>
        </section>
      </main>

      <footer className="pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 text-center text-[11px] text-slate-500">
        Meeting secured by invite link
        {props.requiresPasscode ? " · passcode protected" : ""} · no account required
      </footer>
    </div>
  );
}
