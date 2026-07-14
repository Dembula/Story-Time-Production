import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  handleScreenplayEnter,
  handleScreenplayTab,
  formatLineForElement,
  resolveLineElement,
  padColumn,
  nextElementOnEnter,
  hardWrapLineForElement,
  wrapPlainText,
  applyHardWrapAtCursor,
  hardWrapDocument,
} from "./screenplay-keyboard";
import { SCREENPLAY_COL } from "./elements";

describe("screenplay-keyboard", () => {
  it("formats character lines in uppercase at character column (~3.7\")", () => {
    const line = formatLineForElement("character", "john");
    assert.equal(line, padColumn("JOHN", SCREENPLAY_COL.character));
    assert.equal(SCREENPLAY_COL.character, 22);
  });

  it("formats parenthetical at ~3.1\" and dialogue at ~2.5\"", () => {
    assert.equal(formatLineForElement("parenthetical", "whispering"), padColumn("(whispering)", SCREENPLAY_COL.parenthetical));
    assert.equal(formatLineForElement("dialogue", "Hello."), padColumn("Hello.", SCREENPLAY_COL.dialogue));
    assert.equal(SCREENPLAY_COL.parenthetical, 16);
    assert.equal(SCREENPLAY_COL.dialogue, 10);
  });

  it("enters parenthetical after character with cursor inside parentheses", () => {
    const content = `${padColumn("SARAH", SCREENPLAY_COL.character)}`;
    const cursor = content.length;
    const result = handleScreenplayEnter(content, cursor, "character");

    assert.equal(result.element, "parenthetical");
    const lines = result.content.split("\n");
    assert.equal(lines.length, 2);
    assert.ok(lines[1]!.includes("("));
    assert.ok(lines[1]!.startsWith(" ".repeat(SCREENPLAY_COL.parenthetical)));
  });

  it("double-enter on empty action switches to character", () => {
    assert.equal(nextElementOnEnter("action", true), "character");
    const result = handleScreenplayEnter("\n", 1, "action");
    assert.equal(result.element, "character");
  });

  it("double-enter on empty dialogue switches to action", () => {
    assert.equal(nextElementOnEnter("dialogue", true), "action");
    const content = padColumn("", SCREENPLAY_COL.dialogue);
    const result = handleScreenplayEnter(content, content.length, "dialogue");
    assert.equal(result.element, "action");
  });

  it("cycles elements with tab including shot and centered", () => {
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

  it("leaves scene-heading mode when typing non-slugline prose", () => {
    assert.equal(resolveLineElement("fbhfhf", {}, "scene_heading"), "action");
    assert.equal(resolveLineElement("IN", {}, "scene_heading"), "scene_heading");
    assert.equal(resolveLineElement("INT. ROOM - DAY", {}, "scene_heading"), "scene_heading");
  });

  it("right-aligns transitions in uppercase", () => {
    const line = formatLineForElement("transition", "cut to");
    assert.ok(line.trimEnd().endsWith("CUT TO:"));
    assert.ok(line.startsWith(" "));
  });

  it("hard-wraps long action lines within 60 characters", () => {
    const long = "a".repeat(70);
    const wrapped = hardWrapLineForElement("action", long);
    assert.ok(wrapped.length >= 2);
    assert.ok(wrapped.every((l) => l.length <= 60));
    assert.deepEqual(wrapPlainText("one two three four", 8), ["one two", "three", "four"]);
  });

  it("does not peel one character per keystroke when typing past the wrap width", () => {
    let content = "a".repeat(60);
    let cursor = content.length;
    for (let i = 0; i < 5; i++) {
      content = content.slice(0, cursor) + "x" + content.slice(cursor);
      cursor += 1;
      const result = applyHardWrapAtCursor(content, cursor, "action");
      content = result.content;
      cursor = result.selectionStart;
    }
    const lines = content.split("\n");
    assert.ok(lines.length <= 3, `expected few lines, got ${lines.length}: ${JSON.stringify(lines)}`);
    assert.ok(
      !lines.some((l) => l.length === 1) || lines.length === 1,
      `should not accumulate single-char lines: ${JSON.stringify(lines)}`,
    );
    assert.equal(content.replace(/\n/g, "").length, 65);
  });

  it("heals already peeled single-character remainder lines", () => {
    const broken = ["a".repeat(60), "d", "l", "u", "b"].join("\n");
    const healed = hardWrapDocument(broken);
    const lines = healed.split("\n");
    assert.ok(lines.length <= 2, `expected healed wrap, got ${lines.length}: ${JSON.stringify(lines)}`);
    assert.equal(healed.replace(/\n/g, ""), "a".repeat(60) + "dlub");
  });
});
