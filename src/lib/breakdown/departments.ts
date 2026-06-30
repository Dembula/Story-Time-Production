import type { BreakdownCategoryKey, BreakdownDepartmentId } from "@/lib/breakdown/types";

export type BreakdownDepartmentDef = {
  id: BreakdownDepartmentId;
  label: string;
  color: string;
  textColor: string;
  categories: BreakdownCategoryKey[];
  aliases: string[];
};

/** Industry-style department taxonomy mapped to Story Time breakdown categories. */
export const BREAKDOWN_DEPARTMENTS: BreakdownDepartmentDef[] = [
  {
    id: "cast",
    label: "Cast",
    color: "#3b82f6",
    textColor: "#dbeafe",
    categories: ["characters"],
    aliases: ["Cast", "Stand-ins", "Child Actors", "Voice Over"],
  },
  {
    id: "extras_bg",
    label: "Extras & Background",
    color: "#6366f1",
    textColor: "#e0e7ff",
    categories: ["extras"],
    aliases: ["Extras", "Background Actors", "Crowd Control"],
  },
  {
    id: "locations",
    label: "Locations",
    color: "#eab308",
    textColor: "#fef9c3",
    categories: ["locations"],
    aliases: ["Locations", "Interior Sets", "Exterior Sets", "Studio Sets", "Permits"],
  },
  {
    id: "props",
    label: "Props & Set Dressing",
    color: "#22c55e",
    textColor: "#dcfce7",
    categories: ["props"],
    aliases: ["Props", "Hero Props", "Set Dressing", "Weapons", "Product Placement"],
  },
  {
    id: "wardrobe",
    label: "Wardrobe & Costumes",
    color: "#f97316",
    textColor: "#ffedd5",
    categories: ["wardrobe"],
    aliases: ["Wardrobe", "Costumes", "Continuity Wardrobe"],
  },
  {
    id: "hair_makeup",
    label: "Hair & Makeup",
    color: "#ec4899",
    textColor: "#fce7f3",
    categories: ["makeups"],
    aliases: ["Hair", "Makeup", "Special Makeup", "Prosthetics"],
  },
  {
    id: "vehicles",
    label: "Vehicles & Transportation",
    color: "#a855f7",
    textColor: "#f3e8ff",
    categories: ["vehicles"],
    aliases: ["Vehicles", "Transportation"],
  },
  {
    id: "stunts",
    label: "Stunts & Safety",
    color: "#ef4444",
    textColor: "#fee2e2",
    categories: ["stunts"],
    aliases: ["Stunts", "Safety", "Medical", "Fire Safety", "Water Sequences"],
  },
  {
    id: "sfx_vfx",
    label: "SFX / VFX",
    color: "#d946ef",
    textColor: "#fae8ff",
    categories: ["sfx"],
    aliases: ["Special Effects", "Visual Effects", "VFX", "CGI", "Pyrotechnics", "Green Screen", "LED Volume"],
  },
  {
    id: "camera_grip",
    label: "Camera & Grip",
    color: "#64748b",
    textColor: "#f1f5f9",
    categories: [],
    aliases: ["Camera Equipment", "Grip Equipment", "Drone", "Crane", "Steadicam"],
  },
  {
    id: "sound",
    label: "Sound",
    color: "#06b6d4",
    textColor: "#cffafe",
    categories: [],
    aliases: ["Sound Effects", "Playback", "Dialogue", "ADR", "Foley"],
  },
  {
    id: "transport",
    label: "Logistics",
    color: "#78716c",
    textColor: "#f5f5f4",
    categories: [],
    aliases: ["Transportation", "Catering", "Security", "Hotels"],
  },
  {
    id: "safety_legal",
    label: "Legal & Compliance",
    color: "#b45309",
    textColor: "#fef3c7",
    categories: [],
    aliases: ["Legal", "Insurance", "Permits", "Licensing", "Intimacy Coordination", "Animals"],
  },
  {
    id: "post",
    label: "Post Production",
    color: "#0ea5e9",
    textColor: "#e0f2fe",
    categories: [],
    aliases: ["Post Production", "Music Licensing", "Color", "Editing"],
  },
];

export const CATEGORY_TO_DEPARTMENT: Record<BreakdownCategoryKey, BreakdownDepartmentId> = {
  characters: "cast",
  extras: "extras_bg",
  locations: "locations",
  props: "props",
  wardrobe: "wardrobe",
  makeups: "hair_makeup",
  vehicles: "vehicles",
  stunts: "stunts",
  sfx: "sfx_vfx",
};

export function departmentForCategory(category: BreakdownCategoryKey): BreakdownDepartmentDef {
  const id = CATEGORY_TO_DEPARTMENT[category];
  return BREAKDOWN_DEPARTMENTS.find((d) => d.id === id)!;
}

export function departmentById(id: BreakdownDepartmentId): BreakdownDepartmentDef {
  return BREAKDOWN_DEPARTMENTS.find((d) => d.id === id)!;
}

export const CATEGORY_LABELS: Record<BreakdownCategoryKey, string> = {
  characters: "Cast",
  props: "Props",
  locations: "Locations",
  wardrobe: "Wardrobe",
  extras: "Extras",
  vehicles: "Vehicles",
  stunts: "Stunts",
  sfx: "SFX",
  makeups: "Makeup",
};
