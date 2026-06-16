import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rewriteHlsManifestForProxy } from "./playback-manifest-rewrite";

describe("rewriteHlsManifestForProxy", () => {
  const upstream =
    "https://videodelivery.net/signed-token/manifest/video.m3u8";

  it("rewrites relative URIs inside HLS tags", () => {
    const body = [
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="group_audio",URI="stream_audio.m3u8"',
      '#EXT-X-STREAM-INF:BANDWIDTH=1000,AUDIO="group_audio"',
      "relative-video.m3u8",
    ].join("\n");

    const rewritten = rewriteHlsManifestForProxy(body, upstream);
    assert.match(
      rewritten,
      /URI="https:\/\/videodelivery\.net\/signed-token\/manifest\/stream_audio\.m3u8"/,
    );
    assert.match(
      rewritten,
      /https:\/\/videodelivery\.net\/signed-token\/manifest\/relative-video\.m3u8/,
    );
  });

  it("leaves absolute URLs unchanged", () => {
    const absolute = "https://videodelivery.net/other/manifest/stream.m3u8";
    const body = `#EXT-X-MEDIA:URI="${absolute}"\n${absolute}`;
    const rewritten = rewriteHlsManifestForProxy(body, upstream);
    assert.equal(rewritten.split(absolute).length - 1, 2);
  });
});
