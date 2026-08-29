import type {
  TreatmentDocument,
  TreatmentElement,
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

export function createTextElement(
  partial?: Partial<TreatmentElement>,
): TreatmentElement {
  return {
    id: newId(),
    type: "text",
    x: 12,
    y: 35,
    width: 76,
    height: 18,
    zIndex: 10,
    text: "New text",
    fontSize: 28,
    fontWeight: "600",
    color: "#0f172a",
    align: "left",
    ...partial,
  };
}

export function createImageElement(
  assetId: string,
  partial?: Partial<TreatmentElement>,
): TreatmentElement {
  return {
    id: newId(),
    type: "image",
    x: 18,
    y: 18,
    width: 42,
    height: 48,
    zIndex: 5,
    referenceId: assetId,
    ...partial,
  };
}

export function createShapeElement(
  shape: "rect" | "ellipse" = "rect",
  partial?: Partial<TreatmentElement>,
): TreatmentElement {
  return {
    id: newId(),
    type: "shape",
    x: 20,
    y: 25,
    width: 30,
    height: 25,
    zIndex: 2,
    shape,
    fill: "#fb923c",
    stroke: "transparent",
    ...partial,
  };
}

function normalizeElement(raw: unknown, index: number): TreatmentElement | null {
  if (!raw || typeof raw !== "object") return null;
  const el = raw as Partial<TreatmentElement>;
  if (!el.type || !["text", "image", "shape", "line"].includes(el.type)) return null;
  return {
    id: typeof el.id === "string" ? el.id : newId(),
    type: el.type,
    x: Number.isFinite(el.x) ? Number(el.x) : 10,
    y: Number.isFinite(el.y) ? Number(el.y) : 10,
    width: Number.isFinite(el.width) ? Number(el.width) : 30,
    height: Number.isFinite(el.height) ? Number(el.height) : 20,
    rotation: el.rotation,
    zIndex: Number.isFinite(el.zIndex) ? Number(el.zIndex) : index + 1,
    text: el.text,
    fontSize: el.fontSize,
    fontWeight: el.fontWeight,
    color: el.color,
    align: el.align,
    referenceId: el.referenceId,
    shape: el.shape,
    fill: el.fill,
    stroke: el.stroke,
  };
}

function normalizeSlide(raw: unknown): TreatmentSlide {
  if (!raw || typeof raw !== "object") return createSlide("content");
  const s = raw as Partial<TreatmentSlide>;
  const layout =
    s.layout &&
    ["title", "content", "split", "image", "references", "blank"].includes(s.layout)
      ? s.layout
      : "content";
  const defaults = LAYOUT_DEFAULTS[layout];
  const elements = Array.isArray(s.elements)
    ? s.elements
        .map((el, i) => normalizeElement(el, i))
        .filter((el): el is TreatmentElement => Boolean(el))
    : [];
  return {
    id: typeof s.id === "string" ? s.id : newId(),
    layout,
    title: typeof s.title === "string" ? s.title : defaults.title,
    subtitle: typeof s.subtitle === "string" ? s.subtitle : defaults.subtitle,
    body: typeof s.body === "string" ? s.body : defaults.body,
    notes: typeof s.notes === "string" ? s.notes : "",
    backgroundColor:
      typeof s.backgroundColor === "string" ? s.backgroundColor : "#ffffff",
    referenceIds: Array.isArray(s.referenceIds)
      ? s.referenceIds.filter((id): id is string => typeof id === "string")
      : [],
    elements,
  };
}

export function parseTreatmentDocument(raw: unknown): TreatmentDocument {
  if (!raw || typeof raw !== "object") return createDefaultDocument();
  const doc = raw as Partial<TreatmentDocument>;
  const slides =
    Array.isArray(doc.slides) && doc.slides.length > 0
      ? doc.slides.map(normalizeSlide)
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

/** Next z-index above existing elements. */
export function nextElementZIndex(elements: TreatmentElement[]): number {
  if (elements.length === 0) return 1;
  return Math.max(...elements.map((el) => el.zIndex || 0)) + 1;
}
