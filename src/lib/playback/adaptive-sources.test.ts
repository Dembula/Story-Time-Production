import test from "node:test";
import assert from "node:assert/strict";
import { selectPrimaryPlaybackSource, buildPlaybackSourceSet } from "./adaptive-sources";
import type { PlaybackSourceSet } from "./types";
import type { PlaybackDeviceProfile } from "@/lib/player/mobile-detect";

function baseProfile(overrides: Partial<PlaybackDeviceProfile> = {}): PlaybackDeviceProfile {
  return {
    family: "desktop",
    browser: "chrome",
    isMobileLike: false,
    isIOS: false,
    isAndroid: false,
    isTablet: false,
    isTvLike: false,
    prefersNativeFullscreen: false,
    playsInline: true,
    canAutoplayAudible: true,
    startHint: "Tap play to start playback.",
    ...overrides,
  };
}

function sampleSources(): PlaybackSourceSet {
  return {
    primary: { src: "https://example.com/video.m3u8", type: "application/x-mpegurl" },
    hls: { src: "https://example.com/video.m3u8", type: "application/x-mpegurl" },
    dash: { src: "https://example.com/video.mpd", type: "application/dash+xml" },
    mp4: { src: "https://example.com/video.mp4", type: "video/mp4" },
  };
}

test("selectPrimaryPlaybackSource prefers HLS on iOS", () => {
  const sources = sampleSources();
  const selected = selectPrimaryPlaybackSource(sources, baseProfile({ family: "ios", isIOS: true, isMobileLike: true }));
  assert.equal(selected.type, "application/x-mpegurl");
});

test("selectPrimaryPlaybackSource prefers DASH on TV", () => {
  const sources = sampleSources();
  const selected = selectPrimaryPlaybackSource(
    sources,
    baseProfile({ family: "tv", isTvLike: true }),
  );
  assert.equal(selected.type, "application/dash+xml");
});

test("selectPrimaryPlaybackSource falls back to MP4 when adaptive manifests missing", () => {
  const sources: PlaybackSourceSet = {
    primary: { src: "https://example.com/video.mp4", type: "video/mp4" },
    hls: null,
    dash: null,
    mp4: { src: "https://example.com/video.mp4", type: "video/mp4" },
  };
  const selected = selectPrimaryPlaybackSource(sources, baseProfile());
  assert.equal(selected.src, "https://example.com/video.mp4");
});

test("buildPlaybackSourceSet returns null without any source", () => {
  assert.equal(buildPlaybackSourceSet(null, null, null), null);
});
