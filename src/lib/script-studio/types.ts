export type ScreenplayElementType =
  | "scene_heading"
  | "action"
  | "character"
  | "parenthetical"
  | "dialogue"
  | "transition"
  | "shot"
  | "lyrics"
  | "voice_over"
  | "off_screen"
  | "montage"
  | "intercut"
  | "text_message"
  | "flashback"
  | "flashforward";

export type ScriptTemplateId =
  | "FEATURE"
  | "TV_SERIES"
  | "SHORT"
  | "DOCUMENTARY"
  | "COMMERCIAL"
  | "MUSIC_VIDEO"
  | "PODCAST"
  | "ANIMATION"
  | "THEATRE"
  | "WEB_SERIES"
  | "VERTICAL"
  | "YOUTUBE";

export type ParsedScene = {
  id: string;
  number: number;
  heading: string;
  lineIndex: number;
  color?: string;
};

export type ParsedCharacter = {
  name: string;
  dialogueLines: number;
  firstScene?: number;
  lastScene?: number;
};

export type ScreenplayStats = {
  words: number;
  scenes: number;
  pages: number;
  characters: number;
  estimatedRuntimeMinutes: number;
  readingMinutes: number;
};

export type StudioTheme = "dark" | "light";

export type StudioFont =
  | "courier-prime"
  | "courier-new"
  | "source-code-pro"
  | "ibm-plex-mono"
  | "noto-serif"
  | "georgia";
