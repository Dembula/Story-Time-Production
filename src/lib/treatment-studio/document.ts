import type {
  TreatmentDocument,
  TreatmentSlide,
  TreatmentSlideLayout,
} from "./types";

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createDefaultDocument(): TreatmentDocument {
  return {
    slides: [createSlide("title")],
    assets: [],
    settings: {
      aspectRatio: "16:9",
      theme: "light",
    },
  };
}

const LAYOUT_DEFAULTS: Record<
  TreatmentSlideLayout,
  Pick<TreatmentSlide, "title" | "subtitle" | "body">
> = {
  title: {
    title: "Project Title",
    subtitle: "A treatment by [Director Name]",
    body: "",
  },
  content: {
    title: "Story",
    subtitle: "",
    body: "Describe the world, characters, and emotional arc of your film.",
  },
  split: {
    title: "Visual Direction",
    subtitle: "",
    body: "Tone, palette, and reference notes for this sequence.",
  },
  image: {
    title: "",
    subtitle: "",
    body: "",
  },
  references: {
    title: "References",
    subtitle: "",
    body: "",
  },
  blank: {
    title: "",
    subtitle: "",
    body: "",
  },
};

export function createSlide(layout: TreatmentSlideLayout = "content"): TreatmentSlide {
  const defaults = LAYOUT_DEFAULTS[layout];
  return {
    id: newId(),
    layout,
    title: defaults.title,
    subtitle: defaults.subtitle,
    body: defaults.body,
    notes: "",
    backgroundColor: "#ffffff",
    referenceIds: [],
    elements: [],
  };
}

export function parseTreatmentDocument(raw: unknown): TreatmentDocument {
  if (!raw || typeof raw !== "object") return createDefaultDocument();
  const doc = raw as Partial<TreatmentDocument>;
  const slides = Array.isArray(doc.slides) && doc.slides.length > 0
    ? doc.slides
    : [createSlide("title")];
  return {
    slides,
    assets: Array.isArray(doc.assets) ? doc.assets : [],
    settings: {
      aspectRatio: doc.settings?.aspectRatio === "4:3" ? "4:3" : "16:9",
      theme: doc.settings?.theme === "dark" ? "dark" : "light",
    },
  };
}

export function treatmentHasMeaningfulContent(document: TreatmentDocument): boolean {
  if (document.assets.length > 0) return true;
  if (document.slides.length > 1) return true;
  const first = document.slides[0];
  if (!first) return false;
  return Boolean(
    first.body?.trim() ||
      first.subtitle?.trim() ||
      (first.title?.trim() && first.title !== "Project Title") ||
      first.elements.length > 0 ||
      first.referenceIds.length > 0,
  );
}

export function serializeTreatmentForDb(document: TreatmentDocument) {
  return document as object;
}
