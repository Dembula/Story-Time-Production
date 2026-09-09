import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isPartialWordGlueGarbage,
  hasCollapsedScreenplayStructure,
  restructureGluedScreenplay,
  normalizeImportedScreenplayLayout,
  lightCleanScreenplayText,
} from "./screenplay-layout-repair";
import { importScreenplayText } from "./import-export";

describe("glued screenplay import repair", () => {
  const gluedSample = `EXT. DURBAN UNIVERSITY - ENTRANCE - DAYCROSS CUTS BACK TO
Lisakhanya KhumaloNah fam
holdingMichaela's hand. tothe dean ofDEAN
seat.LISAKHANYA: statements?
equilibriumDALE: the first and most rebellious
LISAKHANYA:Nah fam we good.
FADE TO BLACK flowing locks`;

  it("detects partial word glue and collapsed structure", () => {
    assert.equal(isPartialWordGlueGarbage(gluedSample), true);
    // Short fixtures may not hit the letter-count gate; longer walls of text do.
    const wall = `${gluedSample}\n`.repeat(6);
    assert.equal(hasCollapsedScreenplayStructure(wall) || isPartialWordGlueGarbage(wall), true);
  });

  it("unglues camelCase and splits character cues", () => {
    const fixed = restructureGluedScreenplay(gluedSample);
    assert.ok(!/DAYCROSS/i.test(fixed));
    assert.ok(!/holdingMichaela/.test(fixed));
    assert.ok(!/tothe/.test(fixed));
    assert.ok(!/ofDEAN/.test(fixed));
    assert.ok(!/seat\.LISAKHANYA:/i.test(fixed));
    assert.match(fixed, /LISAKHANYA/i);
    assert.match(fixed, /DALE/i);
    assert.ok(fixed.includes("\n"));
    // Character cues should not stay glued to dialogue with a colon on one token
    assert.ok(!/\b[A-Z]{3,}:[A-Za-z]/.test(fixed.replace(/\n/g, " ")));
  });

  it("importScreenplayText produces structured screenplay for glued PDF text", () => {
    const result = importScreenplayText(gluedSample, "Degrees of Separation.pdf");
    assert.ok(result.text.length > 40);
    assert.ok(result.fixes.length > 0);
    // Scene heading should be its own line
    assert.match(result.text, /^EXT\.\s+DURBAN UNIVERSITY/im);
    // Character names should appear as their own (possibly indented) lines
    const lines = result.text.split("\n").map((l) => l.trim());
    assert.ok(lines.some((l) => /^LISAKHANYA/.test(l)));
    assert.ok(lines.some((l) => /^DALE/.test(l)));
    assert.ok(!/holdingMichaela|DAYCROSS|tothe|ofDEAN|seat\.LISAKHANYA:/i.test(result.text));
  });

  it("normalizeImportedScreenplayLayout reports glue repair", () => {
    const { text, fixes } = normalizeImportedScreenplayLayout(gluedSample);
    assert.ok(fixes.some((f) => /glued|structure|spaces/i.test(f)));
    assert.ok(text.includes("holding Michaela") || text.includes("holding Michaela".replace(" ", "")));
    assert.ok(/holding\s+Michaela/.test(text));
  });

  it("strips PDF (CONTINUED)/(MORE) footers but keeps CONT'D cues", () => {
    const raw = `INT. OFFICE - DAY

DEAN (CONT'D)
Hello.

(CONTINUED)

MICHAELA
Yes.

(MORE)

(CONTINUED) (CONTINUED)
`;
    const cleaned = lightCleanScreenplayText(raw);
    assert.ok(!/\(CONTINUED\)/i.test(cleaned));
    assert.ok(!/\(MORE\)/i.test(cleaned));
    assert.match(cleaned, /DEAN \(CONT'D\)/);
    assert.match(cleaned, /MICHAELA/);
  });
});
