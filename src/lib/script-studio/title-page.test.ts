import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveScriptAuthorName,
  scriptTypeLabel,
  shouldReplaceDraftTitle,
  titleFromImportFilename,
} from "./title-page";

describe("title-page helpers", () => {
  it("labels script types for the cover sheet", () => {
    assert.equal(scriptTypeLabel("FEATURE"), "Feature Film");
    assert.equal(scriptTypeLabel("SHORT"), "Short Film");
    assert.equal(scriptTypeLabel("EPISODE"), "Episode");
    assert.equal(scriptTypeLabel("OTHER"), "Screenplay");
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
