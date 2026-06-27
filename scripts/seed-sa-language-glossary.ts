/**
 * Seed South African language glossary into RAG (KnowledgeChunk).
 * Usage: npx tsx scripts/seed-sa-language-glossary.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { indexSaGlossarySeed } from "../src/lib/ai-os/languages/index-glossary";
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
  const result = await indexSaGlossarySeed();
  const count = await prisma.knowledgeChunk.count({
    where: { sourceType: "sa_language_glossary" },
  });
  console.log(JSON.stringify({ ...result, totalSaGlossaryChunks: count }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
