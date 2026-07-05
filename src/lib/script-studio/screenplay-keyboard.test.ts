import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  handleScreenplayEnter,
  handleScreenplayTab,
  formatLineForElement,
  resolveLineElement,
  padColumn,
} from "./screenplay-keyboard";
import { SCREENPLAY_COL } from "./elements";

describe("screenplay-keyboard", () => {
  it("formats character lines in uppercase at character column", () => {
    const line = formatLineForElement("character", "john");
    assert.equal(line, padColumn("JOHN", SCREENPLAY_COL.character));
  });

  it("enters dialogue after character with cursor at dialogue column", () => {
    const content = `${padColumn("SARAH", SCREENPLAY_COL.character)}`;
    const cursor = content.length;
    const result = handleScreenplayEnter(content, cursor, "character");

    assert.equal(result.element, "dialogue");
    const lines = result.content.split("\n");
    assert.equal(lines.length, 2);
    assert.ok(lines[1]!.startsWith(" ".repeat(SCREENPLAY_COL.dialogue)));
    assert.equal(result.selectionStart, result.content.indexOf("\n") + 1 + SCREENPLAY_COL.dialogue);
    assert.equal(result.selectionStart, result.selectionEnd);
  });

  it("cycles elements with tab using active hint on empty line", () => {
    const content = "INT. ROOM - DAY\n\n";
    const cursor = content.length;
    const result = handleScreenplayTab(content, cursor, 1, "action");
    assert.equal(result.element, "character");
    assert.ok(result.content.includes(padColumn("CHARACTER", SCREENPLAY_COL.character)));
  });

  it("prefers active element hint for in-progress character line", () => {
    const line = "mike";
    const element = resolveLineElement(line, {}, "character");
    assert.equal(element, "character");
  });
});
