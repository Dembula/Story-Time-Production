import { contractTermsToPdfBuffer } from "@/lib/legal/contract-pdf-export";
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
  const lines: string[] = [
    "Story Time — Dailies Report",
    projectTitle,
    `Generated: ${payload.generatedAt}`,
    "",
    `Clips: ${payload.summary.totalClips} · Circle takes: ${payload.summary.circleTakes} · Review: ${payload.summary.reviewCompletionPercent}%`,
    `Coverage: ${payload.summary.coveragePercent}% · Health: ${payload.summary.productionHealthScore}`,
    "",
  ];

  if (report) {
    lines.push("Daily production summary", `Shoot day: ${new Date(report.shootDayDate).toLocaleDateString()}`, "");
    lines.push(`Completed scenes: ${report.completedScenes.join(", ") || "—"}`);
    lines.push(`Approved: ${report.approvedTakes} · Circle: ${report.circleTakes} · Reshoots: ${report.reshootsNeeded}`);
    if (report.productionRisks.length) lines.push("", "Risks:", ...report.productionRisks.map((r) => `• ${r}`));
    if (report.tomorrowPrep.length) lines.push("", "Tomorrow prep:", ...report.tomorrowPrep.map((r) => `• ${r}`));
    lines.push("");
  }

  lines.push("Clip summary");
  for (const c of payload.clips.slice(0, 80)) {
    lines.push(
      `Sc.${c.sceneNumber ?? "—"} / ${c.shotNumber ?? "—"} Take ${c.takeNumber ?? "—"} — ${TAKE_STATUS_LABELS[c.takeStatus] ?? c.takeStatus}`,
    );
  }

  if (payload.insights.length) {
    lines.push("", "Production intelligence");
    for (const i of payload.insights.slice(0, 15)) {
      lines.push(`• ${i.title}: ${i.body}`);
    }
  }

  return contractTermsToPdfBuffer(lines.join("\n"), `${projectTitle} — Dailies Report`);
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
