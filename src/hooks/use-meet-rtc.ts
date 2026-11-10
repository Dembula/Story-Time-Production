"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MeetRemotePeer = {
  peerId: string;
  participantId?: string | null;
  guestId?: string | null;
  name: string;
  isGuest: boolean;
  role?: string;
  isMuted?: boolean;
  /** True when this peer is currently sending a screen share. */
  isScreenShare?: boolean;
  /** Camera (+ mic) stream. */
  stream: MediaStream;
  /** Separate screen-share video stream (not the camera). */
  screenStream?: MediaStream | null;
  reaction?: string | null;
};

type IceServer = RTCIceServer;

type PollSignal = {
  id: number;
  fromPeer: string;
  toPeer: string;
  type: string;
  payload: unknown;
};

type PeerMeta = {
  name: string;
  isGuest: boolean;
  participantId?: string | null;
  guestId?: string | null;
  role?: string;
  isMuted?: boolean;
  isScreenShare?: boolean;
};

type UseMeetRtcOptions = {
  meetingId: string | null;
  enabled: boolean;
  localStream: MediaStream | null;
  onSpeech?: (fromPeer: string, text: string, speakerName?: string | null) => void;
  onChat?: (msg: {
    fromPeer: string;
    text: string;
    speakerName?: string | null;
    at?: string | null;
    noteId?: string | null;
  }) => void;
  onReaction?: (fromPeer: string, emoji: string) => void;
  onHostForceMute?: () => void;
  onRemovedByHost?: (reason: "removed" | "ended") => void;
  onMeetingClosed?: (reason: "ended" | "left") => void;
  onRemotePin?: (tileId: string | null, isScreen?: boolean) => void;
};

function preferVideoQuality(sender: RTCRtpSender, detail?: boolean) {
  try {
    const params = sender.getParameters();
    if (!params.encodings?.length) {
      params.encodings = [{}];
    }
    // Prefer crisp camera + sharp screen share over bandwidth savings.
    params.encodings[0].maxBitrate = detail ? 3_500_000 : 2_500_000;
    params.encodings[0].maxFramerate = detail ? 30 : 30;
    params.encodings[0].scaleResolutionDownBy = 1;
    void sender.setParameters(params);
  } catch {
    /* ignore */
  }
}

function isPolitePeer(selfId: string | null | undefined, remoteId: string) {
  return String(selfId ?? "") > remoteId;
}

export function useMeetRtc(options: UseMeetRtcOptions) {
  const { meetingId, enabled, localStream } = options;
  const [remotes, setRemotes] = useState<MeetRemotePeer[]>([]);
  const [waiting, setWaiting] = useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = useState<"idle" | "connecting" | "admitted" | "waiting" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<{
    occupied: number;
    capacity: number;
    remaining: number;
    isFull: boolean;
  } | null>(null);
  const [schedule, setSchedule] = useState<{
    scheduledEndAt: string;
    pastEnd: boolean;
    autoEnded?: boolean;
    graceEndsAt: string;
    msUntilAutoEnd: number;
  } | null>(null);

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const cameraStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const screenStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  /** Inbound MediaStream id used for each peer's camera (mic/cam share this id). */
  const cameraInboundIdRef = useRef<Map<string, string>>(new Map());
  const namesRef = useRef<Map<string, PeerMeta>>(new Map());
  const afterRef = useRef(0);
  const iceServersRef = useRef<IceServer[]>([{ urls: "stun:stun.l.google.com:19302" }]);
  const makingOfferRef = useRef<Set<string>>(new Set());
  /** Outbound screen-share track (second video), kept alongside camera. */
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenOutboundStreamRef = useRef<MediaStream | null>(null);
  const screenSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const localStreamRef = useRef(localStream);
  localStreamRef.current = localStream;
  const onSpeechRef = useRef(options.onSpeech);
  onSpeechRef.current = options.onSpeech;
  const onChatRef = useRef(options.onChat);
  onChatRef.current = options.onChat;
  const onReactionRef = useRef(options.onReaction);
  onReactionRef.current = options.onReaction;
  const onHostForceMuteRef = useRef(options.onHostForceMute);
  onHostForceMuteRef.current = options.onHostForceMute;
  const onRemovedByHostRef = useRef(options.onRemovedByHost);
  onRemovedByHostRef.current = options.onRemovedByHost;
  const onMeetingClosedRef = useRef(options.onMeetingClosed);
  onMeetingClosedRef.current = options.onMeetingClosed;
  const onRemotePinRef = useRef(options.onRemotePin);
  onRemotePinRef.current = options.onRemotePin;
  const selfPeerIdRef = useRef<string | null>(null);
  const wasAdmittedRef = useRef(false);

  const publishRemotes = useCallback(() => {
    const list: MeetRemotePeer[] = [];
    for (const [id, stream] of cameraStreamsRef.current) {
      const meta = namesRef.current.get(id);
      list.push({
        peerId: id,
        participantId: meta?.participantId ?? null,
        guestId: meta?.guestId ?? null,
        name: meta?.name ?? "Participant",
        isGuest: Boolean(meta?.isGuest),
        role: meta?.role,
        isMuted: meta?.isMuted,
        isScreenShare: Boolean(meta?.isScreenShare) || screenStreamsRef.current.has(id),
        stream,
        screenStream: screenStreamsRef.current.get(id) ?? null,
      });
    }
    setRemotes(list);
  }, []);

  const clearPeer = useCallback(
    (remotePeerId: string) => {
      pcsRef.current.get(remotePeerId)?.close();
      pcsRef.current.delete(remotePeerId);
      cameraStreamsRef.current.delete(remotePeerId);
      screenStreamsRef.current.delete(remotePeerId);
      cameraInboundIdRef.current.delete(remotePeerId);
      namesRef.current.delete(remotePeerId);
      screenSendersRef.current.delete(remotePeerId);
      publishRemotes();
    },
    [publishRemotes],
  );

  const attachOutboundTracks = useCallback((pc: RTCPeerConnection, remotePeerId: string) => {
    const stream = localStreamRef.current;
    let needNegotiate = false;
    const screenSender = screenSendersRef.current.get(remotePeerId);

    const findSenderForKind = (kind: string) => {
      const live = pc
        .getSenders()
        .find((s) => s !== screenSender && s.track?.kind === kind);
      if (live) return live;
      // Vacant sender after replaceTrack(null) — match via transceiver receiver kind.
      return (
        pc.getTransceivers().find(
          (t) =>
            t.sender !== screenSender &&
            !t.sender.track &&
            t.receiver.track?.kind === kind,
        )?.sender ?? null
      );
    };

    if (stream) {
      for (const track of stream.getTracks()) {
        if (pc.getSenders().some((s) => s !== screenSender && s.track === track)) continue;

        const kindSender = findSenderForKind(track.kind);
        if (kindSender) {
          if (kindSender.track !== track) {
            void kindSender.replaceTrack(track).then(() => {
              if (track.kind === "video") preferVideoQuality(kindSender, false);
            });
          }
          continue;
        }

        const sender = pc.addTrack(track, stream);
        if (track.kind === "video") preferVideoQuality(sender, false);
        needNegotiate = true;
      }
    }

    const screenTrack = screenTrackRef.current;
    const screenStream = screenOutboundStreamRef.current;
    if (screenTrack && screenStream) {
      const current = screenSendersRef.current.get(remotePeerId);
      if (current && pc.getSenders().includes(current)) {
        if (current.track !== screenTrack) {
          void current.replaceTrack(screenTrack).then(() => preferVideoQuality(current, true));
        }
      } else {
        const sender = pc.addTrack(screenTrack, screenStream);
        screenSendersRef.current.set(remotePeerId, sender);
        preferVideoQuality(sender, true);
        needNegotiate = true;
      }
    }

    return needNegotiate;
  }, []);

  const ensurePc = useCallback(
    (remotePeerId: string) => {
      let pc = pcsRef.current.get(remotePeerId);
      if (pc) return pc;

      pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
      pcsRef.current.set(remotePeerId, pc);

      attachOutboundTracks(pc, remotePeerId);

      pc.onicecandidate = (ev) => {
        if (!ev.candidate || !meetingId) return;
        void fetch(`/api/meet/rtc/${meetingId}/signal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            toPeer: remotePeerId,
            type: "candidate",
            payload: ev.candidate.toJSON(),
          }),
        });
      };

      pc.ontrack = (ev) => {
        const track = ev.track;
        const inboundId = ev.streams[0]?.id ?? null;
        track.addEventListener("unmute", () => publishRemotes());
        track.addEventListener("mute", () => publishRemotes());
        track.addEventListener("ended", () => publishRemotes());

        let cam = cameraStreamsRef.current.get(remotePeerId);
        if (!cam) {
          cam = new MediaStream();
          cameraStreamsRef.current.set(remotePeerId, cam);
        }

        if (track.kind === "audio") {
          if (inboundId) cameraInboundIdRef.current.set(remotePeerId, inboundId);
          for (const existing of [...cam.getAudioTracks()]) {
            if (existing.id !== track.id) cam.removeTrack(existing);
          }
          if (![...cam.getAudioTracks()].some((t) => t.id === track.id)) {
            cam.addTrack(track);
          }
          publishRemotes();
          return;
        }

        // Video routing: same inbound stream id as mic/cam → person tile;
        // a different stream (our outbound screen MediaStream) → Shared screen.
        const camInboundId = cameraInboundIdRef.current.get(remotePeerId);
        const alreadyOnCam = cam.getVideoTracks().some((t) => t.id === track.id);
        if (alreadyOnCam) {
          publishRemotes();
          return;
        }

        const treatAsScreen =
          Boolean(inboundId && camInboundId && inboundId !== camInboundId) ||
          (cam.getVideoTracks().length > 0 &&
            (!inboundId || inboundId !== camInboundId));

        if (!treatAsScreen) {
          if (inboundId) cameraInboundIdRef.current.set(remotePeerId, inboundId);
          for (const existing of [...cam.getVideoTracks()]) {
            if (existing.id !== track.id) cam.removeTrack(existing);
          }
          cam.addTrack(track);
          publishRemotes();
          return;
        }

        const meta = namesRef.current.get(remotePeerId);
        let screen = screenStreamsRef.current.get(remotePeerId);
        if (!screen) {
          screen = new MediaStream();
          screenStreamsRef.current.set(remotePeerId, screen);
        }
        for (const existing of [...screen.getVideoTracks()]) {
          if (existing.id !== track.id) screen.removeTrack(existing);
        }
        if (![...screen.getVideoTracks()].some((t) => t.id === track.id)) {
          screen.addTrack(track);
        }
        namesRef.current.set(remotePeerId, {
          ...(meta ?? { name: "Participant", isGuest: false }),
          isScreenShare: true,
        });
        publishRemotes();
        onRemotePinRef.current?.(`screen-${remotePeerId}`, true);
      };

      pc.onconnectionstatechange = () => {
        if (pc!.connectionState === "failed" || pc!.connectionState === "closed") {
          clearPeer(remotePeerId);
        }
      };

      return pc;
    },
    [attachOutboundTracks, clearPeer, meetingId, publishRemotes],
  );

  const negotiate = useCallback(
    async (remotePeerId: string) => {
      if (!meetingId || makingOfferRef.current.has(remotePeerId)) return;
      const pc = ensurePc(remotePeerId);
      makingOfferRef.current.add(remotePeerId);
      try {
        attachOutboundTracks(pc, remotePeerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await fetch(`/api/meet/rtc/${meetingId}/signal`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            toPeer: remotePeerId,
            type: "offer",
            payload: pc.localDescription,
          }),
        });
      } catch (err) {
        console.warn("[meet-rtc] negotiate failed", err);
      } finally {
        makingOfferRef.current.delete(remotePeerId);
      }
    },
    [attachOutboundTracks, ensurePc, meetingId],
  );

  const handleSignal = useCallback(
    async (sig: PollSignal) => {
      if (!meetingId) return;
      const from = sig.fromPeer;
      if (sig.type === "reaction") {
        const emoji = String((sig.payload as { emoji?: string })?.emoji ?? "");
        if (emoji) onReactionRef.current?.(from, emoji);
        return;
      }
      if (sig.type === "speech") {
        const payload = sig.payload as { text?: string; speakerName?: string };
        const text = String(payload.text ?? "").trim();
        if (text) onSpeechRef.current?.(from, text, payload.speakerName ?? null);
        return;
      }
      if (sig.type === "chat") {
        const payload = sig.payload as {
          text?: string;
          speakerName?: string;
          at?: string;
          noteId?: string;
        };
        const text = String(payload.text ?? "").trim();
        if (text) {
          onChatRef.current?.({
            fromPeer: from,
            text,
            speakerName: payload.speakerName ?? null,
            at: payload.at ?? null,
            noteId: payload.noteId ?? null,
          });
        }
        return;
      }
      if (sig.type === "media-state") {
        const payload = sig.payload as { isMuted?: boolean; forcedByHost?: boolean };
        if (payload.forcedByHost && payload.isMuted) {
          onHostForceMuteRef.current?.();
        }
        return;
      }
      if (sig.type === "pin") {
        // Ignore our own broadcast so local pin state (e.g. screen-local) stays intact.
        if (selfPeerIdRef.current && from === selfPeerIdRef.current) return;
        const payload = sig.payload as { tileId?: string | null; isScreen?: boolean };
        const tileId = payload.tileId ?? null;
        if (!tileId) {
          onRemotePinRef.current?.(null, false);
          return;
        }
        if (payload.isScreen) {
          // Sharer may send "screen-local" or their peer id — normalize for viewers.
          const screenTile =
            tileId === "screen-local" || tileId === from
              ? `screen-${from}`
              : tileId.startsWith("screen-")
                ? tileId
                : `screen-${tileId}`;
          onRemotePinRef.current?.(screenTile, true);
          return;
        }
        onRemotePinRef.current?.(tileId, false);
        return;
      }
      if (sig.type === "screen-share") {
        const payload = sig.payload as { active?: boolean; peerId?: string };
        const peer = String(payload.peerId ?? from);
        if (selfPeerIdRef.current && peer === selfPeerIdRef.current) return;
        const meta = namesRef.current.get(peer) ?? {
          name: "Participant",
          isGuest: false,
        };
        namesRef.current.set(peer, { ...meta, isScreenShare: Boolean(payload.active) });
        if (!payload.active) {
          screenStreamsRef.current.delete(peer);
        }
        publishRemotes();
        if (payload.active && peer) {
          onRemotePinRef.current?.(`screen-${peer}`, true);
        }
        return;
      }
      if (sig.type === "peer-leave") {
        const payload = sig.payload as {
          peerId?: string;
          endForAll?: boolean;
          removedByHost?: boolean;
        };
        if (payload.endForAll) {
          onRemovedByHostRef.current?.("ended");
          return;
        }
        const leaveId = String(payload.peerId ?? from);
        if (
          payload.removedByHost &&
          selfPeerIdRef.current &&
          leaveId === selfPeerIdRef.current
        ) {
          onRemovedByHostRef.current?.("removed");
          return;
        }
        clearPeer(leaveId);
        return;
      }
      if (sig.type === "offer" || sig.type === "answer" || sig.type === "candidate") {
        const pc = ensurePc(from);
        try {
          if (sig.type === "offer") {
            const polite = isPolitePeer(selfPeerIdRef.current, from);
            const offerCollision =
              makingOfferRef.current.has(from) || pc.signalingState !== "stable";
            if (offerCollision) {
              if (!polite) {
                // Impolite peer ignores colliding remote offers (perfect negotiation).
                return;
              }
              try {
                await pc.setLocalDescription({ type: "rollback" });
              } catch {
                /* ignore */
              }
            }
            await pc.setRemoteDescription(sig.payload as RTCSessionDescriptionInit);
            // Late media may have arrived — ensure our tracks are on the PC before answering.
            attachOutboundTracks(pc, from);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await fetch(`/api/meet/rtc/${meetingId}/signal`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                toPeer: from,
                type: "answer",
                payload: pc.localDescription,
              }),
            });
          } else if (sig.type === "answer") {
            if (pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(sig.payload as RTCSessionDescriptionInit);
            }
          } else if (sig.type === "candidate") {
            try {
              await pc.addIceCandidate(sig.payload as RTCIceCandidateInit);
            } catch {
              // Candidate before remote description — ignore; later candidates still apply.
            }
          }
        } catch (err) {
          console.warn("[meet-rtc] signal error", sig.type, err);
        }
      }
    },
    [attachOutboundTracks, clearPeer, ensurePc, meetingId, publishRemotes],
  );

  useEffect(() => {
    if (!enabled || !meetingId) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    wasAdmittedRef.current = false;
    setStatus("connecting");

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/meet/rtc/${meetingId}/poll?after=${afterRef.current}`,
          { credentials: "include" },
        );
        if (!res.ok) {
          if (!cancelled && res.status >= 500) {
            setStatus("error");
            setError("Connection problem");
          }
          return;
        }
        const data = (await res.json()) as {
          status: string;
          peerId?: string;
          peers?: Array<{
            peerId: string;
            participantId?: string | null;
            guestId?: string | null;
            name: string;
            isGuest: boolean;
            role?: string;
            isMuted?: boolean;
          }>;
          signals?: PollSignal[];
          waiting?: { id: string; name: string }[];
          iceServers?: IceServer[];
          isManager?: boolean;
          capacity?: {
            occupied: number;
            capacity: number;
            remaining: number;
            isFull: boolean;
          };
          schedule?: {
            scheduledEndAt: string;
            pastEnd: boolean;
            autoEnded?: boolean;
            graceEndsAt: string;
            msUntilAutoEnd: number;
          } | null;
        };

        if (cancelled) return;
        if (data.iceServers?.length) iceServersRef.current = data.iceServers;
        if (data.peerId) {
          setPeerId(data.peerId);
          selfPeerIdRef.current = data.peerId;
        }
        setIsManager(Boolean(data.isManager));
        setWaiting(data.waiting ?? []);
        if (data.capacity) setCapacity(data.capacity);
        if (data.schedule !== undefined) setSchedule(data.schedule);

        if (data.status === "WAITING") {
          setStatus("waiting");
          return;
        }
        if (data.status === "ENDED") {
          setStatus("idle");
          if (wasAdmittedRef.current) onMeetingClosedRef.current?.("ended");
          return;
        }
        if (data.status === "LEFT") {
          setStatus("idle");
          if (wasAdmittedRef.current) onMeetingClosedRef.current?.("left");
          return;
        }
        wasAdmittedRef.current = true;
        setStatus("admitted");
        setError(null);

        for (const p of data.peers ?? []) {
          const prev = namesRef.current.get(p.peerId);
          namesRef.current.set(p.peerId, {
            name: p.name,
            isGuest: p.isGuest,
            participantId: p.participantId,
            guestId: p.guestId,
            role: p.role,
            isMuted: p.isMuted,
            isScreenShare: prev?.isScreenShare,
          });
          const selfId = data.peerId ?? selfPeerIdRef.current ?? "";
          // Create PCs immediately so we can receive remote media even before
          // local camera/mic finishes starting (common on mobile).
          if (!pcsRef.current.has(p.peerId)) {
            if (selfId && selfId < p.peerId) {
              void negotiate(p.peerId);
            } else {
              ensurePc(p.peerId);
            }
          } else {
            const pc = pcsRef.current.get(p.peerId)!;
            const need = attachOutboundTracks(pc, p.peerId);
            if (need) {
              // We added outbound tracks — we must offer (perfect-negotiation handles glare).
              void negotiate(p.peerId);
            }
          }
        }
        publishRemotes();

        for (const sig of data.signals ?? []) {
          afterRef.current = Math.max(afterRef.current, sig.id);
          await handleSignal(sig);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Poll failed");
        }
      }
    };

    void tick();
    const interval = setInterval(() => void tick(), 900);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    attachOutboundTracks,
    enabled,
    ensurePc,
    handleSignal,
    meetingId,
    negotiate,
    publishRemotes,
  ]);

  // When local media arrives late (common on mobile), attach tracks and renegotiate.
  useEffect(() => {
    if (!localStream || !enabled) return;
    for (const [remotePeerId, pc] of pcsRef.current.entries()) {
      const need = attachOutboundTracks(pc, remotePeerId);
      // Always offer when we newly add tracks — waiting for peer-id order left mobiles
      // with silent/black video until a camera toggle forced a refresh.
      if (need) void negotiate(remotePeerId);
    }
  }, [attachOutboundTracks, enabled, localStream, negotiate]);

  useEffect(() => {
    return () => {
      for (const pc of pcsRef.current.values()) pc.close();
      pcsRef.current.clear();
      cameraStreamsRef.current.clear();
      screenStreamsRef.current.clear();
      cameraInboundIdRef.current.clear();
      screenSendersRef.current.clear();
    };
  }, []);

  const sendSpeech = useCallback(
    async (text: string, speakerName?: string | null) => {
      if (!meetingId || !text.trim()) return;
      await fetch(`/api/meet/rtc/${meetingId}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          toPeer: "*",
          type: "speech",
          payload: { text: text.trim(), speakerName: speakerName?.trim() || undefined },
        }),
      });
    },
    [meetingId],
  );

  const sendChat = useCallback(
    async (text: string, speakerName?: string | null) => {
      if (!meetingId || !text.trim()) {
        return { ok: false as const, error: "Empty message" };
      }
      const res = await fetch(`/api/meet/rtc/${meetingId}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          toPeer: "*",
          type: "chat",
          payload: { text: text.trim().slice(0, 2000), speakerName: speakerName?.trim() || undefined },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        noteId?: string;
        at?: string;
        speakerName?: string;
        text?: string;
      };
      if (!res.ok) {
        return { ok: false as const, error: json.error || "Chat send failed" };
      }
      return {
        ok: true as const,
        noteId: json.noteId ?? null,
        at: json.at ?? new Date().toISOString(),
        speakerName: json.speakerName ?? speakerName ?? null,
        text: json.text ?? text.trim(),
      };
    },
    [meetingId],
  );

  const sendReaction = useCallback(
    async (emoji: string) => {
      if (!meetingId) return;
      await fetch(`/api/meet/rtc/${meetingId}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ toPeer: "*", type: "reaction", payload: { emoji } }),
      });
    },
    [meetingId],
  );

  const sendMediaState = useCallback(
    async (state: { isMuted?: boolean; isVideoOff?: boolean }) => {
      if (!meetingId) return;
      await fetch(`/api/meet/rtc/${meetingId}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ toPeer: "*", type: "media-state", payload: state }),
      });
    },
    [meetingId],
  );

  const sendPin = useCallback(
    async (tileId: string | null, isScreen?: boolean) => {
      if (!meetingId) return;
      await fetch(`/api/meet/rtc/${meetingId}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          toPeer: "*",
          type: "pin",
          payload: { tileId, isScreen: Boolean(isScreen) },
        }),
      });
    },
    [meetingId],
  );

  const sendScreenShareState = useCallback(
    async (active: boolean) => {
      if (!meetingId || !selfPeerIdRef.current) return;
      await fetch(`/api/meet/rtc/${meetingId}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          toPeer: "*",
          type: "screen-share",
          payload: { active, peerId: selfPeerIdRef.current },
        }),
      });
    },
    [meetingId],
  );

  /** Add or remove a second outbound video track for screen share (camera stays). */
  const setScreenShareTrack = useCallback(
    (track: MediaStreamTrack | null) => {
      if (track) {
        try {
          track.contentHint = "detail";
        } catch {
          /* ignore */
        }
        screenTrackRef.current = track;
        if (!screenOutboundStreamRef.current) {
          screenOutboundStreamRef.current = new MediaStream([track]);
        } else {
          for (const t of screenOutboundStreamRef.current.getVideoTracks()) {
            if (t.id !== track.id) screenOutboundStreamRef.current.removeTrack(t);
          }
          if (![...screenOutboundStreamRef.current.getVideoTracks()].some((t) => t.id === track.id)) {
            screenOutboundStreamRef.current.addTrack(track);
          }
        }
      } else {
        screenTrackRef.current = null;
      }

      for (const [remotePeerId, pc] of pcsRef.current.entries()) {
        void (async () => {
          try {
            let needNegotiate = false;
            if (track && screenOutboundStreamRef.current) {
              const existing = screenSendersRef.current.get(remotePeerId);
              if (existing && pc.getSenders().includes(existing)) {
                await existing.replaceTrack(track);
                preferVideoQuality(existing, true);
              } else {
                const sender = pc.addTrack(track, screenOutboundStreamRef.current);
                screenSendersRef.current.set(remotePeerId, sender);
                preferVideoQuality(sender, true);
                needNegotiate = true;
              }
            } else {
              const sender = screenSendersRef.current.get(remotePeerId);
              if (sender) {
                try {
                  pc.removeTrack(sender);
                  needNegotiate = true;
                } catch {
                  try {
                    await sender.replaceTrack(null);
                  } catch {
                    /* ignore */
                  }
                }
                screenSendersRef.current.delete(remotePeerId);
              }
            }
            // Always renegotiate after add/removeTrack — peer-id gating left many
            // devices (especially mobile) unable to send/receive screen share.
            if (needNegotiate) await negotiate(remotePeerId);
          } catch (err) {
            console.warn("[meet-rtc] screen share track update failed", err);
          }
        })();
      }

      if (!track) {
        screenOutboundStreamRef.current = null;
      }
    },
    [negotiate],
  );

  /** Swap the outbound camera track on every peer (used when restarting mobile camera). */
  const replaceCameraTrack = useCallback(
    async (track: MediaStreamTrack | null) => {
      for (const [remotePeerId, pc] of pcsRef.current.entries()) {
        const screenSender = screenSendersRef.current.get(remotePeerId);
        const videoSender =
          pc.getSenders().find((s) => s !== screenSender && s.track?.kind === "video") ??
          pc.getTransceivers().find(
            (t) =>
              t.sender !== screenSender &&
              !t.sender.track &&
              t.receiver.track?.kind === "video",
          )?.sender ??
          null;
        try {
          if (track) {
            if (videoSender) {
              await videoSender.replaceTrack(track);
              preferVideoQuality(videoSender, false);
            } else if (localStreamRef.current) {
              const sender = pc.addTrack(track, localStreamRef.current);
              preferVideoQuality(sender, false);
              await negotiate(remotePeerId);
            }
          } else if (videoSender) {
            await videoSender.replaceTrack(null);
          }
        } catch (err) {
          console.warn("[meet-rtc] replaceCameraTrack failed", remotePeerId, err);
        }
      }
    },
    [negotiate],
  );

  const admit = useCallback(
    async (guestId: string, action: "admit" | "deny") => {
      if (!meetingId) return { ok: false as const, error: "No meeting" };
      const res = await fetch(`/api/meet/rtc/${meetingId}/admit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ guestId, action }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        capacity?: {
          occupied: number;
          capacity: number;
          remaining: number;
          isFull: boolean;
        };
      };
      if (json.capacity) setCapacity(json.capacity);
      if (!res.ok) {
        return { ok: false as const, error: json.error || "Admit failed" };
      }
      return { ok: true as const };
    },
    [meetingId],
  );

  return {
    remotes,
    waiting,
    status,
    error,
    isManager,
    peerId,
    capacity,
    schedule,
    sendSpeech,
    sendChat,
    sendReaction,
    sendMediaState,
    sendPin,
    sendScreenShareState,
    setScreenShareTrack,
    replaceCameraTrack,
    /** @deprecated use setScreenShareTrack — kept briefly for call sites mid-migrate */
    setVideoOverride: setScreenShareTrack,
    admit,
  };
}
