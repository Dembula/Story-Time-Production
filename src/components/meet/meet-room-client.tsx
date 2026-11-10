"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MoreHorizontal, X } from "lucide-react";
import { useMeetRtc } from "@/hooks/use-meet-rtc";
import { MeetStage } from "@/components/meet/meet-stage";
import { MeetRemoteTiles } from "@/components/meet/remote-tiles";
import { MeetControlBar } from "@/components/meet/meet-control-bar";
import { MeetInviteDialog } from "@/components/meet/invite-dialog";
import { MEET_MAX_PARTICIPANTS } from "@/lib/meet/limits";

type Props = {
  meetingId: string;
  title: string;
  code: string;
  displayName: string;
  guestMode?: boolean;
  minimized?: boolean;
  onMinimize?: () => void;
  onExpand?: () => void;
  onEnded?: () => void;
  /** When true, skip router leave navigation (provider clears the call instead). */
  persistAcrossNavigation?: boolean;
};

async function acquireMedia(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return await navigator.mediaDevices.getUserMedia({ video: true });
    }
  }
}

export function MeetRoomClient(props: Props) {
  const router = useRouter();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [showPeople, setShowPeople] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [localReaction, setLocalReaction] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [waitingRoomLocked, setWaitingRoomLocked] = useState(true);
  const [hostMenuPeer, setHostMenuPeer] = useState<string | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  localStreamRef.current = localStream;

  const [joined, setJoined] = useState(Boolean(props.guestMode));
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const cleanupMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current?.getTracks().forEach((t) => t.stop());
    screenRef.current = null;
    setLocalStream(null);
    setScreenStream(null);
    setIsScreenSharing(false);
  }, []);

  const leaveCall = useCallback(
    async (opts?: { endReport?: boolean; navigate?: boolean }) => {
      cleanupMedia();
      try {
        await fetch(`/api/meet/rtc/${props.meetingId}/leave`, {
          method: "POST",
          credentials: "include",
        });
      } catch {
        /* ignore */
      }
      if (opts?.endReport !== false && !props.guestMode) {
        try {
          await fetch("/api/meet/va", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              mode: "report",
              meetingId: props.meetingId,
              endMeeting: true,
            }),
          });
        } catch {
          /* ignore */
        }
      }
      props.onEnded?.();
      if (opts?.navigate === false) return;
      if (!props.guestMode) {
        router.push("/creator/meet/summaries");
        return;
      }
      router.push(`/meet/${props.code}?left=1`);
    },
    [cleanupMedia, props, router],
  );

  const rtc = useMeetRtc({
    meetingId: props.meetingId,
    enabled: joined,
    localStream,
    onSpeech: (_from, text) => {
      setNotes((n) => [...n, text]);
      if (!props.guestMode && text.trim()) {
        void fetch("/api/meet/va", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            mode: "note",
            meetingId: props.meetingId,
            body: text,
            source: "SPEECH",
          }),
        });
      }
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
      flash(reason === "ended" ? "Host ended the meeting" : "Host removed you from the meeting");
      void leaveCall({
        endReport: reason === "ended" && !props.guestMode,
        navigate: true,
      });
    },
  });

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
        const stream = await acquireMedia();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setLocalStream(stream);
        setIsMuted(!stream.getAudioTracks()[0]?.enabled);
        setIsVideoOff(!stream.getVideoTracks()[0]?.enabled);
      } catch {
        setToast("Camera/mic permission denied — you can still join with audio-only if available.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.guestMode, props.meetingId]);

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

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
    rtc.setVideoOverride(null);
  }, [rtc]);

  const toggleScreen = async () => {
    if (screenRef.current) {
      stopScreen();
      flash("Screen sharing stopped");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      screenRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);
      track?.addEventListener("ended", () => stopScreen());
      if (track) rtc.setVideoOverride(track);
      flash("Sharing your screen — minimize to keep using Story Time");
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
    setNotes((n) => [...n, body]);
    setNoteDraft("");
    if (!props.guestMode) {
      await fetch("/api/meet/va", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode: "note", meetingId: props.meetingId, body }),
      });
    }
  };

  const guestUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/meet/${props.code}`
      : `/meet/${props.code}`;

  if (rtc.status === "waiting") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121214] p-8 shadow-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-300/85">
            Story Time Meet
          </p>
          <div className="mx-auto mt-5 h-12 w-12 animate-pulse rounded-full border border-orange-400/30 bg-orange-500/10" />
          <h1 className="mt-5 text-xl font-semibold text-white">Waiting for host…</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            You’re in the lobby for <span className="text-slate-200">{props.title}</span>. The host
            will admit you shortly.
          </p>
          <p className="mt-3 font-mono text-xs text-slate-500">{props.code}</p>
        </div>
      </div>
    );
  }

  if (props.minimized) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#121214] shadow-2xl ring-1 ring-orange-400/20">
        <button
          type="button"
          onClick={props.onExpand}
          className="flex w-full items-center justify-between gap-2 border-b border-white/8 px-3 py-2 text-left hover:bg-white/[0.03]"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{props.title}</p>
            <p className="text-[10px] uppercase tracking-wide text-orange-300/80">
              {isScreenSharing ? "Sharing · " : ""}
              Meet minimized — platform free to use
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-orange-500/15 px-2 py-1 text-[10px] text-orange-100">
            Expand
          </span>
        </button>
        <div className="aspect-video bg-black">
          <MeetStage
            localStream={localStream}
            isVideoOff={isVideoOff}
            isScreenSharing={isScreenSharing}
            screenStream={screenStream}
            displayName={props.displayName}
            reaction={localReaction}
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
        {toast ? (
          <p className="border-t border-white/8 px-3 py-1.5 text-[11px] text-slate-300">{toast}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-[#121214]/80 px-4 py-3 backdrop-blur">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-300/85">
            Story Time Meet
          </p>
          <h1 className="text-lg font-semibold text-white md:text-xl">{props.title}</h1>
          <p className="text-xs text-slate-400">
            <span className="font-mono">{props.code}</span>
            {rtc.status === "admitted"
              ? ` · ${rtc.capacity?.occupied ?? rtc.remotes.length + 1}/${
                  rtc.capacity?.capacity ?? MEET_MAX_PARTICIPANTS
                } in call`
              : " · Connecting…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!props.guestMode ? (
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="rounded-xl bg-orange-500/15 px-3 py-2 text-sm text-orange-100 ring-1 ring-orange-400/25 hover:bg-orange-500/25"
            >
              Invite
            </button>
          ) : null}
          {props.onMinimize ? (
            <button
              type="button"
              onClick={props.onMinimize}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.08]"
            >
              Minimize
            </button>
          ) : null}
        </div>
      </header>

      {toast ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200">
          {toast}
        </div>
      ) : null}
      {rtc.error ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {rtc.error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          <MeetStage
            localStream={localStream}
            isVideoOff={isVideoOff}
            isScreenSharing={isScreenSharing}
            screenStream={screenStream}
            displayName={props.displayName}
            reaction={localReaction}
          />
          <MeetRemoteTiles peers={rtc.remotes} />
          <MeetControlBar
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            isScreenSharing={isScreenSharing}
            showMinimize={Boolean(props.onMinimize)}
            showHostMenu={rtc.isManager && !props.guestMode}
            waitingRoomLocked={waitingRoomLocked}
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
                if (ok) await leaveCall({ endReport: true });
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

        {(showPeople || showNotes) && (
          <aside className="space-y-3">
            {showPeople ? (
              <div className="creator-glass-panel rounded-2xl p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-white">Participants</h2>
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                    {rtc.capacity?.occupied ?? rtc.remotes.length + 1}/
                    {rtc.capacity?.capacity ?? MEET_MAX_PARTICIPANTS}
                  </span>
                </div>
                {rtc.capacity?.isFull ? (
                  <p className="mb-3 rounded-lg border border-amber-400/25 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-100">
                    Room is full (max {MEET_MAX_PARTICIPANTS}). New joiners can’t enter until someone
                    leaves.
                  </p>
                ) : null}
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
                          {r.role === "CO_HOST" ? (
                            <span className="ml-1 text-[10px] uppercase text-orange-300/70">
                              co-host
                            </span>
                          ) : null}
                          {r.isMuted ? (
                            <span className="ml-1 text-[10px] uppercase text-slate-500">muted</span>
                          ) : null}
                        </span>
                        {rtc.isManager && !props.guestMode ? (
                          <button
                            type="button"
                            className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                            onClick={() =>
                              setHostMenuPeer((cur) => (cur === r.peerId ? null : r.peerId))
                            }
                            title="Host controls"
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
                                label={r.role === "CO_HOST" ? "Demote" : "Co-host"}
                                onClick={() => {
                                  void hostAction(
                                    r.role === "CO_HOST" ? "demote_participant" : "promote_cohost",
                                    { participantId: r.participantId! },
                                  ).then((ok) => ok && flash("Role updated"));
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
                  <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
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
              <div className="creator-glass-panel rounded-2xl p-4">
                <h2 className="mb-1 text-sm font-semibold text-white">VA notes</h2>
                <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
                  Capture decisions and next steps live — the VA turns these into a polished
                  summary when the Meet ends.
                </p>
                <div className="mb-3 max-h-48 space-y-1 overflow-y-auto text-xs text-slate-300">
                  {notes.length === 0 ? (
                    <p className="text-slate-500">Notes and speech snippets appear here.</p>
                  ) : (
                    notes.map((n, i) => (
                      <p key={`${i}-${n.slice(0, 12)}`} className="rounded bg-black/30 px-2 py-1">
                        {n}
                      </p>
                    ))
                  )}
                </div>
                {!props.guestMode ? (
                  <div className="flex gap-2">
                    <input
                      className="flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white"
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Decision, blocker, or action…"
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
