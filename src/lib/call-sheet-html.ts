import type { CallSheetPdfInput } from "@/lib/call-sheet-pdf";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clean(value: string | null | undefined, fallback = "—"): string {
  const t = (value ?? "").replace(/\s+/g, " ").trim();
  return t || fallback;
}

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

const CALL_SHEET_CSS = `
.call-sheet {
  max-width: 8.5in;
  margin: 0 auto;
  padding: 0.5in 0.65in;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  font-size: 12px;
  line-height: 1.35;
  color: #0f172a;
  background: #fff;
  box-sizing: border-box;
}
.call-sheet h1 { font-size: 1.35rem; margin: 0.25rem 0; font-weight: 700; }
.call-sheet h2 {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  border-bottom: 1px solid #cbd5e1;
  margin: 1.25rem 0 0.5rem;
  padding-bottom: 0.25rem;
}
.call-sheet table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; }
.call-sheet th, .call-sheet td {
  padding: 0.35rem 0.4rem;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: top;
  text-align: left;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}
.call-sheet th { font-weight: 600; }
.call-sheet th:nth-child(1), .call-sheet td:nth-child(1) { width: 4%; }
.call-sheet th:nth-child(2), .call-sheet td:nth-child(2) { width: 18%; }
.call-sheet th:nth-child(3), .call-sheet td:nth-child(3) { width: 14%; }
.call-sheet th:nth-child(4), .call-sheet td:nth-child(4) { width: 14%; }
.call-sheet th:nth-child(5), .call-sheet td:nth-child(5) { width: 38%; }
.call-sheet th:nth-child(6), .call-sheet td:nth-child(6) { width: 8%; text-align: right; }
.call-sheet .cast-crew table th:nth-child(1), .call-sheet .cast-crew table td:nth-child(1) { width: 28%; }
.call-sheet .cast-crew table th:nth-child(2), .call-sheet .cast-crew table td:nth-child(2) { width: 28%; }
.call-sheet .cast-crew table th:nth-child(3), .call-sheet .cast-crew table td:nth-child(3) { width: 18%; }
.call-sheet .cast-crew table th:nth-child(4), .call-sheet .cast-crew table td:nth-child(4) { width: 26%; }
.call-sheet .kicker { font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #64748b; }
.call-sheet .header-meta { display: flex; flex-wrap: wrap; gap: 1rem 1.5rem; margin-top: 0.75rem; }
.call-sheet .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
.call-sheet footer { margin-top: 1.5rem; padding-top: 0.75rem; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; }
@media print {
  .call-sheet { padding: 0.4in 0.5in; }
}
`;

/** Printable call sheet HTML matching the on-screen CallSheetPrintBody layout. */
export function buildCallSheetDocumentHtml(input: CallSheetPdfInput & { sheetNotes?: string | null }): {
  bodyHtml: string;
  extraCss: string;
} {
  const vm = input;
  const dateStr = formatDate(vm.header.dateIso);
  const sheetNotes = input.sheetNotes ?? input.extraNotes;

  const scheduleRows = vm.schedule.length
    ? vm.schedule
        .map(
          (row) => `<tr>
      <td>${row.order + 1}</td>
      <td><strong>${escapeHtml(row.sceneNumber)}</strong>${row.heading ? ` — ${escapeHtml(row.heading)}` : ""}</td>
      <td>${escapeHtml([row.intExt, row.timeOfDay].filter(Boolean).join(" · ") || "—")}</td>
      <td>${escapeHtml(clean(row.primaryLocationLabel))}</td>
      <td>${escapeHtml(clean(row.description))}</td>
      <td style="text-align:right">${row.durationMinutes != null ? `${row.durationMinutes}m` : "—"}</td>
    </tr>`,
        )
        .join("")
    : `<tr><td colspan="6">No scenes scheduled.</td></tr>`;

  const castRows = vm.cast.length
    ? vm.cast
        .map(
          (c) => `<tr>
      <td>${escapeHtml(clean(c.talentName))}</td>
      <td>${escapeHtml(c.characterName)}</td>
      <td>${escapeHtml(clean(c.callTime))}</td>
      <td>${escapeHtml(c.scenesInvolved?.length ? c.scenesInvolved.join(", ") : "—")}</td>
    </tr>`,
        )
        .join("")
    : `<tr><td colspan="4">No cast linked yet.</td></tr>`;

  const crewRows = vm.crew.length
    ? vm.crew
        .map(
          (c) => `<tr>
      <td>${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.role)}</td>
      <td>${escapeHtml(clean(c.department))}</td>
      <td>${escapeHtml(clean(c.callTime))}</td>
    </tr>`,
        )
        .join("")
    : `<tr><td colspan="4">No crew listed.</td></tr>`;

  const equipment = vm.equipment?.length
    ? vm.equipment
        .map(
          (e) =>
            `<li><strong>${escapeHtml(e.equipmentName)}</strong> (${escapeHtml(e.category)}) ×${e.quantity}</li>`,
        )
        .join("")
    : "<li>—</li>";

  const locations = vm.locations.length
    ? vm.locations
        .map(
          (loc) => `<li style="margin-bottom:0.5rem;border:1px solid #e2e8f0;border-radius:4px;padding:0.5rem">
      <strong>${escapeHtml(loc.name)}</strong>
      ${loc.addressLine ? `<div>${escapeHtml(loc.addressLine)}</div>` : ""}
      ${loc.description ? `<div style="color:#475569">${escapeHtml(loc.description)}</div>` : ""}
    </li>`,
        )
        .join("")
    : "<li>—</li>";

  const tasks =
    vm.tasks && vm.tasks.length > 0
      ? `<section><h2>Tasks &amp; notes</h2><ul>${vm.tasks
          .map(
            (t) =>
              `<li><strong>${escapeHtml(t.title)}</strong> · ${escapeHtml(t.status)}${t.department ? ` · ${escapeHtml(t.department)}` : ""}</li>`,
          )
          .join("")}</ul></section>`
      : "";

  const safety =
    vm.safety && vm.safety.length > 0
      ? `<section><h2 style="color:#92400e;border-color:#fcd34d">Safety &amp; risk</h2><ul>${vm.safety
          .map(
            (s) =>
              `<li><strong>[${escapeHtml(s.category)}]</strong> ${escapeHtml(s.line)}${s.severity ? ` <span style="color:#b91c1c">(${escapeHtml(s.severity)})</span>` : ""}</li>`,
          )
          .join("")}</ul></section>`
      : "";

  const notes =
    sheetNotes?.trim() || vm.dayNotes?.trim()
      ? `<section><h2>Production notes</h2><div style="white-space:pre-wrap">${escapeHtml([sheetNotes, vm.dayNotes].filter(Boolean).join("\n\n"))}</div></section>`
      : "";

  const bodyHtml = `<article class="call-sheet">
  <header style="border-bottom:2px solid #0f172a;padding-bottom:0.75rem">
    <p class="kicker">Call sheet</p>
    <h1>${escapeHtml(vm.header.productionTitle)}</h1>
    ${vm.header.productionCompany ? `<p style="color:#475569;margin:0.15rem 0">${escapeHtml(vm.header.productionCompany)}</p>` : ""}
    <div class="header-meta">
      <span><strong>Day ${vm.header.shootDayNumber}</strong> of ${vm.header.totalShootDays}</span>
      <span>${escapeHtml(dateStr)}</span>
      ${vm.header.primaryLocationSummary ? `<span>${escapeHtml(vm.header.primaryLocationSummary)}</span>` : ""}
      ${vm.weather ? `<span><strong>Weather</strong> ${escapeHtml(vm.weather)}</span>` : ""}
    </div>
  </header>

  <section>
    <h2>General timing</h2>
    <div class="grid-2" style="grid-template-columns:repeat(3,1fr)">
      <div><span style="color:#64748b">General call</span><div><strong>${escapeHtml(clean(vm.timing.generalCall))}</strong></div></div>
      <div><span style="color:#64748b">Est. wrap</span><div><strong>${escapeHtml(clean(vm.timing.estimatedWrap))}</strong></div></div>
      <div><span style="color:#64748b">Meals / catering</span><div>${escapeHtml(clean(vm.timing.mealBreakNotes))}</div></div>
    </div>
  </section>

  <section>
    <h2>Scene breakdown</h2>
    <table>
      <thead><tr><th>#</th><th>Scene</th><th>INT/EXT · D/N</th><th>Location</th><th>Description</th><th style="text-align:right">Est.</th></tr></thead>
      <tbody>${scheduleRows}</tbody>
    </table>
  </section>

  <div class="grid-2 cast-crew">
    <section>
      <h2>Cast</h2>
      <table><thead><tr><th>Talent</th><th>Role</th><th>Call</th><th>Scenes</th></tr></thead><tbody>${castRows}</tbody></table>
    </section>
    <section>
      <h2>Crew</h2>
      <table><thead><tr><th>Name</th><th>Role</th><th>Dept</th><th>Call</th></tr></thead><tbody>${crewRows}</tbody></table>
    </section>
  </div>

  <section><h2>Equipment</h2><ul style="columns:2;gap:1rem">${equipment}</ul></section>
  <section><h2>Locations</h2><ul style="list-style:none;padding:0">${locations}</ul></section>
  ${tasks}
  ${safety}
  ${notes}

  <footer>Generated from Story Time scheduling, breakdown, casting, crew, equipment, tasks, and risk data. Verify on set before distribution.</footer>
</article>`;

  return { bodyHtml, extraCss: CALL_SHEET_CSS };
}
