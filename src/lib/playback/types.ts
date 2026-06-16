import type { PlaybackMimeType, PlaybackSource, PlaybackSourceSet } from "@/lib/playback-sources";

export type { PlaybackSource, PlaybackSourceSet };

export type PlaybackSubtitleTrack = {
  id: string;
  language: string;
  label: string;
  vttUrl: string;
  isDefault: boolean;
};

export type PlaybackBundleResponse = {
  id: string;
  title: string;
  playback: PlaybackSource | null;
  sources: PlaybackSourceSet | null;
  streamReady: boolean;
  streamStatus: string | null;
  playbackProtection: {
    signedUrl: boolean;
    expiresHintSeconds: number;
    authenticatedViewer: boolean;
  };
  posterUrl: string | null;
  duration: number | null;
  enrichment: {
    status?: string;
    moodTags?: string[];
    atmosphere?: string | null;
    pacing?: string | null;
    narrativeJson?: Record<string, unknown> | null;
  } | null;
  scenes: Array<{
    id: string;
    startSeconds: number;
    endSeconds: number;
    summary: string | null;
    mood: string | null;
    actors: unknown;
  }>;
  subtitles: PlaybackSubtitleTrack[];
  captureProtection: {
    enabled: boolean;
    mode: string;
    watermarkEnabled: boolean;
    drmConfigured: boolean;
    drmLicensePath: string | null;
  };
};
