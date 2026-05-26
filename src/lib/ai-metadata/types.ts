export type SceneSegment = {
  startSeconds: number;
  endSeconds: number;
  summary: string;
  mood?: string;
  actors?: string[];
  tags?: string[];
};

export type DialogueLine = {
  startSeconds: number;
  endSeconds: number;
  text: string;
};

export type EnrichmentResult = {
  moodTags: string[];
  atmosphere: string;
  pacing: string;
  narrativeSummary: string;
  scenes: SceneSegment[];
  dialogueIndex: DialogueLine[];
  embedding: number[];
};

export type ContentMetadataOverlay = {
  currentScene: SceneSegment | null;
  moodTags: string[];
  atmosphere: string | null;
  actorsOnScreen: string[];
};
