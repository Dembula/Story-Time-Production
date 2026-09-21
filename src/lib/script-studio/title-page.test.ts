import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  defaultEpisodeTitle,
  resolveScriptAuthorName,
  resolveTitlePageWriterCredit,
  scriptTitlePageKind,
  scriptTypeLabel,
  shouldReplaceDraftTitle,
  titleFromImportFilename,
} from "./title-page";

describe("title-page helpers", () => {
  it("labels script types for the cover sheet", () => {
    assert.equal(scriptTypeLabel("FEATURE"), "Feature Film");
    assert.equal(scriptTypeLabel("SHORT"), "Short Film");
    assert.equal(scriptTypeLabel("EPISODE"), "TV / Series Episode");
    assert.equal(scriptTypeLabel("OTHER"), "Screenplay");
  });

  it("picks feature vs episode title-page layouts", () => {
    assert.equal(scriptTitlePageKind("FEATURE"), "feature");
    assert.equal(scriptTitlePageKind("SHORT"), "feature");
    assert.equal(scriptTitlePageKind("EPISODE"), "episode");
    assert.equal(scriptTitlePageKind("SERIES"), "episode");
    assert.equal(scriptTitlePageKind("OTHER"), "other");
  });

  it("keeps an explicit writer credit including while clearing (no autofill fight)", () => {
    assert.equal(resolveTitlePageWriterCredit(null, "Account Name"), "Account Name");
    assert.equal(resolveTitlePageWriterCredit("", "Account Name"), "");
    assert.equal(resolveTitlePageWriterCredit("Mary Jane ", "Account Name"), "Mary Jane ");
    assert.equal(resolveTitlePageWriterCredit("Guest Writer", "Account Name"), "Guest Writer");
  });

  it("defaults episode titles to Pilot", () => {
    assert.equal(defaultEpisodeTitle(""), "Pilot");
    assert.equal(defaultEpisodeTitle("Cold Open"), "Cold Open");
  });

  it("prefers professionalName for the writer line", () => {
    assert.equal(
      resolveScriptAuthorName({
        professionalName: "Benny Mfisa",
        name: "Benny",
        email: "benny@example.com",
      }),
      "Benny Mfisa",
    );
    assert.equal(
      resolveScriptAuthorName({ name: null, email: "writer@story-time.online" }),
      "writer",
    );
  });

  it("derives a title from an import filename when draft is untitled", () => {
    assert.equal(shouldReplaceDraftTitle("Untitled Script"), true);
    assert.equal(shouldReplaceDraftTitle("Degrees of Separation"), false);
    assert.equal(titleFromImportFilename("Degrees_of_Separation.pdf"), "Degrees of Separation");
  });
});
