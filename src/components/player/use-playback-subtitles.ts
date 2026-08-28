"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlaybackSubtitleTrack } from "@/lib/subtitles/types";
import { findActiveCue, parseVtt, type VttCue } from "@/lib/subtitles/vtt";

export type SubtitlePreference = "off" | string;

export function usePlaybackSubtitles(
  tracks: PlaybackSubtitleTrack[],
  currentTime: number,
  enabled: boolean,
  activeTrackId: SubtitlePreference,
) {
  const [cues, setCues] = useState<VttCue[]>([]);
  const [loadError, setLoadError] = useState(false);

  const activeTrack = useMemo(() => {
    if (!enabled || activeTrackId === "off") return null;
    return tracks.find((track) => track.id === activeTrackId) ?? null;
  }, [tracks, enabled, activeTrackId]);

  useEffect(() => {
    if (!activeTrack) {
      setCues([]);
      setLoadError(false);
      return;
    }

    let cancelled = false;
    setLoadError(false);

    void (async () => {
      try {
        const res = await fetch(activeTrack.proxyUrl, { credentials: "same-origin" });
        if (!res.ok) {
          const fallback = await fetch(activeTrack.vttUrl).catch(() => null);
          if (!fallback?.ok) throw new Error("subtitle fetch failed");
          const text = await fallback.text();
          if (!cancelled) setCues(parseVtt(text));
          return;
        }
        const text = await res.text();
        if (!cancelled) setCues(parseVtt(text));
      } catch {
        if (!cancelled) {
          setCues([]);
          setLoadError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTrack]);

  const activeCue = useMemo(() => {
    if (!activeTrack || cues.length === 0) return null;
    return findActiveCue(cues, currentTime);
  }, [activeTrack, cues, currentTime]);

  const defaultTrackId = useMemo(() => {
    const preferred = tracks.find((track) => track.isDefault);
    return preferred?.id ?? tracks[0]?.id ?? "off";
  }, [tracks]);

  return {
    activeCue,
    loadError,
    defaultTrackId,
  };
}

export function useSubtitleControls(tracks: PlaybackSubtitleTrack[]) {
  const defaultTrackId = useMemo(() => {
    const preferred = tracks.find((track) => track.isDefault);
    return preferred?.id ?? tracks[0]?.id ?? "off";
  }, [tracks]);

  const [enabled, setEnabled] = useState(false);
  const [activeTrackId, setActiveTrackId] = useState<SubtitlePreference>("off");

  const toggleSubtitles = useCallback(() => {
    setEnabled((current) => {
      if (current) {
        setActiveTrackId("off");
        return false;
      }
      setActiveTrackId(defaultTrackId);
      return true;
    });
  }, [defaultTrackId]);

  const selectTrack = useCallback((trackId: SubtitlePreference) => {
    if (trackId === "off") {
      setEnabled(false);
      setActiveTrackId("off");
      return;
    }
    setEnabled(true);
    setActiveTrackId(trackId);
  }, []);

  return {
    enabled,
    activeTrackId,
    toggleSubtitles,
    selectTrack,
    hasTracks: tracks.length > 0,
  };
}
