import type { ScreenplayElementType } from "./types";

export const SCREENPLAY_ELEMENT_LABELS: Record<ScreenplayElementType, string> = {
  scene_heading: "Scene Heading",
  action: "Action",
  character: "Character",
  parenthetical: "Parenthetical",
  dialogue: "Dialogue",
  transition: "Transition",
  shot: "Shot",
  lyrics: "Lyrics",
  voice_over: "V.O.",
  off_screen: "O.S.",
  montage: "Montage",
  intercut: "Intercut",
  text_message: "Text Message",
  flashback: "Flashback",
  flashforward: "Flashforward",
};

/** Standard script line width in monospace characters (6" @ 10 CPI). */
export const SCREENPLAY_LINE_WIDTH = 60;

/** Column positions from the left edge of the script text area. */
export const SCREENPLAY_COL = {
  dialogue: 10,
  parenthetical: 16,
  character: 22,
} as const;

export type ElementSnippet = {
  text: string;
  /** Selection range within `text` for placeholder replacement. */
  select?: { start: number; end: number };
};

function padColumn(text: string, column: number): string {
  return " ".repeat(Math.max(0, column)) + text.trimEnd();
}

function rightAlign(text: string, width = SCREENPLAY_LINE_WIDTH): string {
  const trimmed = text.trim();
  const pad = Math.max(0, width - trimmed.length);
  return " ".repeat(pad) + trimmed;
}

function centerText(text: string, width = SCREENPLAY_LINE_WIDTH): string {
  const trimmed = text.trim();
  const pad = Math.max(0, Math.floor((width - trimmed.length) / 2));
  return " ".repeat(pad) + trimmed;
}

function withBlankLine(text: string): string {
  return text.endsWith("\n\n") ? text : `${text}\n\n`;
}

/** Industry-style snippets inserted at the cursor. */
export function getElementSnippet(type: ScreenplayElementType): ElementSnippet {
  switch (type) {
    case "scene_heading": {
      const text = withBlankLine("INT. LOCATION - DAY");
      return { text, select: { start: 5, end: 13 } };
    }
    case "action": {
      const line = "Action description.";
      return { text: withBlankLine(line), select: { start: 0, end: line.length } };
    }
    case "character": {
      const line = padColumn("CHARACTER NAME", SCREENPLAY_COL.character);
      const nameStart = line.indexOf("CHARACTER NAME");
      return {
        text: `${line}\n`,
        select: { start: nameStart, end: nameStart + "CHARACTER NAME".length },
      };
    }
    case "parenthetical": {
      const line = padColumn("(beat)", SCREENPLAY_COL.parenthetical);
      const parenStart = line.indexOf("(beat)");
      return {
        text: `${line}\n`,
        select: { start: parenStart, end: parenStart + "(beat)".length },
      };
    }
    case "dialogue": {
      const line = padColumn("Dialogue line.", SCREENPLAY_COL.dialogue);
      const dialogueStart = line.indexOf("Dialogue line.");
      return {
        text: withBlankLine(line),
        select: { start: dialogueStart, end: dialogueStart + "Dialogue line.".length },
      };
    }
    case "transition": {
      const line = rightAlign("CUT TO:");
      const transitionStart = line.indexOf("CUT TO:");
      return {
        text: withBlankLine(line),
        select: { start: transitionStart, end: transitionStart + "CUT TO:".length },
      };
    }
    case "shot": {
      const line = "ANGLE ON — subject.";
      return { text: withBlankLine(line), select: { start: 0, end: line.length } };
    }
    case "lyrics": {
      const line = centerText("♪ Lyrics line ♪");
      const lyricsStart = line.indexOf("♪ Lyrics line ♪");
      return {
        text: withBlankLine(line),
        select: { start: lyricsStart, end: lyricsStart + "♪ Lyrics line ♪".length },
      };
    }
    case "voice_over": {
      const characterLine = padColumn("CHARACTER (V.O.)", SCREENPLAY_COL.character);
      const dialogueLine = padColumn("Voice over line.", SCREENPLAY_COL.dialogue);
      const text = `${characterLine}\n${dialogueLine}\n\n`;
      const voiceStart = dialogueLine.indexOf("Voice over line.");
      return {
        text,
        select: { start: characterLine.length + 1 + voiceStart, end: characterLine.length + 1 + voiceStart + "Voice over line.".length },
      };
    }
    case "off_screen": {
      const characterLine = padColumn("CHARACTER (O.S.)", SCREENPLAY_COL.character);
      const dialogueLine = padColumn("Off-screen line.", SCREENPLAY_COL.dialogue);
      const text = `${characterLine}\n${dialogueLine}\n\n`;
      const offStart = dialogueLine.indexOf("Off-screen line.");
      return {
        text,
        select: { start: characterLine.length + 1 + offStart, end: characterLine.length + 1 + offStart + "Off-screen line.".length },
      };
    }
    case "montage": {
      const line = "MONTAGE — description.";
      return { text: withBlankLine(line), select: { start: 10, end: line.length } };
    }
    case "intercut": {
      const line = "INTERCUT — description.";
      return { text: withBlankLine(line), select: { start: 11, end: line.length } };
    }
    case "text_message": {
      const heading = "ON SCREEN — TEXT MESSAGE";
      const messageLine = centerText('"Message text"');
      const text = `${heading}\n${messageLine}\n\n`;
      const messageStart = heading.length + 1 + messageLine.indexOf('"Message text"');
      return {
        text,
        select: { start: messageStart, end: messageStart + '"Message text"'.length },
      };
    }
    case "flashback": {
      const line = rightAlign("FLASHBACK:");
      const flashStart = line.indexOf("FLASHBACK:");
      return {
        text: withBlankLine(line),
        select: { start: flashStart, end: flashStart + "FLASHBACK:".length },
      };
    }
    case "flashforward": {
      const line = rightAlign("FLASHFORWARD:");
      const flashStart = line.indexOf("FLASHFORWARD:");
      return {
        text: withBlankLine(line),
        select: { start: flashStart, end: flashStart + "FLASHFORWARD:".length },
      };
    }
    default:
      return { text: "\n" };
  }
}

export function snippetForElement(type: ScreenplayElementType): string {
  return getElementSnippet(type).text;
}

export const STUDIO_FONTS: Array<{ id: string; label: string; css: string }> = [
  { id: "courier-prime", label: "Courier Prime", css: "'Courier Prime', 'Courier New', monospace" },
  { id: "courier-new", label: "Courier New", css: "'Courier New', Courier, monospace" },
  { id: "source-code-pro", label: "Source Code Pro", css: "'Source Code Pro', monospace" },
  { id: "ibm-plex-mono", label: "IBM Plex Mono", css: "'IBM Plex Mono', monospace" },
  { id: "noto-serif", label: "Noto Serif", css: "'Noto Serif', Georgia, serif" },
  { id: "georgia", label: "Georgia", css: "Georgia, serif" },
];
