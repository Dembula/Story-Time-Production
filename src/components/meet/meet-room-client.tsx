"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Check, MoreHorizontal, X } from "lucide-react";
import { useMeetRtc } from "@/hooks/use-meet-rtc";
import { useMeetSpeech } from "@/hooks/use-meet-speech";
import { useMeetRecorder } from "@/hooks/use-meet-recorder";
import { MeetVideoGrid } from "@/components/meet/meet-video-grid";
import { MeetControlBar } from "@/components/meet/meet-control-bar";
import { MeetInviteDialog } from "@/components/meet/invite-dialog";
import { MEET_MAX_PARTICIPANTS } from "@/lib/meet/limits";
import { noteFromDbRow, type MeetNoteView } from "@/lib/meet/notes";

type Props = {
  meetingId: string;
  title: string;
  code: string;
  displayName: string;
  guestMode?: boolean;
  /** Reuse preview camera/mic from guest lobby instead of re-prompting. */
  initialStream?: MediaStream | null;
  minimized?: boolean;
  onMinimize?: () => void;
  onExpand?: () => void;
  onEnded?: () => void;
  persistAcrossNavigation?: boolean;
};

type CallPhase = "live" | "ending" | "ended";

function isMobileUa() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

async function waitTrackReady(track: MediaStreamTrack, ms = 2800) {
  if (track.readyState === "live" && !track.muted) return;
  await new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      track.removeEventListener("unmute", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    track.addEventListener("unmute", done, { once: true });
  });
}

async function acquireMedia(): Promise<MediaStream> {
  const mobile = isMobileUa();
  const audio: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
  const video: MediaTrackConstraints = {
    facingMode: "user",
    width: { ideal: mobile ? 720 : 1280 },
    height: { ideal: mobile ? 1280 : 720 },
    frameRate: { ideal: mobile ? 24 : 30, max: 30 },
  };

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video, audio });
  } catch {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio, video: true });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
    }
  }

  for (const track of stream.getTracks()) {
    track.enabled = true;
    if (track.kind === "video") {
      try {
        track.contentHint = "motion";
      } catch {
        /* ignore */
      }
    }
    await waitTrackReady(track);
  }
  return stream;
}

/** Merge consecutive same-speaker speech into one attentive note row. */
function appendSpeechNote(
  prev: MeetNoteView[],
  input: { text: string; speakerName: string; speakerPeerId?: string | null },
): MeetNoteView[] {
  const text = input.text.trim();
  if (!text) return prev;
  const last = prev[prev.length - 1];
  const sameSpeaker =
    last &&
    last.source === "SPEECH" &&
    ((input.speakerPeerId && last.speakerPeerId === input.speakerPeerId) ||
      (!input.speakerPeerId && last.speakerName === input.speakerName));
  const recent =
    last && Date.now() - new Date(last.at).getTime() < 14_000;
  if (sameSpeaker && recent) {
    const next = [...prev];
    next[next.length - 1] = {
      ...last,
      text: `${last.text} ${text}`.replace(/\s+/g, " ").trim(),
      at: new Date().toISOString(),
    };
    return next;
  }
  return [
    ...prev,
    {
      text,
      speakerName: input.speakerName,
      speakerPeerId: input.speakerPeerId ?? null,
      source: "SPEECH",
      at: new Date().toISOString(),
    },
  ];
}

export function MeetRoomClient(props: Props) {
  const router = useRouter();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [showPeople, setShowPeople] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [notes, setNotes] = useState<MeetNoteView[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [speechInterim, setSpeechInterim] = useState("");
  const [localReaction, setLocalReaction] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [waitingRoomLocked, setWaitingRoomLocked] = useState(true);
  const [hostMenuPeer, setHostMenuPeer] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<CallPhase>("live");
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const [wrapProgress, setWrapProgress] = useState(0);
  const [wrapLabel, setWrapLabel] = useState("Finishing call…");
  const screenRef = useRef<MediaStream | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  localStreamRef.current = localStream;
  const remotesRef = useRef<{ peerId: string; name: string }[]>([]);
  const leavingRef = useRef(false);
  const backgroundFinalizeRef = useRef(false);
  const recorder = useMeetRecorder();

  const [joined, setJoined] = useState(Boolean(props.guestMode));
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const cleanupMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current = null;
    setLocalStream(null);
    setScreenStream(null);
    setIsScreenSharing(false);
  }, []);

  const finishToEnded = useCallback((opts?: { summaryId?: string | null }) => {
    setPhase("ended");
    if (opts?.summaryId) setSummaryId(opts.summaryId);
    // Keep MeetLiveProvider mounted so the exit/summary screen stays visible.
  }, []);

  const exitMeeting = useCallback(
    (dest: "summary" | "hub" | "guest") => {
      props.onEnded?.();
      if (dest === "summary") router.push("/creator/meet/summaries");
      else if (dest === "hub") router.push("/creator/meet");
      else router.push(`/meet/${props.code}?left=1`);
    },
    [props, router],
  );

  const continueInBackground = useCallback(() => {
    backgroundFinalizeRef.current = true;
    props.onEnded?.();
    if (!props.guestMode) router.push("/creator/meet");
    else router.push(`/meet/${props.code}?left=1`);
  }, [props, router]);

  const leaveCall = useCallback(
    async (opts?: { endReport?: boolean; endForAllAlready?: boolean }) => {
      if (leavingRef.current) return;
      leavingRef.current = true;
      backgroundFinalizeRef.current = false;
      setPhase("ending");
      setWrapProgress(8);
      setWrapLabel("Leaving the call…");

      // Leave RTC immediately so peers aren't stuck waiting on upload.
      try {
        await fetch(`/api/meet/rtc/${props.meetingId}/leave`, {
          method: "POST",
          credentials: "include",
        });
      } catch {
        /* ignore */
      }
      setWrapProgress(22);
      setWrapLabel("Stopping recording…");

      let blob: Blob | null = null;
      try {
        blob = await Promise.race([
          recorder.stop(),
          new Promise<null>((r) => setTimeout(() => r(null), 8000)),
        ]);
      } catch {
        blob = null;
      }

      cleanupMedia();
      setWrapProgress(40);

      if (props.guestMode || opts?.endReport === false) {
        setWrapProgress(100);
        finishToEnded({});
        return;
      }

      setWrapLabel(blob ? "Uploading recording…" : "Building VA summary…");

      const finalizePromise = (async () => {
        let recordingUrl: string | null = null;
        if (blob) {
          try {
            const file = new File([blob], `meet-${props.meetingId}.webm`, {
              type: blob.type || "video/webm",
            });
            const { uploadContentMediaViaApi } = await import(
              "@/lib/upload-content-media-client"
            );
            recordingUrl = await uploadContentMediaViaApi(file);
            setWrapProgress((p) => Math.max(p, 70));
            setWrapLabel("Building VA summary…");
          } catch {
            setWrapLabel("Recording upload skipped — building summary…");
          }
        } else {
          setWrapProgress(65);
          setWrapLabel("Building VA summary…");
        }

        const res = await fetch("/api/meet/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            meetingId: props.meetingId,
            recordingUrl,
            notify: true,
          }),
        });
        const json = await res.json().catch(() => ({}));
        return (json?.summary?.id as string | undefined) ?? null;
      })();

      // Never trap the host on this screen forever.
      const nextSummaryId = await Promise.race([
        finalizePromise,
        new Promise<null>((r) => {
          setTimeout(() => {
            setWrapLabel("Still saving in the background…");
            setWrapProgress((p) => Math.max(p, 85));
            r(null);
          }, 25000);
        }),
      ]);

      if (backgroundFinalizeRef.current) {
        // User already left the wrap-up UI — keep finalize running without flipping UI.
        if (nextSummaryId == null) void finalizePromise;
        return;
      }

      if (nextSummaryId == null) {
        // Timed out — continue finalize quietly and unlock the exit UI.
        void finalizePromise;
        setWrapProgress(100);
        finishToEnded({});
        return;
      }

      setWrapProgress(100);
      finishToEnded({ summaryId: nextSummaryId });
    },
    [cleanupMedia, finishToEnded, props.guestMode, props.meetingId, recorder],
  );

  const rtc = useMeetRtc({
    meetingId: props.meetingId,
    enabled: joined && phase === "live",
    localStream,
    onSpeech: (fromPeer, text, speakerName) => {
      const name =
        speakerName?.trim() ||
        remotesRef.current.find((r) => r.peerId === fromPeer)?.name ||
        "Participant";
      setNotes((prev) => appendSpeechNote(prev, { text, speakerName: name, speakerPeerId: fromPeer }));
    },
    onReaction: (_from, emoji) => {
      setLocalReaction(emoji);
      if (reactionTimer.current) clearTimeout(reactionTimer.current);
      reactionTimer.current = setTimeout(() => setLocalReaction(null), 2500);
    },
    onHostForceMute: () => {
      const track = localStreamRef.current?.getAudioTracks()[0];
      if (track) track.enabled = false;
      setIsMuted(true);
      flash("Host muted your microphone");
    },
    onRemovedByHost: (reason) => {
      flash(reason === "ended" ? "Host ended the meeting" : "Removed from the meeting");
      void leaveCall({ endReport: reason === "ended" && !props.guestMode });
    },
    onMeetingClosed: (reason) => {
      if (leavingRef.current || phase !== "live") return;
      void leaveCall({ endReport: reason === "ended" && !props.guestMode });
    },
    onRemotePin: (tileId) => {
      // tileId is already normalized (e.g. screen-{peerId}) by the RTC hook.
      setPinnedId(tileId);
    },
  });

  remotesRef.current = rtc.remotes.map((r) => ({ peerId: r.peerId, name: r.name }));

  useMeetSpeech({
    // Capture speech for hosts and guests so the VA can attribute everyone.
    enabled: joined && phase === "live",
    muted: isMuted,
    onInterim: setSpeechInterim,
    onFinal: (text) => {
      setSpeechInterim("");
      setNotes((prev) =>
        appendSpeechNote(prev, {
          text,
          speakerName: props.displayName,
          speakerPeerId: rtc.peerId,
        }),
      );
      // Canonical persist + broadcast (speaker-attributed). No /api/meet/va SPEECH double-write.
      void rtc.sendSpeech(text, props.displayName);
    },
  });

  // Hydrate speaker-attributed notes when (re)joining so the panel isn't session-only.
  useEffect(() => {
    if (!joined || props.guestMode || phase !== "live") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/meet/va?meetingId=${encodeURIComponent(props.meetingId)}`, {
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as {
          notes?: Array<{
            id: string;
            body: string;
            source: string;
            speakerName?: string | null;
            speakerPeerId?: string | null;
            createdAt: string;
          }>;
        };
        if (cancelled || !json.notes?.length) return;
        setNotes((prev) => {
          if (prev.length) return prev;
          return json.notes!.map((n) => noteFromDbRow(n));
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [joined, phase, props.guestMode, props.meetingId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!props.guestMode) {
        try {
          const res = await fetch(`/api/meet/meetings/${props.meetingId}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ joinIntent: "participant" }),
          });
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            if (!cancelled) setToast(json.error || "Could not join meeting session");
            return;
          }
        } catch {
          if (!cancelled) setToast("Could not join meeting session");
          return;
        }
      }
      if (cancelled) return;
      setJoined(true);
      try {
        let stream = props.initialStream ?? null;
        if (stream) {
          for (const track of stream.getTracks()) track.enabled = true;
        } else {
          stream = await acquireMedia();
        }
        if (cancelled) {
          if (!props.initialStream) stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setLocalStream(stream);
        setIsMuted(!(stream.getAudioTracks()[0]?.enabled ?? false));
        setIsVideoOff(!(stream.getVideoTracks()[0]?.enabled ?? true));
      } catch {
        setToast("Camera/mic permission denied — enable access to speak and be heard.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.guestMode, props.initialStream, props.meetingId]);

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Surface waiting-room guests immediately on the people panel.
  useEffect(() => {
    if (rtc.isManager && rtc.waiting.length > 0) {
      setShowPeople(true);
    }
  }, [rtc.isManager, rtc.waiting.length]);

  const toggleMute = () => {
    const track = localStream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
    void rtc.sendMediaState({ isMuted: !track.enabled });
  };

  const toggleVideo = () => {
    const track = localStream?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setIsVideoOff(!track.enabled);
    void rtc.sendMediaState({ isVideoOff: !track.enabled });
  };

  const stopScreen = useCallback(() => {
    screenRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current = null;
    setScreenStream(null);
    setIsScreenSharing(false);
    rtc.setScreenShareTrack(null);
    void rtc.sendScreenShareState(false);
    if (pinnedId === "screen-local" || pinnedId?.startsWith("screen-")) {
      setPinnedId(null);
    }
  }, [pinnedId, rtc]);

  const toggleScreen = async () => {
    if (screenRef.current) {
      stopScreen();
      flash("Screen sharing stopped");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 15, max: 30 },
        } as MediaTrackConstraints,
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          track.contentHint = "detail";
        } catch {
          /* ignore */
        }
      }
      screenRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);
      // Sharer pins the Shared screen status tile (not a live mirror of their window).
      setPinnedId("screen-local");
      track?.addEventListener("ended", () => stopScreen());
      if (track) rtc.setScreenShareTrack(track);
      void rtc.sendScreenShareState(true);
      // Viewers normalize this to screen-{peerId} and pin the real shared feed.
      void rtc.sendPin(rtc.peerId ?? "screen-local", true);
      flash("Sharing screen — Shared screen is pinned for others");
    } catch {
      flash("Screen share cancelled");
    }
  };

  const hostAction = async (
    action:
      | "mute_participant"
      | "remove_participant"
      | "remove_guest"
      | "lock"
      | "unlock"
      | "end_for_all"
      | "promote_cohost"
      | "demote_participant",
    extra?: { participantId?: string; guestId?: string },
  ) => {
    const res = await fetch(`/api/meet/meetings/${props.meetingId}/host`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action, ...extra }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      flash(json.error || "Host action failed");
      return false;
    }
    return true;
  };

  const addNote = async () => {
    const body = noteDraft.trim();
    if (!body) return;
    setNotes((n) => [
      ...n,
      {
        text: body,
        speakerName: props.displayName,
        source: "MANUAL",
        at: new Date().toISOString(),
      },
    ]);
    setNoteDraft("");
    if (!props.guestMode) {
      await fetch("/api/meet/va", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode: "note", meetingId: props.meetingId, body, source: "MANUAL" }),
      });
    }
  };

  const guestUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/meet/${props.code}`
      : `/meet/${props.code}`;

  if (phase === "ending" || phase === "ended") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-black px-4 text-center">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121214]/95 p-8 shadow-2xl backdrop-blur-xl">
          <Image
            src="/st-mark.png"
            alt="Story Time"
            width={120}
            height={56}
            className="mx-auto h-12 w-auto object-contain"
          />
          <h1 className="mt-5 text-xl font-semibold text-white">
            {phase === "ending" ? "Wrapping up…" : "Meeting ended"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {phase === "ending"
              ? wrapLabel
              : props.guestMode
                ? "Thanks for joining Story Time Meet."
                : "Your VA summary is ready when you are."}
          </p>

          {phase === "ending" ? (
            <div className="mt-6 space-y-4">
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-orange-500 transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.min(100, Math.max(6, wrapProgress))}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500">
                {Math.min(100, Math.round(wrapProgress))}% — you can keep working while this
                finishes.
              </p>
              <div className="flex flex-col gap-2">
                {!props.guestMode ? (
                  <button
                    type="button"
                    className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-400"
                    onClick={continueInBackground}
                  >
                    Continue in background
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 hover:bg-white/[0.08]"
                  onClick={() => {
                    backgroundFinalizeRef.current = true;
                    exitMeeting(props.guestMode ? "guest" : "hub");
                  }}
                >
                  Exit meeting
                </button>
              </div>
              {!props.guestMode ? (
                <p className="text-[11px] text-slate-500">
                  We’ll notify you on the bell when the summary{recorder.recording ? "" : ""} is
                  ready.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-2">
              {!props.guestMode ? (
                <button
                  type="button"
                  className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-400"
                  onClick={() => exitMeeting("summary")}
                >
                  Go to summary
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 hover:bg-white/[0.08]"
                onClick={() => exitMeeting(props.guestMode ? "guest" : "hub")}
              >
                Exit meeting
              </button>
              {summaryId ? (
                <p className="text-[11px] text-slate-500">Summary saved for this Meet.</p>
              ) : (
                <p className="text-[11px] text-slate-500">
                  If saving is still running, check Summaries or your notification bell shortly.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (rtc.status === "waiting") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0a0a0b] px-4 py-10 text-center">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#121214]/95 p-7 shadow-2xl backdrop-blur-xl sm:p-8">
          <Image
            src="/st-mark.png"
            alt="Story Time"
            width={100}
            height={47}
            className="mx-auto h-10 w-auto object-contain opacity-90"
          />
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-300/85">
            Story Time Meet
          </p>
          <h1 className="mt-2 text-xl font-semibold text-white sm:text-2xl">Waiting for host…</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            You’re in the lobby for <span className="text-slate-200">{props.title}</span>. Keep this
            screen open — you’ll join as soon as you’re admitted.
          </p>
          <p className="mt-4 font-mono text-xs text-slate-500">{props.code}</p>
          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-orange-500/70" />
          </div>
        </div>
      </div>
    );
  }

  if (props.minimized) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#121214] shadow-2xl ring-1 ring-orange-400/25">
        <div className="flex items-center justify-between gap-2 border-b border-white/8 px-3 py-2">
          <div className="min-w-0 select-none">
            <p className="truncate text-sm font-medium text-white">{props.title}</p>
            <p className="text-[10px] uppercase tracking-wide text-orange-300/80">
              {isScreenSharing ? "Sharing · " : ""}
              Drag to move · Meet minimized
            </p>
          </div>
          <button
            type="button"
            onClick={props.onExpand}
            className="shrink-0 rounded-md bg-orange-500/20 px-2 py-1 text-[10px] font-medium text-orange-100 ring-1 ring-orange-400/30"
          >
            Expand
          </button>
        </div>
        <div className="aspect-video bg-black">
          <MeetVideoGrid
            local={{
              id: "local",
              name: props.displayName,
              stream: localStream,
              mirrored: true,
              isLocal: true,
              videoOff: isVideoOff,
              reaction: localReaction,
            }}
            remotes={rtc.remotes}
            localScreenSharing={isScreenSharing}
            pinnedId={pinnedId}
            onPin={setPinnedId}
          />
        </div>
        <div className="p-2">
          <MeetControlBar
            minimized
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            isScreenSharing={isScreenSharing}
            onToggleMute={toggleMute}
            onToggleVideo={toggleVideo}
            onToggleScreen={() => void toggleScreen()}
            onLeave={() => void leaveCall()}
            onCopyLink={() => undefined}
            onToggleParticipants={() => undefined}
            onToggleNotes={() => undefined}
            onReact={() => undefined}
            onExpand={props.onExpand}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-black">
      <MeetVideoGrid
        local={{
          id: "local",
          name: props.displayName,
          stream: localStream,
          mirrored: true,
          isLocal: true,
          videoOff: isVideoOff,
          reaction: localReaction,
        }}
        remotes={rtc.remotes}
        localScreenSharing={isScreenSharing}
        pinnedId={pinnedId}
        onPin={(id) => {
          setPinnedId(id);
          const isScreen = Boolean(id && (id === "screen-local" || id.startsWith("screen-")));
          void rtc.sendPin(id, isScreen);
        }}
      />

      {/* Hovering chrome */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/70 via-black/25 to-transparent p-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:p-3 md:p-4">
        <div className="pointer-events-auto flex flex-wrap items-start justify-between gap-2 rounded-2xl border border-white/10 bg-black/35 px-2.5 py-2 backdrop-blur-xl sm:gap-3 sm:px-3 sm:py-2.5 md:px-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Image
                src="/st-mark.png"
                alt="Story Time"
                width={64}
                height={30}
                className="h-5 w-auto object-contain sm:h-6"
              />
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-300/85">
                Meet
              </p>
              {isScreenSharing ? (
                <span className="rounded-md border border-orange-400/35 bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-medium text-orange-100">
                  Sharing screen
                </span>
              ) : null}
            </div>
            <h1 className="mt-1 truncate text-sm font-semibold text-white sm:text-base md:text-lg">
              {props.title}
            </h1>
            <p className="truncate text-[11px] text-slate-300/90 sm:text-xs">
              <span className="font-mono">{props.code}</span>
              {` · ${rtc.capacity?.occupied ?? rtc.remotes.length + 1}/${
                rtc.capacity?.capacity ?? MEET_MAX_PARTICIPANTS
              }`}
              {recorder.recording ? " · Recording" : ""}
              {rtc.status !== "admitted" ? " · Connecting…" : ""}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5 sm:gap-2">
            {pinnedId ? (
              <button
                type="button"
                onClick={() => {
                  setPinnedId(null);
                  void rtc.sendPin(null);
                }}
                className="min-h-10 rounded-xl border border-orange-400/30 bg-orange-500/20 px-2.5 py-2 text-xs text-orange-50 backdrop-blur touch-manipulation hover:bg-orange-500/30 sm:px-3 sm:text-sm"
              >
                Unpin
              </button>
            ) : null}
            {!props.guestMode ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowInvite(true)}
                  className="min-h-10 rounded-xl bg-orange-500/20 px-2.5 py-2 text-xs text-orange-50 ring-1 ring-orange-400/30 backdrop-blur touch-manipulation hover:bg-orange-500/30 sm:px-3 sm:text-sm"
                >
                  Invite
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void (async () => {
                      try {
                        if (recorder.recording) {
                          await recorder.stop();
                          flash("Recording stopped — it will attach when you leave");
                        } else {
                          await recorder.start({ localStream, screenStream });
                          flash("Recording started");
                        }
                      } catch (err) {
                        flash(err instanceof Error ? err.message : "Could not record");
                      }
                    })();
                  }}
                  className={[
                    "min-h-10 rounded-xl px-2.5 py-2 text-xs backdrop-blur ring-1 touch-manipulation sm:px-3 sm:text-sm",
                    recorder.recording
                      ? "bg-rose-500/25 text-rose-50 ring-rose-400/40"
                      : "border border-white/10 bg-white/10 text-white hover:bg-white/15",
                  ].join(" ")}
                >
                  {recorder.recording ? "Stop" : "Rec"}
                </button>
              </>
            ) : null}
            {props.onMinimize ? (
              <button
                type="button"
                onClick={props.onMinimize}
                className="hidden min-h-10 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white backdrop-blur touch-manipulation hover:bg-white/15 sm:inline-flex"
              >
                Minimize
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {toast || rtc.error ? (
        <div className="absolute left-1/2 top-24 z-30 w-[min(92vw,32rem)] -translate-x-1/2 space-y-2">
          {toast ? (
            <div className="rounded-xl border border-white/15 bg-black/55 px-3 py-2 text-center text-sm text-slate-100 backdrop-blur-xl">
              {toast}
            </div>
          ) : null}
          {rtc.error ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/20 px-3 py-2 text-center text-sm text-amber-50 backdrop-blur-xl">
              {rtc.error}
            </div>
          ) : null}
        </div>
      ) : null}

      {(showPeople || showNotes) && (
        <aside className="absolute bottom-28 right-3 top-24 z-20 w-[min(92vw,20rem)] space-y-3 overflow-y-auto">
          {showPeople ? (
            <div className="rounded-2xl border border-white/10 bg-black/55 p-4 backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">Participants</h2>
                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                  {rtc.capacity?.occupied ?? rtc.remotes.length + 1}/
                  {rtc.capacity?.capacity ?? MEET_MAX_PARTICIPANTS}
                </span>
              </div>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="rounded-lg border border-orange-400/15 bg-orange-500/10 px-2.5 py-1.5">
                  {props.displayName}{" "}
                  <span className="text-[10px] uppercase text-orange-200/70">
                    you{rtc.isManager ? " · host" : ""}
                  </span>
                </li>
                {rtc.remotes.map((r) => (
                  <li
                    key={r.peerId}
                    className="relative rounded-lg border border-white/6 bg-white/[0.04] px-2.5 py-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {r.name}
                        {r.isGuest ? (
                          <span className="ml-1 text-[10px] uppercase text-slate-500">guest</span>
                        ) : null}
                      </span>
                      {rtc.isManager && !props.guestMode ? (
                        <button
                          type="button"
                          className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                          onClick={() =>
                            setHostMenuPeer((cur) => (cur === r.peerId ? null : r.peerId))
                          }
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    {hostMenuPeer === r.peerId ? (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/8 pt-2">
                        {r.participantId ? (
                          <>
                            <HostChip
                              label="Mute"
                              onClick={() => {
                                void hostAction("mute_participant", {
                                  participantId: r.participantId!,
                                }).then((ok) => ok && flash(`Muted ${r.name}`));
                                setHostMenuPeer(null);
                              }}
                            />
                            <HostChip
                              label="Remove"
                              danger
                              onClick={() => {
                                void hostAction("remove_participant", {
                                  participantId: r.participantId!,
                                }).then((ok) => ok && flash(`Removed ${r.name}`));
                                setHostMenuPeer(null);
                              }}
                            />
                          </>
                        ) : null}
                        {r.guestId ? (
                          <HostChip
                            label="Remove guest"
                            danger
                            onClick={() => {
                              void hostAction("remove_guest", { guestId: r.guestId! }).then(
                                (ok) => ok && flash(`Removed ${r.name}`),
                              );
                              setHostMenuPeer(null);
                            }}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
              {rtc.isManager && rtc.waiting.length > 0 ? (
                <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/15 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-100">
                    Waiting room
                  </p>
                  {rtc.waiting.map((w) => (
                    <div key={w.id} className="mb-2 flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-white">{w.name}</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="rounded-md bg-emerald-600 p-1 text-white"
                          onClick={() => {
                            void rtc.admit(w.id, "admit").then((result) => {
                              if (!result.ok) flash(result.error);
                              else flash(`Admitted ${w.name}`);
                            });
                          }}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded-md bg-rose-600 p-1 text-white"
                          onClick={() => void rtc.admit(w.id, "deny")}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {showNotes ? (
            <div className="rounded-2xl border border-white/10 bg-black/55 p-4 backdrop-blur-xl">
              <div className="mb-1 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">VA notes</h2>
                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                  {notes.filter((n) => n.source === "SPEECH").length} spoken ·{" "}
                  {notes.filter((n) => n.source !== "SPEECH").length} pinned
                </span>
              </div>
              <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
                Attentive capture with speaker names. Keep your mic on in Chrome/Edge — the VA merges
                what each person says instead of dumping random fragments.
              </p>
              <div className="mb-3 max-h-52 space-y-1.5 overflow-y-auto text-xs text-slate-300">
                {notes.length === 0 && !speechInterim ? (
                  <p className="text-slate-500">Speaker notes appear here as people talk…</p>
                ) : (
                  <>
                    {notes.map((n, i) => (
                      <div
                        key={n.id ?? `${n.at}-${i}-${n.text.slice(0, 16)}`}
                        className={[
                          "rounded-lg px-2.5 py-1.5",
                          n.source === "SPEECH"
                            ? "border border-white/6 bg-black/35"
                            : "border border-orange-400/20 bg-orange-500/10",
                        ].join(" ")}
                      >
                        <div className="mb-0.5 flex items-center justify-between gap-2">
                          <span className="font-semibold text-orange-100/95">
                            {n.speakerName || (n.source === "MANUAL" ? props.displayName : "Speaker")}
                          </span>
                          <span className="text-[10px] uppercase tracking-wide text-slate-500">
                            {n.source === "SPEECH" ? "said" : "note"}
                          </span>
                        </div>
                        <p className="leading-relaxed text-slate-200">{n.text}</p>
                      </div>
                    ))}
                    {speechInterim ? (
                      <p className="rounded-lg border border-dashed border-white/10 bg-black/25 px-2.5 py-1.5 italic text-slate-500">
                        <span className="font-semibold not-italic text-slate-400">
                          {props.displayName}
                        </span>{" "}
                        · {speechInterim}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
              {!props.guestMode ? (
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Pin a decision or action…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void addNote();
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void addNote()}
                    className="rounded-lg bg-white/10 px-2 text-sm text-white"
                  >
                    Add
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-10 sm:px-3 sm:pb-4">
        <div className="pointer-events-auto mx-auto max-w-4xl">
          <MeetControlBar
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            isScreenSharing={isScreenSharing}
            showMinimize={Boolean(props.onMinimize)}
            showHostMenu={rtc.isManager && !props.guestMode}
            waitingRoomLocked={waitingRoomLocked}
            waitingCount={rtc.waiting.length}
            onToggleMute={toggleMute}
            onToggleVideo={toggleVideo}
            onToggleScreen={() => void toggleScreen()}
            onLeave={() => void leaveCall()}
            onCopyLink={() => {
              void navigator.clipboard.writeText(guestUrl);
              flash("Invite link copied");
            }}
            onToggleParticipants={() => setShowPeople((v) => !v)}
            onToggleNotes={() => setShowNotes((v) => !v)}
            onMinimize={props.onMinimize}
            onToggleLock={() => {
              void (async () => {
                const next = !waitingRoomLocked;
                const ok = await hostAction(next ? "lock" : "unlock");
                if (ok) {
                  setWaitingRoomLocked(next);
                  flash(next ? "Waiting room locked" : "Waiting room unlocked");
                }
              })();
            }}
            onEndForAll={() => {
              if (!confirm("End this Meet for everyone?")) return;
              void (async () => {
                const ok = await hostAction("end_for_all");
                if (ok) await leaveCall({ endReport: true, endForAllAlready: true });
              })();
            }}
            onReact={(emoji) => {
              setLocalReaction(emoji);
              void rtc.sendReaction(emoji);
              if (reactionTimer.current) clearTimeout(reactionTimer.current);
              reactionTimer.current = setTimeout(() => setLocalReaction(null), 2500);
            }}
          />
        </div>
      </div>

      {!props.guestMode ? (
        <MeetInviteDialog
          meetingId={props.meetingId}
          open={showInvite}
          onClose={() => setShowInvite(false)}
          guestUrl={guestUrl}
        />
      ) : null}
    </div>
  );
}

function HostChip({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md px-2 py-1 text-[10px] uppercase tracking-wide",
        danger
          ? "bg-rose-600/20 text-rose-200 ring-1 ring-rose-500/30"
          : "bg-white/10 text-slate-200 ring-1 ring-white/10",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
