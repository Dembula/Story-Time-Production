import type { DailiesDepartmentId } from "@/lib/dailies/types";

export type DailiesDepartmentDef = {
  id: DailiesDepartmentId;
  label: string;
  color: string;
  textColor: string;
  focus: string[];
};

export const DAILIES_DEPARTMENTS: DailiesDepartmentDef[] = [
  {
    id: "director",
    label: "Director",
    color: "#f97316",
    textColor: "#ffedd5",
    focus: ["Performance", "Coverage", "Story", "Pacing"],
  },
  {
    id: "cinematography",
    label: "Cinematography",
    color: "#3b82f6",
    textColor: "#dbeafe",
    focus: ["Lighting", "Composition", "Exposure", "Focus"],
  },
  {
    id: "script_supervisor",
    label: "Script Supervisor",
    color: "#eab308",
    textColor: "#fef9c3",
    focus: ["Continuity", "Dialogue", "Blocking", "Wardrobe"],
  },
  {
    id: "vfx",
    label: "VFX",
    color: "#a855f7",
    textColor: "#f3e8ff",
    focus: ["Tracking markers", "Clean plates", "Reference frames"],
  },
  {
    id: "editorial",
    label: "Editorial",
    color: "#22c55e",
    textColor: "#dcfce7",
    focus: ["Circle takes", "Metadata", "Sync", "Favourites"],
  },
  {
    id: "producer",
    label: "Producer",
    color: "#ec4899",
    textColor: "#fce7f3",
    focus: ["Progress", "Budget risks", "Schedule", "Approvals"],
  },
  {
    id: "sound",
    label: "Sound",
    color: "#06b6d4",
    textColor: "#cffafe",
    focus: ["Dialogue clarity", "Boom", "Noise", "ADR"],
  },
  {
    id: "continuity",
    label: "Continuity",
    color: "#6366f1",
    textColor: "#e0e7ff",
    focus: ["Props", "Wardrobe", "Hair", "Makeup"],
  },
  {
    id: "executive",
    label: "Executive",
    color: "#64748b",
    textColor: "#f1f5f9",
    focus: ["Approvals", "Highlights", "Risk summary"],
  },
];

export const TAKE_FLAG_LABELS: Record<string, string> = {
  circle_take: "Circle take",
  best_performance: "Best performance",
  editors_favourite: "Editor's favourite",
  directors_pick: "Director's pick",
  producers_pick: "Producer's pick",
  vfx_pick: "VFX pick",
  safety_take: "Safety take",
  alternative_take: "Alternative take",
  reshoot_required: "Reshoot required",
};

export const TAKE_STATUS_LABELS: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  circle: "Circle take",
  rejected: "Rejected",
  reshoot: "Reshoot required",
  safety: "Safety take",
  alt: "Alternative",
};
