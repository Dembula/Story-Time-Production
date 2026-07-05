import { buildDocumentPdf } from "@/lib/pdf/document-pdf";
import type { BreakdownIntelligencePayload } from "@/lib/breakdown/types";
import { CATEGORY_LABELS } from "@/lib/breakdown/departments";

function plainTextToPdfBuffer(text: string, title: string): Buffer {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  return buildDocumentPdf({
    title,
    footer: title,
    blocks: lines.map((line) => ({ type: "line" as const, text: line })),
  });
}

function csvEscape(v: string | number): string {
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function breakdownCatalogToCsv(payload: BreakdownIntelligencePayload): string {
  const header = ["Category", "Asset", "Description", "Scenes", "Department"];
  const lines = [header.join(",")];
  for (const a of payload.catalog) {
    lines.push(
      [
        csvEscape(CATEGORY_LABELS[a.category]),
        csvEscape(a.label),
        csvEscape(a.description ?? ""),
        csvEscape(a.sceneNumbers.join("; ")),
        csvEscape(a.departmentId),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function breakdownCatalogToExcelXml(payload: BreakdownIntelligencePayload): string {
  const rows = payload.catalog
    .map(
      (a) =>
        `<Row><Cell><Data ss:Type="String">${CATEGORY_LABELS[a.category]}</Data></Cell><Cell><Data ss:Type="String">${a.label.replace(/&/g, "&amp;")}</Data></Cell><Cell><Data ss:Type="String">${(a.description ?? "").replace(/&/g, "&amp;")}</Data></Cell><Cell><Data ss:Type="String">${a.sceneNumbers.join(", ")}</Data></Cell></Row>`,
    )
    .join("");
  const sceneRows = payload.scenes
    .map(
      (s) =>
        `<Row><Cell><Data ss:Type="String">Scene ${s.sceneNumber}</Data></Cell><Cell><Data ss:Type="String">${(s.heading ?? "").replace(/&/g, "&amp;")}</Data></Cell><Cell><Data ss:Type="Number">${s.complexityScore}</Data></Cell><Cell><Data ss:Type="Number">${s.estimatedShootHours}</Data></Cell></Row>`,
    )
    .join("");
  return `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Catalog"><Table>${rows}</Table></Worksheet><Worksheet ss:Name="Scenes"><Table>${sceneRows}</Table></Worksheet></Workbook>`;
}

export function breakdownReportToPdfText(payload: BreakdownIntelligencePayload, projectTitle: string): Buffer {
  const lines: string[] = [
    `Story Time — Breakdown Report`,
    projectTitle,
    `Generated: ${payload.generatedAt}`,
    "",
    `Scenes: ${payload.summary.sceneCount} · Assets: ${payload.summary.assetCount} · Readiness: ${payload.summary.overallReadiness}%`,
    "",
    "— SCENES —",
  ];

  for (const s of payload.scenes) {
    lines.push(
      `Scene ${s.sceneNumber}: ${s.heading ?? "—"}`,
      `  Complexity ${s.complexityScore} · Shoot ~${s.estimatedShootHours}h · Risk: ${s.productionRisk}`,
      s.summary ? `  ${s.summary}` : "",
      "",
    );
  }

  lines.push("— CATALOG —");
  for (const a of payload.catalog.slice(0, 200)) {
    lines.push(`[${CATEGORY_LABELS[a.category]}] ${a.label} — Scenes: ${a.sceneNumbers.join(", ") || "—"}`);
  }

  if (payload.insights.length > 0) {
    lines.push("", "— INSIGHTS —");
    for (const ins of payload.insights.slice(0, 15)) {
      lines.push(`• ${ins.title}: ${ins.body}`);
    }
  }

  return plainTextToPdfBuffer(lines.join("\n"), `${projectTitle} — Breakdown`);
}

export function breakdownSceneSheetsToPdfText(payload: BreakdownIntelligencePayload, projectTitle: string): Buffer {
  const blocks: string[] = [];
  for (const s of payload.scenes) {
    blocks.push(
      `SCENE ${s.sceneNumber}`,
      s.heading ?? "",
      `${s.intExt ?? ""} ${s.timeOfDay ?? ""}`.trim(),
      "",
      s.summary ?? "",
      "",
      "Elements:",
      ...Object.entries(s.counts)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `  ${k}: ${n}`),
      "",
      "---",
      "",
    );
  }
  return plainTextToPdfBuffer(blocks.join("\n"), `${projectTitle} — Scene Breakdown Sheets`);
}
