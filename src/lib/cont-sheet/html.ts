import type { ContSheetCrew, ContSheetDayClock, ContSheetTotals } from "@/lib/cont-sheet/types";
import { formatDurationMss, normalizePrintStatus } from "@/lib/cont-sheet/types";

function esc(text: string | null | undefined): string {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ContSheetExportTake = {
  slate?: string | null;
  takeNumber?: number | null;
  pickup?: number | null;
  printStatus?: string | null;
  durationSec?: number | null;
  description?: string | null;
  notes?: string | null;
  camera?: string | null;
};

export type ContSheetExportScene = {
  episode?: string | null;
  sceneCode: string;
  dayNight?: string | null;
  intExt?: string | null;
  location?: string | null;
  weather?: string | null;
  turnoverTime?: string | null;
  estimatedTiming?: string | null;
  actualTiming?: string | null;
  completionStatus?: string | null;
  takes: ContSheetExportTake[];
};

export type ContSheetExportDay = {
  showTitle?: string | null;
  productionCompany?: string | null;
  callSheetNumber?: string | null;
  reportDate?: string | null;
  cameraUnit?: string | null;
  crew?: ContSheetCrew | null;
  dayClock?: ContSheetDayClock | null;
  scenesSummary?: {
    scheduled?: string[];
    completed?: string[];
    dropped?: string[];
    added?: string[];
    partlyShot?: string[];
  } | null;
  totals?: ContSheetTotals | null;
  notes?: string | null;
  scenes: ContSheetExportScene[];
};

export const CONT_SHEET_PRINT_CSS = `
.cs-doc { font-family: "Segoe UI", Helvetica, Arial, sans-serif; color: #111; font-size: 11px; background: #fff; }
.doc-page.cs-page,
.cs-page {
  position: relative;
  box-sizing: border-box;
  width: 8.5in;
  min-height: 11in;
  margin: 0 auto;
  padding: 0.5in 0.55in;
  background: #fff;
  page-break-after: always;
  break-after: page;
}
.doc-page.cs-page:last-child,
.cs-page:last-child { page-break-after: auto; break-after: auto; }
.cs-kicker { font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: #64748b; font-weight: 700; }
.cs-title { font-size: 18px; font-weight: 700; margin: 4px 0 10px; }
.cs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; margin-bottom: 12px; }
.cs-meta label { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
.cs-meta div { border-bottom: 1px solid #cbd5e1; min-height: 18px; padding: 2px 0; font-weight: 600; }
.cs-section { margin-top: 14px; }
.cs-section h2 { font-size: 12px; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.08em; }
.cs-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.cs-chip { border: 1px solid #94a3b8; border-radius: 999px; padding: 2px 8px; font-size: 10px; }
table.cs-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
table.cs-table th, table.cs-table td {
  border: 1px solid #94a3b8; padding: 4px 5px; vertical-align: top; word-wrap: break-word;
}
table.cs-table th { background: #f1f5f9; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; }
.cs-totals td:first-child { font-weight: 600; width: 28%; }
.cs-footer { margin-top: 14px; font-size: 9px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 6px; }
`;

function chips(list: string[] | undefined): string {
  if (!list?.length) return `<span class="cs-chip">—</span>`;
  return `<div class="cs-chips">${list.map((c) => `<span class="cs-chip">${esc(c)}</span>`).join("")}</div>`;
}

function meta(label: string, value: string | null | undefined): string {
  return `<div class="cs-meta"><label>${esc(label)}</label><div>${esc(value || " ")}</div></div>`;
}

export function buildContSheetBodyHtml(day: ContSheetExportDay): string {
  const crew = day.crew ?? {};
  const clock = day.dayClock ?? {};
  const summary = day.scenesSummary ?? {};
  const totals = day.totals ?? {};
  const prev = totals.previous ?? {};
  const today = totals.today ?? {};
  const total = totals.total ?? {};

  const dpr = `
<article class="doc-page cs-page">
  <p class="cs-kicker">Daily Progress Report${day.cameraUnit ? ` · Cam ${esc(day.cameraUnit)}` : ""}</p>
  <h1 class="cs-title">${esc(day.showTitle || "Cont Sheet / DPR")}</h1>
  <div class="cs-grid">
    ${meta("Production company", day.productionCompany)}
    ${meta("Call sheet #", day.callSheetNumber)}
    ${meta("Date", day.reportDate)}
    ${meta("Line producer", crew.lineProducer)}
    ${meta("Producer", crew.producer)}
    ${meta("Production manager", crew.productionManager)}
    ${meta("Director(s)", crew.directors)}
    ${meta("Script supervisor", crew.scriptSupervisor)}
    ${meta("Call time", clock.callTime)}
    ${meta("First turnover", clock.firstTurnover)}
    ${meta("Lunch", clock.lunch)}
    ${meta("First shot AF/Lunch", clock.firstShotAfterLunch)}
    ${meta("Wrap time", clock.wrapTime)}
  </div>

  <div class="cs-section">
    <h2>Scenes scheduled</h2>
    ${chips(summary.scheduled)}
  </div>
  <div class="cs-section">
    <h2>Scenes shot &amp; completed</h2>
    ${chips(summary.completed)}
  </div>
  <div class="cs-section">
    <h2>Scenes dropped</h2>
    ${chips(summary.dropped)}
  </div>
  <div class="cs-section">
    <h2>Scenes added</h2>
    ${chips(summary.added)}
  </div>
  <div class="cs-section">
    <h2>Scenes partly shot</h2>
    ${chips(summary.partlyShot)}
  </div>

  <div class="cs-section">
    <h2>Scene timings</h2>
    <table class="cs-table">
      <thead><tr><th>Scene</th><th>Est</th><th>Actual</th><th>Status</th></tr></thead>
      <tbody>
        ${
          day.scenes.length
            ? day.scenes
                .map(
                  (s) => `<tr>
            <td>${esc(s.sceneCode)}</td>
            <td>${esc(s.estimatedTiming)}</td>
            <td>${esc(s.actualTiming)}</td>
            <td>${esc(s.completionStatus)}</td>
          </tr>`,
                )
                .join("")
            : `<tr><td colspan="4">No scenes</td></tr>`
        }
      </tbody>
    </table>
  </div>

  <div class="cs-section">
    <h2>Totals</h2>
    <p><strong>Total est:</strong> ${esc(totals.totalEstTime)} &nbsp; <strong>Total act:</strong> ${esc(totals.totalActTime)} &nbsp; <strong>Pages:</strong> ${esc(totals.totalPages)}</p>
    <table class="cs-table cs-totals">
      <thead><tr><th></th><th>Previous</th><th>Today</th><th>Total</th></tr></thead>
      <tbody>
        <tr><td>Scenes shot</td><td>${esc(String(prev.scenesShot ?? ""))}</td><td>${esc(String(today.scenesShot ?? ""))}</td><td>${esc(String(total.scenesShot ?? ""))}</td></tr>
        <tr><td>Screen time</td><td>${esc(prev.screenTime)}</td><td>${esc(today.screenTime)}</td><td>${esc(total.screenTime)}</td></tr>
        <tr><td>Cards</td><td>${esc(String(prev.cards ?? ""))}</td><td>${esc(String(today.cards ?? ""))}</td><td>${esc(String(total.cards ?? ""))}</td></tr>
        <tr><td>Slates</td><td>${esc(String(prev.slates ?? ""))}</td><td>${esc(String(today.slates ?? ""))}</td><td>${esc(String(total.slates ?? ""))}</td></tr>
        <tr><td>Pages</td><td>${esc(prev.pages)}</td><td>${esc(today.pages)}</td><td>${esc(total.pages)}</td></tr>
      </tbody>
    </table>
  </div>
  ${day.notes ? `<div class="cs-section"><h2>Notes</h2><p>${esc(day.notes)}</p></div>` : ""}
  <p class="cs-footer">Story Time Cont Sheet / DPR</p>
</article>`;

  const scenePages = day.scenes
    .map((s) => {
      const rows =
        s.takes.length > 0
          ? s.takes
              .map((t) => {
                const status = normalizePrintStatus(t.printStatus);
                return `<tr>
            <td>${esc(t.slate)}</td>
            <td>${t.takeNumber != null ? esc(String(t.takeNumber)) : ""}</td>
            <td>${t.pickup != null ? esc(String(t.pickup)) : ""}</td>
            <td>${esc(status)}</td>
            <td>${esc(formatDurationMss(t.durationSec))}</td>
            <td>${esc(t.camera || day.cameraUnit)}</td>
            <td>${esc(t.description)}</td>
            <td>${esc(t.notes)}</td>
          </tr>`;
              })
              .join("")
          : `<tr><td colspan="8">No takes logged</td></tr>`;

      const printTakes = s.takes.filter((t) => normalizePrintStatus(t.printStatus) === "PRINT");
      const sceneAct =
        s.actualTiming ||
        formatDurationMss(
          s.takes.reduce((acc, t) => acc + (typeof t.durationSec === "number" ? t.durationSec : 0), 0),
        );

      return `
<article class="doc-page cs-page">
  <p class="cs-kicker">Continuity Sheet${s.takes[0]?.camera ? ` · Cam ${esc(s.takes[0].camera)}` : day.cameraUnit ? ` · Cam ${esc(day.cameraUnit)}` : ""}</p>
  <h1 class="cs-title">EP ${esc(s.episode || "—")} · Scene ${esc(s.sceneCode)}</h1>
  <div class="cs-grid">
    ${meta("Date", day.reportDate)}
    ${meta("Turn over", s.turnoverTime)}
    ${meta("Day / Night", s.dayNight)}
    ${meta("Int / Ext", s.intExt)}
    ${meta("Location", s.location)}
    ${meta("Weather", s.weather)}
    ${meta("Est timing", s.estimatedTiming)}
    ${meta("Actual timing", sceneAct)}
    ${meta("Status", s.completionStatus)}
    ${meta("PRINT takes", String(printTakes.length))}
  </div>
  <table class="cs-table">
    <thead>
      <tr>
        <th style="width:11%">Slate</th>
        <th style="width:8%">Take</th>
        <th style="width:7%">P/U</th>
        <th style="width:10%">Print/NG</th>
        <th style="width:9%">Time</th>
        <th style="width:7%">Cam</th>
        <th style="width:28%">Description</th>
        <th style="width:20%">Notes</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="cs-footer">Story Time Cont Sheet · ${esc(day.showTitle || "")}</p>
</article>`;
    })
    .join("\n");

  // Always include DPR; if there are no scenes yet, still ship a blank cont-sheet page.
  const sheets =
    scenePages ||
    `
<article class="doc-page cs-page">
  <p class="cs-kicker">Continuity Sheet</p>
  <h1 class="cs-title">No scenes logged yet</h1>
  <p>Add scenes and takes in Cont Sheet, then export again.</p>
  <p class="cs-footer">Story Time Cont Sheet · ${esc(day.showTitle || "")}</p>
</article>`;

  return `<div class="cs-doc">${dpr}${sheets}</div>`;
}
