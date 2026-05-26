/**
 * Backfill AI metadata / embeddings for published catalogue titles.
 * Usage: npx tsx scripts/backfill-content-enrichment.ts [--limit=20]
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { prisma } from "../src/lib/prisma";
import { enrichContentById } from "../src/lib/ai-metadata/enrich-content";

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
  const limit = limitArg ? Math.max(1, parseInt(limitArg.split("=")[1] ?? "20", 10)) : 20;

  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error("OPENAI_API_KEY is required for enrichment backfill.");
    process.exit(1);
  }

  const candidates = await prisma.content.findMany({
    where: {
      published: true,
      OR: [{ enrichment: null }, { enrichment: { status: { not: "READY" } } }],
    },
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  console.log(`Enriching up to ${candidates.length} titles…`);
  let ok = 0;
  let fail = 0;
  for (const c of candidates) {
    try {
      const result = await enrichContentById(c.id);
      if (result) {
        ok++;
        console.log(`  OK  ${c.title}`);
      } else {
        fail++;
        console.log(`  SKIP ${c.title}`);
      }
    } catch (err) {
      fail++;
      console.error(`  FAIL ${c.title}`, err);
    }
  }
  console.log(JSON.stringify({ processed: candidates.length, ok, fail }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
