export const REVIEW_LAYERS = [
  { id: "producer", label: "Producer Notes", color: "#ef4444" },
  { id: "director", label: "Director Notes", color: "#3b82f6" },
  { id: "writer", label: "Writer Notes", color: "#22c55e" },
  { id: "legal", label: "Legal Notes", color: "#a855f7" },
  { id: "budget", label: "Budget Notes", color: "#eab308" },
  { id: "executive", label: "Executive Notes", color: "#f97316" },
  { id: "continuity", label: "Continuity Notes", color: "#06b6d4" },
  // Production HODs — department leads may also leave notes on the same draft
  { id: "ad", label: "1st AD Notes", color: "#f43f5e" },
  { id: "dop", label: "DOP / Camera Notes", color: "#0ea5e9" },
  { id: "production_design", label: "Production Design Notes", color: "#d946ef" },
  { id: "art", label: "Art Department Notes", color: "#c026d3" },
  { id: "costume", label: "Costume Notes", color: "#ec4899" },
  { id: "hair_makeup", label: "Hair & Makeup Notes", color: "#f472b6" },
  { id: "gaffer", label: "Gaffer / Lighting Notes", color: "#fbbf24" },
  { id: "sound", label: "Sound Notes", color: "#14b8a6" },
  { id: "locations", label: "Locations Notes", color: "#84cc16" },
  { id: "stunts", label: "Stunts Notes", color: "#f87171" },
  { id: "vfx", label: "VFX Notes", color: "#818cf8" },
  { id: "editor", label: "Editor Notes", color: "#67e8f9" },
  { id: "production", label: "Production / UPM Notes", color: "#fb923c" },
] as const;

export type ReviewLayerId = (typeof REVIEW_LAYERS)[number]["id"];

/** Core creative / business note layers (shown first in the notes picker). */
export const CORE_REVIEW_LAYER_IDS: ReviewLayerId[] = [
  "producer",
  "director",
  "writer",
  "legal",
  "budget",
  "executive",
  "continuity",
];

/** Production HOD note layers. */
export const HOD_REVIEW_LAYER_IDS: ReviewLayerId[] = REVIEW_LAYERS.map((l) => l.id).filter(
  (id) => !CORE_REVIEW_LAYER_IDS.includes(id),
);

export type ReviewTool =
  | "red_pen"
  | "blue_pen"
  | "black_pen"
  | "green_pen"
  | "highlighter"
  | "pencil"
  | "eraser"
  | "line"
  | "arrow"
  | "rectangle"
  | "circle"
  | "free_draw"
  | "text"
  | "sticky"
  | "comment"
  | "stamp";

export type ReviewStamp =
  | "approved"
  | "rejected"
  | "needs_revision"
  | "approved_with_notes"
  | "date";

export const REVIEW_STATUSES = [
  "PENDING_REVIEW",
  "IN_REVIEW",
  "NEEDS_CHANGES",
  "MAJOR_REWRITE",
  "MINOR_REWRITE",
  "APPROVED",
  "APPROVED_WITH_NOTES",
  "PRODUCTION_READY",
  "LOCKED",
  "ARCHIVED",
] as const;

export type ReviewAnnotationRecord = {
  id: string;
  type: string;
  layer: string;
  pageIndex: number;
  lineIndex: number | null;
  anchorText: string | null;
  body: string | null;
  data: Record<string, unknown> | null;
  priority: string | null;
  status: string;
  resolved: boolean;
  parentId: string | null;
  createdAt: string;
  author: { id: string; name: string | null; professionalName: string | null; image: string | null };
  replies?: ReviewAnnotationRecord[];
};

export const LINES_PER_PAGE = 55;

export function paginateScreenplay(content: string): string[][] {
  const lines = content.split(/\r?\n/);
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + LINES_PER_PAGE));
  }
  if (pages.length === 0) pages.push([""]);
  return pages;
}

export function toolColor(tool: ReviewTool): string {
  switch (tool) {
    case "blue_pen":
      return "#2563eb";
    case "black_pen":
      return "#171717";
    case "green_pen":
      return "#16a34a";
    case "highlighter":
      return "#facc15";
    case "pencil":
      return "#64748b";
    default:
      return "#dc2626";
  }
}

export function toolStrokeWidth(tool: ReviewTool): number {
  if (tool === "highlighter") return 14;
  if (tool === "pencil") return 1.5;
  if (tool === "eraser") return 18;
  return 2.5;
}
