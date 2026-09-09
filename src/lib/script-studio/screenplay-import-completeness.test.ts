import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shouldKeepEmbedOverOcr } from "./screenplay-import-completeness";

describe("screenplay import completeness", () => {
  it("keeps fuller embed when OCR is shorter (3 pages vs 5)", () => {
    const embedLetters = 5 * 900;
    const ocrLetters = 3 * 900;
    assert.equal(
      shouldKeepEmbedOverOcr({
        embedLetters,
        ocrLetters,
        embedUsable: true,
        pageCount: 5,
      }),
      true,
    );
  });

  it("allows OCR when it covers as much or more than embed", () => {
    assert.equal(
      shouldKeepEmbedOverOcr({
        embedLetters: 800,
        ocrLetters: 4200,
        embedUsable: true,
        pageCount: 5,
      }),
      false,
    );
  });

  it("keeps embed when OCR is short for known page count", () => {
    assert.equal(
      shouldKeepEmbedOverOcr({
        embedLetters: 5000,
        ocrLetters: 1200,
        embedUsable: true,
        pageCount: 5,
      }),
      true,
    );
  });
});
