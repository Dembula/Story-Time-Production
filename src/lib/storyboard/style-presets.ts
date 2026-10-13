export const STORYBOARD_STYLE_PRESETS = [
  {
    key: "cinematic",
    label: "Cinematic",
    promptHint:
      "cinematic film still, dramatic lighting, shallow depth of field, anamorphic feel, production design ready",
  },
  {
    key: "sketch",
    label: "Pencil sketch",
    promptHint:
      "hand-drawn pencil storyboard sketch on paper, clean line art, shading, classic storyboard frame",
  },
  {
    key: "noir",
    label: "Noir",
    promptHint:
      "film noir style, high contrast black and white, hard shadows, moody atmosphere",
  },
  {
    key: "anime",
    label: "Anime",
    promptHint:
      "anime storyboard panel, expressive framing, clean cel-shaded look, cinematic anime composition",
  },
  {
    key: "realistic",
    label: "Photoreal",
    promptHint:
      "photorealistic location scout / previs still, natural light, grounded production look",
  },
  {
    key: "watercolor",
    label: "Watercolor",
    promptHint:
      "soft watercolor storyboard illustration, painterly washes, atmospheric color",
  },
] as const;

export type StoryboardStylePreset = (typeof STORYBOARD_STYLE_PRESETS)[number]["key"];

export const STORYBOARD_ASPECT_RATIOS = [
  { key: "16:9", label: "16:9 Widescreen" },
  { key: "2.39:1", label: "2.39:1 Scope" },
  { key: "4:3", label: "4:3 Classic" },
  { key: "1:1", label: "1:1 Square" },
  { key: "9:16", label: "9:16 Vertical" },
] as const;

export type StoryboardAspectRatio = (typeof STORYBOARD_ASPECT_RATIOS)[number]["key"];

export function stylePromptHint(stylePreset: string): string {
  return (
    STORYBOARD_STYLE_PRESETS.find((s) => s.key === stylePreset)?.promptHint ??
    STORYBOARD_STYLE_PRESETS[0].promptHint
  );
}
