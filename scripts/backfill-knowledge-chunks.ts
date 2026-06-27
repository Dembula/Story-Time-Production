/**
 * Backfill KnowledgeChunk RAG index from ContentEnrichment + scenes + platform policies.
 * Usage: npx tsx scripts/backfill-knowledge-chunks.ts [--limit=50]
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { prisma } from "../src/lib/prisma";
import { indexCatalogueFromEnrichment, indexScenesForContent } from "../src/lib/ai-os/rag/index-catalogue";
import { PLATFORM_POLICY_CHUNKS } from "../src/lib/ai-os/rag/platform-policies";
import { upsertKnowledgeChunk } from "../src/lib/ai-os/rag/index-chunk";

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
  const limit = limitArg ? Math.max(1, parseInt(limitArg.split("=")[1] ?? "50", 10)) : 50;

  console.log("Indexing platform policies…");
  for (const policy of PLATFORM_POLICY_CHUNKS) {
    await upsertKnowledgeChunk({
      chunkKey: policy.chunkKey,
      sourceType: "platform_policy",
      sourceId: policy.chunkKey,
      title: policy.title,
      chunkText: policy.chunkText,
    });
  }

  const enriched = await prisma.contentEnrichment.findMany({
    where: { status: "READY" },
    select: { contentId: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  console.log(`Indexing ${enriched.length} catalogue titles…`);
  let scenes = 0;
  for (const row of enriched) {
    await indexCatalogueFromEnrichment(row.contentId);
    scenes += await indexScenesForContent(row.contentId);
  }

  const chunkCount = await prisma.knowledgeChunk.count();
  console.log(JSON.stringify({ catalogue: enriched.length, scenes, totalChunks: chunkCount }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
