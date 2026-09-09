import type {
  TreatmentFieldFrame,
  TreatmentFieldKey,
  TreatmentSlide,
  TreatmentSlideLayout,
} from "./types";

const DEFAULTS: Record<
  TreatmentSlideLayout,
  Partial<Record<TreatmentFieldKey, TreatmentFieldFrame>>
> = {
  title: {
    title: { x: 8, y: 30, width: 84, height: 18 },
    subtitle: { x: 12, y: 52, width: 76, height: 12 },
  },
  content: {
    title: { x: 6, y: 6, width: 88, height: 12 },
    body: { x: 6, y: 20, width: 88, height: 68 },
  },
  split: {
    title: { x: 5, y: 22, width: 40, height: 14 },
    body: { x: 5, y: 40, width: 40, height: 45 },
  },
  image: {
    title: { x: 5, y: 78, width: 90, height: 14 },
  },
  references: {
    title: { x: 5, y: 4, width: 90, height: 10 },
  },
  blank: {},
};

export function defaultFieldFrame(
  layout: TreatmentSlideLayout,
  key: TreatmentFieldKey,
): TreatmentFieldFrame | null {
  return DEFAULTS[layout]?.[key] ?? null;
}

export function resolveFieldFrame(
  slide: TreatmentSlide,
  key: TreatmentFieldKey,
): TreatmentFieldFrame | null {
  return slide.fieldFrames?.[key] ?? defaultFieldFrame(slide.layout, key);
}

export function fieldsForLayout(layout: TreatmentSlideLayout): TreatmentFieldKey[] {
  switch (layout) {
    case "title":
      return ["title", "subtitle"];
    case "content":
    case "split":
      return ["title", "body"];
    case "image":
    case "references":
      return ["title"];
    case "blank":
    default:
      return [];
  }
}
