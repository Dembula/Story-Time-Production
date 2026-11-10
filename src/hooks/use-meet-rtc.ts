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
  stream: MediaStream;
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

type UseMeetRtcOptions = {
  meetingId: string | null;
  enabled: boolean;
  localStream: MediaStream | null;
  onSpeech?: (fromPeer: string, text: string) => void;
  onReaction?: (fromPeer: string, emoji: string) => void;
  onHostForceMute?: () => void;
  onRemovedByHost?: (reason: "removed" | "ended") => void;
};

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

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const streamsRef = useRef<Map<string, MediaStream>>(new Map());
  const namesRef = useRef<
    Map<
      string,
      {
        name: string;
        isGuest: boolean;
        participantId?: string | null;
        guestId?: string | null;
        role?: string;
        isMuted?: boolean;
      }
    >
  >(new Map());
  const afterRef = useRef(0);
  const iceServersRef = useRef<IceServer[]>([{ urls: "stun:stun.l.google.com:19302" }]);
  const makingOfferRef = useRef<Set<string>>(new Set());
  const videoOverrideRef = useRef<MediaStreamTrack | null>(null);
  const localStreamRef = useRef(localStream);
  localStreamRef.current = localStream;
  const onSpeechRef = useRef(options.onSpeech);
  onSpeechRef.current = options.onSpeech;
  const onReactionRef = useRef(options.onReaction);
  onReactionRef.current = options.onReaction;
  const onHostForceMuteRef = useRef(options.onHostForceMute);
  onHostForceMuteRef.current = options.onHostForceMute;
  const onRemovedByHostRef = useRef(options.onRemovedByHost);
  onRemovedByHostRef.current = options.onRemovedByHost;
  const selfPeerIdRef = useRef<string | null>(null);

  const publishRemotes = useCallback(() => {
    const list: MeetRemotePeer[] = [];
    for (const [peerId, stream] of streamsRef.current) {
      const meta = namesRef.current.get(peerId);
      list.push({
        peerId,
        participantId: meta?.participantId ?? null,
        guestId: meta?.guestId ?? null,
        name: meta?.name ?? "Participant",
        isGuest: Boolean(meta?.isGuest),
        role: meta?.role,
        isMuted: meta?.isMuted,
        stream,
      });
    }
    setRemotes(list);
  }, []);

  const ensurePc = useCallback(
    (remotePeerId: string) => {
      let pc = pcsRef.current.get(remotePeerId);
      if (pc) return pc;

      pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
      pcsRef.current.set(remotePeerId, pc);

      const stream = localStreamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) {
          const sendTrack =
            track.kind === "video" && videoOverrideRef.current
              ? videoOverrideRef.current
              : track;
          pc.addTrack(sendTrack, stream);
        }
      }

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
        let remote = streamsRef.current.get(remotePeerId);
        if (!remote) {
          remote = new MediaStream();
          streamsRef.current.set(remotePeerId, remote);
        }
        remote.addTrack(ev.track);
        publishRemotes();
      };

      pc.onconnectionstatechange = () => {
        if (pc!.connectionState === "failed" || pc!.connectionState === "closed") {
          pcsRef.current.delete(remotePeerId);
          streamsRef.current.delete(remotePeerId);
          publishRemotes();
        }
      };

      return pc;
    },
    [meetingId, publishRemotes],
  );

  const negotiate = useCallback(
    async (remotePeerId: string) => {
      if (!meetingId || makingOfferRef.current.has(remotePeerId)) return;
      const pc = ensurePc(remotePeerId);
      makingOfferRef.current.add(remotePeerId);
      try {
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
    [ensurePc, meetingId],
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
        const text = String((sig.payload as { text?: string })?.text ?? "");
        if (text) onSpeechRef.current?.(from, text);
        return;
      }
      if (sig.type === "media-state") {
        const payload = sig.payload as { isMuted?: boolean; forcedByHost?: boolean };
        if (payload.forcedByHost && payload.isMuted) {
          onHostForceMuteRef.current?.();
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
        pcsRef.current.get(leaveId)?.close();
        pcsRef.current.delete(leaveId);
        streamsRef.current.delete(leaveId);
        namesRef.current.delete(leaveId);
        publishRemotes();
        return;
      }
      if (sig.type === "offer" || sig.type === "answer" || sig.type === "candidate") {
        const pc = ensurePc(from);
        try {
          if (sig.type === "offer") {
            await pc.setRemoteDescription(sig.payload as RTCSessionDescriptionInit);
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
            await pc.setRemoteDescription(sig.payload as RTCSessionDescriptionInit);
          } else if (sig.type === "candidate") {
            await pc.addIceCandidate(sig.payload as RTCIceCandidateInit);
          }
        } catch (err) {
          console.warn("[meet-rtc] signal error", sig.type, err);
        }
      }
    },
    [ensurePc, meetingId, publishRemotes],
  );

  useEffect(() => {
    if (!enabled || !meetingId) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("connecting");

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/meet/rtc/${meetingId}/poll?after=${afterRef.current}`,
          { credentials: "include" },
        );
        if (!res.ok) {
          if (!cancelled) {
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

        if (data.status === "WAITING") {
          setStatus("waiting");
          return;
        }
        setStatus("admitted");
        setError(null);

        for (const p of data.peers ?? []) {
          namesRef.current.set(p.peerId, {
            name: p.name,
            isGuest: p.isGuest,
            participantId: p.participantId,
            guestId: p.guestId,
            role: p.role,
            isMuted: p.isMuted,
          });
          if (!pcsRef.current.has(p.peerId) && localStreamRef.current) {
            // Perfect negotiation lite: lexicographic initiator
            if ((data.peerId ?? "") < p.peerId) {
              void negotiate(p.peerId);
            } else {
              ensurePc(p.peerId);
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
    const interval = setInterval(() => void tick(), 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, meetingId, ensurePc, handleSignal, negotiate, publishRemotes]);

  useEffect(() => {
    return () => {
      for (const pc of pcsRef.current.values()) pc.close();
      pcsRef.current.clear();
      streamsRef.current.clear();
    };
  }, []);

  const sendSpeech = useCallback(
    async (text: string) => {
      if (!meetingId || !text.trim()) return;
      await fetch(`/api/meet/rtc/${meetingId}/signal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ toPeer: "*", type: "speech", payload: { text } }),
      });
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

  const setVideoOverride = useCallback((track: MediaStreamTrack | null) => {
    videoOverrideRef.current = track;
    for (const pc of pcsRef.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) {
        const fallback = localStreamRef.current?.getVideoTracks()[0] ?? null;
        void sender.replaceTrack(track ?? fallback);
      }
    }
  }, []);

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
    sendSpeech,
    sendReaction,
    sendMediaState,
    setVideoOverride,
    admit,
  };
}
