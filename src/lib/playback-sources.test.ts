import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolvePlaybackSources } from "./playback-sources";

describe("playback-sources", () => {
  it("returns null for empty input", () => {
    assert.equal(resolvePlaybackSources(""), null);
    assert.equal(resolvePlaybackSources(null), null);
    assert.equal(resolvePlaybackSources(undefined), null);
  });

  it("recognises plain MP4 URLs as progressive sources", () => {
    const source = resolvePlaybackSources("https://cdn.example.com/path/file.mp4");
    assert.deepEqual(source, { src: "https://cdn.example.com/path/file.mp4", type: "video/mp4" });
  });

  it("recognises HLS manifests by extension", () => {
    const source = resolvePlaybackSources("https://cdn.example.com/path/master.m3u8?v=1");
    assert.deepEqual(source, {
      src: "https://cdn.example.com/path/master.m3u8?v=1",
      type: "application/x-mpegurl",
    });
  });

  it("converts a Cloudflare Stream videodelivery URL into an HLS manifest", () => {
    const source = resolvePlaybackSources(
      "https://videodelivery.net/0123456789abcdef0123456789abcdef/manifest/video.m3u8",
    );
    assert.equal(source?.type, "application/x-mpegurl");
    assert.ok(source?.src.endsWith("/manifest/video.m3u8"));
  });
});
