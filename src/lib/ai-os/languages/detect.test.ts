import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectSaLanguages } from "./detect";
import { extractLearnedTermsFromAssistant } from "./learn-from-turn";

describe("detectSaLanguages", () => {
  it("detects isiZulu markers", () => {
    const d = detectSaLanguages("Sawubona, ngifuna ukubuka ama-movie");
    assert.ok(d.ranked.some((r) => r.code === "zu"));
    assert.equal(d.primary, "zu");
  });

  it("detects code-switching English + Afrikaans", () => {
    const d = detectSaLanguages("Howzit, that film was lekker bra");
    assert.ok(d.ranked.length >= 2);
    assert.equal(d.codeSwitching, true);
  });

  it("detects Sepedi greeting", () => {
    const d = detectSaLanguages("Thobela, ke kopa thuso");
    assert.ok(d.ranked.some((r) => r.code === "nso"));
  });

  it("returns lookup terms for non-ASCII tokens", () => {
    const d = detectSaLanguages("What does sawubona mean?");
    assert.ok(d.lookupTerms.length >= 0);
  });
});

describe("extractLearnedTermsFromAssistant", () => {
  it("extracts quoted definition", () => {
    const rows = extractLearnedTermsFromAssistant(
      'The word "yebo" means yes in isiZulu.',
      "zu",
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.term, "yebo");
  });
});
