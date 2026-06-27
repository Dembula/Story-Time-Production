/**
 * Backfill knowledge graph edges from published catalogue content.
 * Usage: npx tsx scripts/backfill-knowledge-graph.ts [--limit=100]
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { syncPublishedCatalogueGraph } from "../src/lib/ai-os/knowledge-graph/sync-content";
import { syncAllProjectGraphs } from "../src/lib/ai-os/knowledge-graph/sync-project";
import { prisma } from "../src/lib/prisma";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Math.max(1, parseInt(limitArg.split("=")[1] ?? "100", 10)) : 100;
  const skipProjects = process.argv.includes("--catalogue-only");

  const catalogue = await syncPublishedCatalogueGraph(limit);
  const projects = skipProjects ? { projects: 0, edges: 0 } : await syncAllProjectGraphs(limit);
  const edgeCount = await prisma.knowledgeEdge.count();
  console.log(JSON.stringify({ catalogue, projects, totalEdges: edgeCount }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
