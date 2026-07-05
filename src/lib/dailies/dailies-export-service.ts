import { buildDocumentPdf, type PdfBlock } from "@/lib/pdf/document-pdf";
import type { DailiesDailyReport, DailiesIntelligencePayload } from "@/lib/dailies/types";
import { TAKE_STATUS_LABELS } from "@/lib/dailies/departments";

function csvEscape(v: string | number): string {
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function dailiesClipsToCsv(payload: DailiesIntelligencePayload): string {
  const header = [
    "Scene",
    "Shot",
    "Take",
    "Title",
    "Status",
    "Camera",
    "Lens",
    "Shoot Day",
    "Notes Open",
    "Duration Ms",
  ];
  const lines = [header.join(",")];
  for (const c of payload.clips) {
    lines.push(
      [
        csvEscape(c.sceneNumber ?? ""),
        csvEscape(c.shotNumber ?? ""),
        csvEscape(c.takeNumber ?? ""),
        csvEscape(c.title ?? ""),
        csvEscape(TAKE_STATUS_LABELS[c.takeStatus] ?? c.takeStatus),
        csvEscape(c.camera ?? ""),
        csvEscape(c.lens ?? ""),
        csvEscape(c.shootDayDate ? new Date(c.shootDayDate).toLocaleDateString() : ""),
        csvEscape(c.openNoteCount),
        csvEscape(c.durationMs ?? ""),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function dailiesReportToPdfText(
  payload: DailiesIntelligencePayload,
  projectTitle: string,
  report?: DailiesDailyReport,
): Buffer {
  const blocks: PdfBlock[] = [
    { type: "title", text: "DAILIES REPORT" },
    { type: "subtitle", text: projectTitle },
    {
      type: "line",
      text: `Generated ${new Date(payload.generatedAt).toLocaleString()}`,
    },
    { type: "blank" },
    { type: "heading", text: "Summary" },
    {
      type: "kv",
      label: "Clips",
      value: String(payload.summary.totalClips),
    },
    {
      type: "kv",
      label: "Circle takes",
      value: String(payload.summary.circleTakes),
    },
    {
      type: "kv",
      label: "Review completion",
      value: `${payload.summary.reviewCompletionPercent}%`,
    },
    {
      type: "kv",
      label: "Coverage",
      value: `${payload.summary.coveragePercent}%`,
    },
    {
      type: "kv",
      label: "Production health",
      value: String(payload.summary.productionHealthScore),
    },
  ];

  if (report) {
    blocks.push(
      { type: "heading", text: "Daily production summary" },
      {
        type: "kv",
        label: "Shoot day",
        value: new Date(report.shootDayDate).toLocaleDateString(),
      },
      {
        type: "kv",
        label: "Completed scenes",
        value: report.completedScenes.join(", ") || "—",
      },
      {
        type: "kv",
        label: "Approved / circle / reshoots",
        value: `${report.approvedTakes} / ${report.circleTakes} / ${report.reshootsNeeded}`,
      },
    );
    if (report.productionRisks.length) {
      blocks.push({ type: "heading", text: "Risks" });
      blocks.push({ type: "bullets", items: report.productionRisks });
    }
    if (report.tomorrowPrep.length) {
      blocks.push({ type: "heading", text: "Tomorrow prep" });
      blocks.push({ type: "bullets", items: report.tomorrowPrep });
    }
  }

  blocks.push({ type: "heading", text: "Clip summary" });
  if (payload.clips.length === 0) {
    blocks.push({ type: "line", text: "No clips recorded." });
  } else {
    blocks.push({
      type: "table",
      headers: ["Scene", "Shot", "Take", "Status", "Title"],
      rows: payload.clips.slice(0, 120).map((c) => [
        c.sceneNumber ?? "—",
        c.shotNumber ?? "—",
        c.takeNumber != null ? String(c.takeNumber) : "—",
        TAKE_STATUS_LABELS[c.takeStatus] ?? c.takeStatus,
        (c.title ?? "—").slice(0, 40),
      ]),
    });
  }

  if (payload.insights.length) {
    blocks.push({ type: "heading", text: "Production intelligence" });
    blocks.push({
      type: "bullets",
      items: payload.insights.slice(0, 20).map((i) => `${i.title}: ${i.body}`),
    });
  }

  return buildDocumentPdf({
    title: `${projectTitle} — Dailies Report`,
    footer: projectTitle,
    blocks,
  });
}

export function dailiesClipsToExcelXml(payload: DailiesIntelligencePayload): string {
  const rows = payload.clips
    .map(
      (c) =>
        `<Row><Cell><Data ss:Type="String">${(c.sceneNumber ?? "").replace(/&/g, "&amp;")}</Data></Cell><Cell><Data ss:Type="String">${(c.title ?? "").replace(/&/g, "&amp;")}</Data></Cell><Cell><Data ss:Type="String">${c.takeStatus}</Data></Cell><Cell><Data ss:Type="Number">${c.openNoteCount}</Data></Cell></Row>`,
    )
    .join("");
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Dailies"><Table>${rows}</Table></Worksheet></Workbook>`;
}
