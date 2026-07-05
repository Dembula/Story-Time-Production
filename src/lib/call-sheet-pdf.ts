import type {
  CallSheetCastRow,
  CallSheetHeader,
  CallSheetLocationRow,
  CallSheetSafetyLine,
  CallSheetScheduleRow,
  CallSheetTaskRow,
  CallSheetTiming,
} from "@/lib/call-sheet-builder";
import { buildDocumentPdf, type PdfBlock } from "@/lib/pdf/document-pdf";

export type CallSheetPdfInput = {
  header: CallSheetHeader;
  timing: CallSheetTiming;
  weather?: string | null;
  logistics?: Record<string, string | null | undefined> | null;
  equipment?: { equipmentName: string; category: string; quantity: number }[];
  schedule: CallSheetScheduleRow[];
  cast: CallSheetCastRow[];
  crew: Array<{ role: string; name: string; department?: string; callTime?: string | null }>;
  locations: CallSheetLocationRow[];
  tasks?: CallSheetTaskRow[];
  safety?: CallSheetSafetyLine[];
  dayNotes?: string | null;
  extraNotes?: string | null;
  versionLabel?: string | null;
};

function formatDate(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso || "—";
  return dt.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function clean(value: string | null | undefined, fallback = "—"): string {
  const t = (value ?? "").replace(/\s+/g, " ").trim();
  return t || fallback;
}

/** Build a formatted call sheet PDF (not a screenshot). */
export function buildCallSheetPdf(input: CallSheetPdfInput): Buffer {
  const blocks: PdfBlock[] = [
    { type: "title", text: "CALL SHEET" },
    { type: "subtitle", text: input.header.productionTitle },
  ];

  if (input.header.productionCompany) {
    blocks.push({ type: "line", text: input.header.productionCompany });
  }
  if (input.versionLabel) {
    blocks.push({ type: "line", text: input.versionLabel });
  }

  blocks.push(
    { type: "blank" },
    {
      type: "kv",
      label: "Shoot day",
      value: `Day ${input.header.shootDayNumber} of ${input.header.totalShootDays}`,
    },
    { type: "kv", label: "Date", value: formatDate(input.header.dateIso) },
    {
      type: "kv",
      label: "Primary location",
      value: clean(input.header.primaryLocationSummary),
    },
  );
  if (input.weather) blocks.push({ type: "kv", label: "Weather", value: clean(input.weather) });

  blocks.push({ type: "heading", text: "General timing" });
  blocks.push({ type: "kv", label: "General call", value: clean(input.timing.generalCall) });
  blocks.push({ type: "kv", label: "Est. wrap", value: clean(input.timing.estimatedWrap) });
  if (input.timing.mealBreakNotes) {
    blocks.push({ type: "kv", label: "Meals / catering", value: clean(input.timing.mealBreakNotes) });
  }
  if (input.logistics) {
    for (const [key, value] of Object.entries(input.logistics)) {
      if (!value?.trim()) continue;
      const label = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (c) => c.toUpperCase())
        .trim();
      blocks.push({ type: "kv", label, value: value.trim() });
    }
  }

  blocks.push({ type: "heading", text: "Scene breakdown" });
  if (input.schedule.length === 0) {
    blocks.push({ type: "line", text: "No scenes scheduled for this shoot day." });
  } else {
    blocks.push({
      type: "table",
      headers: ["#", "Scene", "I/E", "Location", "Est."],
      rows: input.schedule.map((s) => [
        String(s.order + 1),
        `Sc. ${s.sceneNumber}${s.heading ? ` ${s.heading}` : ""}`,
        [s.intExt, s.timeOfDay].filter(Boolean).join(" ") || "—",
        clean(s.primaryLocationLabel),
        s.durationMinutes != null ? `${s.durationMinutes}m` : "—",
      ]),
    });
  }

  blocks.push({ type: "heading", text: "Cast" });
  if (input.cast.length === 0) {
    blocks.push({
      type: "line",
      text: "No cast linked yet. Add characters in Script Breakdown and assign casting roles.",
    });
  } else {
    blocks.push({
      type: "table",
      headers: ["Talent", "Role", "Call", "Scenes"],
      rows: input.cast.map((c) => [
        clean(c.talentName, clean(c.characterName)),
        clean(c.roleName || c.characterName),
        clean(c.callTime),
        c.scenesInvolved?.length ? c.scenesInvolved.join(", ") : "—",
      ]),
    });
  }

  blocks.push({ type: "heading", text: "Crew" });
  if (input.crew.length === 0) {
    blocks.push({ type: "line", text: "No crew listed for this day." });
  } else {
    blocks.push({
      type: "table",
      headers: ["Name", "Role", "Dept", "Call"],
      rows: input.crew.map((c) => [
        clean(c.name),
        clean(c.role),
        clean(c.department),
        clean(c.callTime),
      ]),
    });
  }

  blocks.push({ type: "heading", text: "Equipment" });
  if (!input.equipment?.length) {
    blocks.push({ type: "line", text: "—" });
  } else {
    blocks.push({
      type: "table",
      headers: ["Item", "Category", "Qty"],
      rows: input.equipment.map((e) => [
        clean(e.equipmentName),
        clean(e.category),
        String(e.quantity ?? 1),
      ]),
    });
  }

  blocks.push({ type: "heading", text: "Locations" });
  if (input.locations.length === 0) {
    blocks.push({ type: "line", text: "—" });
  } else {
    for (const loc of input.locations) {
      blocks.push({ type: "line", text: clean(loc.name) });
      if (loc.addressLine) blocks.push({ type: "line", text: `  ${loc.addressLine}` });
      if (loc.description) blocks.push({ type: "line", text: `  ${loc.description}` });
    }
  }

  if (input.tasks && input.tasks.length > 0) {
    blocks.push({ type: "heading", text: "On-set tasks" });
    blocks.push({
      type: "table",
      headers: ["Task", "Dept", "Status"],
      rows: input.tasks.map((t) => [clean(t.title), clean(t.department), clean(t.status)]),
    });
  }

  if (input.safety && input.safety.length > 0) {
    blocks.push({ type: "heading", text: "Safety & risk" });
    blocks.push({
      type: "bullets",
      items: input.safety.map((s) => {
        const sev = s.severity ? ` [${s.severity}]` : "";
        return `${s.category}${sev}: ${s.line}`;
      }),
    });
  }

  const notes = [input.dayNotes, input.extraNotes].filter((n) => n?.trim());
  if (notes.length > 0) {
    blocks.push({ type: "heading", text: "Production notes" });
    for (const note of notes) {
      blocks.push({ type: "line", text: note!.trim() });
    }
  }

  blocks.push(
    { type: "blank" },
    {
      type: "line",
      text: `Generated ${new Date().toLocaleString()} · Story Time Production`,
    },
  );

  return buildDocumentPdf({
    title: `Call sheet — ${input.header.productionTitle}`,
    footer: input.header.productionTitle,
    blocks,
  });
}
