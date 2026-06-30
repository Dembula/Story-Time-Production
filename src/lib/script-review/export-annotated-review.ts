import type { ReviewAnnotationRecord } from "./types";
import { stampLabel } from "./stamps";
import type { ReviewStamp } from "./types";

type Point = [number, number];

function pointsToPath(points: Point[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
}

function renderAnnotationSvg(ann: ReviewAnnotationRecord): string {
  const d = ann.data ?? {};
  if (ann.type === "draw" || ann.type === "highlighter") {
    const points = (d.points as Point[]) ?? [];
    return `<path d="${pointsToPath(points)}" fill="none" stroke="${d.color ?? "#dc2626"}" stroke-width="${d.width ?? 2}" opacity="${d.opacity ?? 1}" />`;
  }
  if (ann.type === "stamp") {
    const stamp = (d.stamp as ReviewStamp) ?? "approved";
    const meta = stampLabel(stamp, d.date as string | undefined);
    const x = (d.x as number) ?? 0;
    const y = (d.y as number) ?? 0;
    return `<g transform="translate(${x},${y})"><rect width="120" height="36" rx="4" fill="#fef3c7" stroke="#b45309" stroke-width="2"/><text x="60" y="22" text-anchor="middle" font-size="11" font-weight="bold" fill="#92400e">${meta}</text></g>`;
  }
  if (ann.type === "sticky" && ann.body) {
    return `<g><rect x="${d.x}" y="${d.y}" width="${d.w ?? 120}" height="${d.h ?? 70}" fill="#fef08a" stroke="#ca8a04" rx="4"/><text x="${(d.x as number) + 6}" y="${(d.y as number) + 18}" font-size="11">${ann.body.slice(0, 80)}</text></g>`;
  }
  if (ann.type === "text") {
    return `<text x="${d.x}" y="${d.y}" fill="${d.color ?? "#dc2626"}" font-size="${d.fontSize ?? 14}">${d.text ?? ""}</text>`;
  }
  return "";
}

/** Opens a print-ready annotated screenplay (save as PDF via browser print). */
export function exportAnnotatedReviewPdf(input: {
  title: string;
  pages: string[][];
  annotations: ReviewAnnotationRecord[];
  coverageReport?: string | null;
}) {
  const { title, pages, annotations, coverageReport } = input;
  const pageHtml = pages
    .map((lines, pageIndex) => {
      const pageAnns = annotations.filter((a) => a.pageIndex === pageIndex);
      const svgMarks = pageAnns.map(renderAnnotationSvg).join("");
      const marginNotes = pageAnns
        .filter((a) => a.type === "margin" && a.body)
        .map(
          (a) =>
            `<div class="margin-note" style="top:${48 + ((a.data?.lineLocal as number) ?? 0) * 19.2}px">${a.body}</div>`,
        )
        .join("");
      return `<section class="page"><div class="page-num">${pageIndex + 1}.</div>${lines.map((l) => `<div class="line">${l || "&nbsp;"}</div>`).join("")}<svg class="overlay">${svgMarks}</svg>${marginNotes}</section>`;
    })
    .join("");

  const coverage = coverageReport?.trim()
    ? `<section class="coverage"><h2>Coverage report</h2><pre>${coverageReport}</pre></section>`
    : "";

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title} — Annotated review</title>
<style>
@page { size: letter; margin: 0.5in; }
body { font-family: "Courier New", monospace; font-size: 12pt; line-height: 1.2; color: #000; margin: 0; }
.page { position: relative; min-height: 10in; padding: 1in 1.5in 1in 1.5in; page-break-after: always; box-sizing: border-box; }
.page-num { text-align: right; font-size: 10px; color: #888; margin-bottom: 1rem; }
.line { min-height: 1.2em; white-space: pre-wrap; }
.overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.margin-note { position: absolute; right: -180px; width: 160px; border: 1px solid #fca5a5; background: #fef2f2; padding: 4px 8px; font-size: 10px; color: #7f1d1d; }
.coverage { padding: 1in; page-break-before: always; font-family: system-ui, sans-serif; }
.coverage pre { white-space: pre-wrap; font-size: 11pt; }
h1 { font-family: system-ui, sans-serif; padding: 0.5in 1in 0; font-size: 18pt; }
</style></head><body>
<h1>${title} — Annotated script review</h1>
${pageHtml}
${coverage}
<script>window.onload = () => { window.print(); }</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    throw new Error("Pop-up blocked — allow pop-ups to export annotated PDF.");
  }
  w.document.write(html);
  w.document.close();
}
