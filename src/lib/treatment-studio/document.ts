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

/** Curated treatment page templates for the New Slide menu. */
export type TreatmentSlideTemplateId =
  | "title"
  | "logline"
  | "characters"
  | "world"
  | "tone"
  | "story"
  | "sequences"
  | "themes"
  | "references"
  | "closing"
  | "blank"
  | "content"
  | "split"
  | "image";

export type TreatmentSlideTemplate = {
  id: TreatmentSlideTemplateId;
  label: string;
  description: string;
  layout: TreatmentSlideLayout;
  backgroundColor?: string;
  title: string;
  subtitle?: string;
  body?: string;
  elements?: Omit<TreatmentElement, "id">[];
};

export const TREATMENT_SLIDE_TEMPLATES: TreatmentSlideTemplate[] = [
  {
    id: "title",
    label: "Project title",
    description: "Opening title card with byline",
    layout: "title",
    backgroundColor: "#0f172a",
    title: "Project Title",
    subtitle: "A treatment by [Director Name]",
    elements: [],
  },
  {
    id: "logline",
    label: "Logline",
    description: "One-sentence pitch",
    layout: "content",
    title: "Logline",
    body: "In one or two sentences, what is this film about — and why now?",
  },
  {
    id: "characters",
    label: "Characters",
    description: "Protagonist & key cast",
    layout: "content",
    title: "Characters",
    body: "PROTAGONIST\nWho they are, what they want, what stands in their way.\n\nSUPPORTING\nKey relationships that drive the story.",
    elements: [
      {
        type: "shape",
        x: 72,
        y: 18,
        width: 22,
        height: 28,
        zIndex: 2,
        shape: "ellipse",
        fill: "#fed7aa",
      },
      {
        type: "text",
        x: 72,
        y: 48,
        width: 22,
        height: 10,
        zIndex: 3,
        text: "Portrait\nref",
        fontSize: 14,
        fontWeight: "500",
        color: "#78716c",
        align: "center",
      },
    ],
  },
  {
    id: "world",
    label: "World & setting",
    description: "Time, place, atmosphere",
    layout: "split",
    title: "World & Setting",
    body: "Where and when does the story live?\nDescribe the physical and emotional landscape.",
  },
  {
    id: "tone",
    label: "Tone & visuals",
    description: "Look, palette, references",
    layout: "split",
    title: "Tone & Visual Direction",
    body: "Tone, colour palette, camera language, and reference films or stills.",
  },
  {
    id: "story",
    label: "Story overview",
    description: "Act structure summary",
    layout: "content",
    title: "Story",
    body: "ACT I — Setup\n\nACT II — Confrontation\n\nACT III — Resolution",
  },
  {
    id: "sequences",
    label: "Key sequences",
    description: "Set pieces & turning points",
    layout: "content",
    title: "Key Sequences",
    body: "1. Opening image\n2. Inciting incident\n3. Midpoint turn\n4. Climax",
  },
  {
    id: "themes",
    label: "Themes",
    description: "Ideas under the story",
    layout: "content",
    backgroundColor: "#f8fafc",
    title: "Themes",
    body: "What is this film really about beneath the plot?",
  },
  {
    id: "references",
    label: "Reference board",
    description: "Grid of visual refs",
    layout: "references",
    title: "References",
  },
  {
    id: "image",
    label: "Full-bleed image",
    description: "Hero still with caption",
    layout: "image",
    title: "Caption",
  },
  {
    id: "closing",
    label: "Closing / thank you",
    description: "Contact & next steps",
    layout: "title",
    backgroundColor: "#111827",
    title: "Thank you",
    subtitle: "Contact · Next steps · Availability",
  },
  {
    id: "blank",
    label: "Blank canvas",
    description: "Empty page for freeform",
    layout: "blank",
    title: "",
  },
  {
    id: "content",
    label: "Content page",
    description: "Title + body copy",
    layout: "content",
    title: "Section title",
    body: "Write your treatment copy…",
  },
];

export function createSlideFromTemplate(
  templateId: TreatmentSlideTemplateId = "content",
): TreatmentSlide {
  const template =
    TREATMENT_SLIDE_TEMPLATES.find((t) => t.id === templateId) ??
    TREATMENT_SLIDE_TEMPLATES.find((t) => t.id === "content")!;
  const slide = createSlide(template.layout);
  slide.title = template.title;
  slide.subtitle = template.subtitle ?? "";
  slide.body = template.body ?? "";
  if (template.backgroundColor) slide.backgroundColor = template.backgroundColor;
  slide.elements = (template.elements ?? []).map((el) => ({
    ...el,
    id: newId(),
  }));
  return slide;
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
