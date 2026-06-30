export const REVIEW_LAYERS = [
  { id: "producer", label: "Producer Notes", color: "#ef4444" },
  { id: "director", label: "Director Notes", color: "#3b82f6" },
  { id: "writer", label: "Writer Notes", color: "#22c55e" },
  { id: "legal", label: "Legal Notes", color: "#a855f7" },
  { id: "budget", label: "Budget Notes", color: "#eab308" },
  { id: "executive", label: "Executive Notes", color: "#f97316" },
  { id: "continuity", label: "Continuity Notes", color: "#06b6d4" },
] as const;

export type ReviewLayerId = (typeof REVIEW_LAYERS)[number]["id"];

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
