import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertCatalogueMediaForSubmit,
  getCatalogueMediaRequirements,
  getMissingCatalogueMedia,
} from "./media-requirements";

describe("catalogue media requirements", () => {
  it("requires a main video for single-title formats", () => {
    for (const type of ["MOVIE", "DOCUMENTARY", "SHORT_FILM", "COMEDY_SKIT", "STAND_UP", "MUSIC_VIDEO"]) {
      const missing = getMissingCatalogueMedia({ type, videoUrl: "" });
      assert.ok(missing.some((m) => m.toLowerCase().includes("main")));
      assert.equal(getCatalogueMediaRequirements(type).requiresEpisodes, false);
    }
  });

  it("requires poster, backdrop, and episode masters for long-form", () => {
    for (const type of ["SERIES", "SHOW", "PODCAST", "WEB_SERIES", "REALITY", "NEWS"]) {
      const req = getCatalogueMediaRequirements(type);
      assert.equal(req.longForm, true);
      assert.equal(req.requiresMainVideo, false);
      assert.equal(req.requiresPoster, true);
      assert.equal(req.requiresBackdrop, true);
      assert.equal(req.requiresEpisodes, true);
    }

    const missing = getMissingCatalogueMedia({
      type: "SERIES",
      posterUrl: "https://cdn.example/poster.jpg",
      backdropUrl: "https://cdn.example/backdrop.jpg",
      seasons: [{ seasonNumber: 1, episodes: [{ episodeNumber: 1, videoUrl: "" }] }],
    });
    assert.ok(missing.some((m) => m.toLowerCase().includes("episode")));

    const ok = assertCatalogueMediaForSubmit({
      type: "SERIES",
      posterUrl: "https://cdn.example/poster.jpg",
      backdropUrl: "https://cdn.example/backdrop.jpg",
      seasons: [
        {
          seasonNumber: 1,
          episodes: [{ episodeNumber: 1, title: "Pilot", videoUrl: "https://cdn.example/ep1.mp4" }],
        },
      ],
    });
    assert.deepEqual(ok, { ok: true });
  });

  it("allows drafts to omit masters", () => {
    assert.deepEqual(assertCatalogueMediaForSubmit({ type: "MOVIE" }, { isDraft: true }), { ok: true });
  });

  it("allows audio masters for podcasts and news", () => {
    assert.equal(getCatalogueMediaRequirements("PODCAST").allowsAudioMasters, true);
    assert.equal(getCatalogueMediaRequirements("NEWS").allowsAudioMasters, true);
    assert.equal(getCatalogueMediaRequirements("SERIES").allowsAudioMasters, false);
  });
});
