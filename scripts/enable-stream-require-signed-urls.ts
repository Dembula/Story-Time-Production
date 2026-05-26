/**
 * Enable requireSignedURLs on Cloudflare Stream assets tracked in StreamAsset / Content.videoUrl.
 * Usage: npx tsx scripts/enable-stream-require-signed-urls.ts [--dry-run]
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { prisma } from "../src/lib/prisma";
import { extractCloudflareStreamUid, getCloudflareStreamConfig } from "../src/lib/cloudflare-stream";

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

async function patchUid(accountId: string, apiToken: string, uid: string, dryRun: boolean) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`;
  if (dryRun) {
    console.log(`  [dry-run] PATCH ${uid} requireSignedURLs=true`);
    return true;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uid, requireSignedURLs: true }),
  });
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; errors?: Array<{ message?: string }> };
  if (!res.ok || !body.success) {
    const msg = body.errors?.map((e) => e.message).filter(Boolean).join("; ");
    console.error(`  FAIL ${uid}:`, msg || res.status);
    return false;
  }
  console.log(`  OK   ${uid}`);
  return true;
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const cfg = getCloudflareStreamConfig();
  if (!cfg) {
    console.error("Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_STREAM_API_TOKEN, CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN.");
    process.exit(1);
  }

  const uids = new Set<string>();
  const assets = await prisma.streamAsset.findMany({ select: { uid: true } });
  for (const a of assets) if (a.uid) uids.add(a.uid);

  const videos = await prisma.content.findMany({
    where: { videoUrl: { not: null } },
    select: { videoUrl: true },
    take: 500,
  });
  for (const v of videos) {
    const uid = extractCloudflareStreamUid(v.videoUrl);
    if (uid) uids.add(uid);
  }

  console.log(`${dryRun ? "[dry-run] " : ""}Updating ${uids.size} Stream asset(s)…`);
  let ok = 0;
  let fail = 0;
  for (const uid of uids) {
    const success = await patchUid(cfg.accountId, cfg.apiToken, uid, dryRun);
    if (success) ok++;
    else fail++;
  }
  console.log(JSON.stringify({ total: uids.size, ok, fail, dryRun }, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
