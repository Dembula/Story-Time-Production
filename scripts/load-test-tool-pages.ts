/**
 * Load / perf smoke for large creator tool pages.
 * Usage: npx tsx scripts/load-test-tool-pages.ts
 * Env: LOAD_TEST_BASE_URL (default http://localhost:3000)
 *      LOAD_TEST_PROJECT_ID (required for tool routes)
 *      LOAD_TEST_COOKIE (optional session cookie for authenticated pages)
 */
import { performance } from "node:perf_hooks";

const baseUrl = (process.env.LOAD_TEST_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const projectId = process.env.LOAD_TEST_PROJECT_ID?.trim();
const cookie = process.env.LOAD_TEST_COOKIE?.trim();
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? "5");
const iterations = Number(process.env.LOAD_TEST_ITERATIONS ?? "3");

const TOOLS = [
  "script-writing-studio",
  "budget",
  "schedule",
  "breakdown",
  "legal-contracts",
  "call-sheet-generator",
] as const;

type Sample = { path: string; ms: number; status: number; bytes: number };

async function fetchOnce(path: string): Promise<Sample> {
  const url = `${baseUrl}${path}`;
  const start = performance.now();
  const res = await fetch(url, {
    headers: cookie ? { cookie } : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(60_000),
  });
  const body = await res.arrayBuffer();
  return {
    path,
    ms: performance.now() - start,
    status: res.status,
    bytes: body.byteLength,
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]!);
}

async function runPath(path: string): Promise<Sample[]> {
  const samples: Sample[] = [];
  for (let i = 0; i < iterations; i += 1) {
    samples.push(await fetchOnce(path));
  }
  return samples;
}

async function main() {
  const paths: string[] = ["/", "/browse", "/auth/signin"];
  if (projectId) {
    for (const tool of TOOLS) {
      paths.push(`/creator/projects/${projectId}/pre-production/${tool}`);
      paths.push(`/creator/projects/${projectId}/production/${tool}`);
    }
  }

  const all: Sample[] = [];
  for (let i = 0; i < paths.length; i += concurrency) {
    const batch = paths.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((p) => runPath(p)));
    all.push(...results.flat());
  }

  const byPath = new Map<string, Sample[]>();
  for (const sample of all) {
    const list = byPath.get(sample.path) ?? [];
    list.push(sample);
    byPath.set(sample.path, list);
  }

  const summary = [...byPath.entries()].map(([path, samples]) => {
    const times = samples.map((s) => s.ms);
  const statuses = [...new Set(samples.map((s) => s.status))];
    return {
      path,
      iterations: samples.length,
      status: statuses,
      p50Ms: percentile(times, 50),
      p95Ms: percentile(times, 95),
      maxMs: Math.round(Math.max(...times)),
      avgBytes: Math.round(samples.reduce((sum, s) => sum + s.bytes, 0) / samples.length),
      slow: percentile(times, 95) > 8000,
    };
  });

  const slowPages = summary.filter((s) => s.slow);
  const report = {
    ok: slowPages.length === 0,
    baseUrl,
    projectId: projectId ?? null,
    authenticated: Boolean(cookie),
    concurrency,
    iterations,
    summary,
    slowPages: slowPages.map((s) => s.path),
    thresholds: { p95WarningMs: 8000 },
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
