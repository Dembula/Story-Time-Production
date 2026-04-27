/**
 * Phased quality gates:
 * - phase1 (default): fail on ESLint errors only
 * - phase2: also fail on no-img warnings in critical UX surfaces
 * - phase3: also fail on exhaustive-deps warnings in critical creator tool pages
 *
 * Usage:
 *   node scripts/quality-gates.mjs
 *   QUALITY_GATE_PHASE=2 node scripts/quality-gates.mjs
 */
import { execSync } from "child_process";
import { existsSync, readFileSync, unlinkSync } from "fs";

const phase = Number.parseInt(process.env.QUALITY_GATE_PHASE ?? "1", 10);

let raw = "[]";
const reportPath = ".next/quality-gates-eslint.json";
try {
  execSync(`npx next lint --format json --output-file "${reportPath}"`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  raw = existsSync(reportPath) ? readFileSync(reportPath, "utf8").trim() : "[]";
} catch (error) {
  // next lint can exit non-zero when issues exist; parse output file if it was written.
  raw = existsSync(reportPath) ? readFileSync(reportPath, "utf8").trim() : "";
  if (!raw) {
    const stderr = error?.stderr?.toString?.() ?? "";
    console.error("Failed to run eslint:", stderr || error.message);
    process.exit(1);
  }
} finally {
  if (existsSync(reportPath)) unlinkSync(reportPath);
}

if (!raw) {
  console.error("Failed to run eslint: empty output");
  process.exit(1);
}
let reports = [];
try {
  reports = JSON.parse(raw);
} catch {
  console.error("Could not parse eslint JSON output.");
  process.exit(1);
}

let errorCount = 0;
let warningCount = 0;
const criticalWarnings = [];

for (const file of reports) {
  const filePath = String(file.filePath || "").replaceAll("\\", "/");
  for (const msg of file.messages ?? []) {
    if (msg.severity === 2) errorCount += 1;
    if (msg.severity === 1) warningCount += 1;

    if (
      phase >= 2 &&
      msg.severity === 1 &&
      msg.ruleId === "@next/next/no-img-element" &&
      (filePath.endsWith("/src/components/layout/hero.tsx") ||
        filePath.endsWith("/src/components/layout/content-row.tsx") ||
        filePath.endsWith("/src/components/layout/music-row.tsx") ||
        filePath.endsWith("/src/app/browse/content/[id]/content-detail-client.tsx"))
    ) {
      criticalWarnings.push({ filePath, ruleId: msg.ruleId, line: msg.line });
    }

    if (
      phase >= 3 &&
      msg.severity === 1 &&
      msg.ruleId === "react-hooks/exhaustive-deps" &&
      (filePath.endsWith("/src/app/creator/projects/[projectId]/pre-production/[tool]/page.tsx") ||
        filePath.endsWith("/src/app/creator/projects/[projectId]/production/[tool]/page.tsx"))
    ) {
      criticalWarnings.push({ filePath, ruleId: msg.ruleId, line: msg.line });
    }
  }
}

console.log(`Quality gates phase=${phase}: errors=${errorCount}, warnings=${warningCount}`);

if (errorCount > 0) {
  console.error("Failing due to ESLint errors.");
  process.exit(1);
}

if (criticalWarnings.length > 0) {
  console.error("Failing due to phased critical warning gates:");
  for (const w of criticalWarnings) {
    console.error(`- ${w.ruleId} at ${w.filePath}:${w.line}`);
  }
  process.exit(1);
}

process.exit(0);
