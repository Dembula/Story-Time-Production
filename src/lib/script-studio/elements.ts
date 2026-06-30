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

/** Industry-style snippets inserted at cursor or end of script. */
export function snippetForElement(type: ScreenplayElementType): string {
  switch (type) {
    case "scene_heading":
      return "\nINT. LOCATION - DAY\n\n";
    case "action":
      return "\nAction description.\n\n";
    case "character":
      return "\nCHARACTER NAME\n";
    case "parenthetical":
      return "\n    (beat)\n";
    case "dialogue":
      return "\nDialogue line.\n\n";
    case "transition":
      return "\nCUT TO:\n\n";
    case "shot":
      return "\nANGLE ON —\n\n";
    case "lyrics":
      return "\n    ♪ Lyrics line ♪\n\n";
    case "voice_over":
      return "\nCHARACTER (V.O.)\nVoice over line.\n\n";
    case "off_screen":
      return "\nCHARACTER (O.S.)\nOff-screen line.\n\n";
    case "montage":
      return "\nMONTAGE —\n\n";
    case "intercut":
      return "\nINTERCUT —\n\n";
    case "text_message":
      return "\nON SCREEN — TEXT MESSAGE\n\"Message text\"\n\n";
    case "flashback":
      return "\nFLASHBACK:\n\n";
    case "flashforward":
      return "\nFLASHFORWARD:\n\n";
    default:
      return "\n";
  }
}

export const STUDIO_FONTS: Array<{ id: string; label: string; css: string }> = [
  { id: "courier-prime", label: "Courier Prime", css: "'Courier Prime', 'Courier New', monospace" },
  { id: "courier-new", label: "Courier New", css: "'Courier New', Courier, monospace" },
  { id: "source-code-pro", label: "Source Code Pro", css: "'Source Code Pro', monospace" },
  { id: "ibm-plex-mono", label: "IBM Plex Mono", css: "'IBM Plex Mono', monospace" },
  { id: "noto-serif", label: "Noto Serif", css: "'Noto Serif', Georgia, serif" },
  { id: "georgia", label: "Georgia", css: "Georgia, serif" },
];
