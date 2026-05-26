import { readFileSync } from "fs";
import { resolve } from "path";
import { getCloudflareStreamConfig } from "../src/lib/cloudflare-stream";
import { prisma } from "../src/lib/prisma";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
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
    process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();

  const ws = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET?.trim() ?? "";
  const cfg = getCloudflareStreamConfig();

  const checks: Record<string, boolean | string> = {
    streamConfigOk: !!cfg,
    accountIdSet: !!process.env.CLOUDFLARE_ACCOUNT_ID?.trim(),
    apiTokenSet: !!process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim(),
    subdomainSet: !!process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN?.trim(),
    webhookSecretSet: !!ws,
    webhookSecretValidFormat: /^[a-f0-9]{32,64}$/i.test(ws) && !/^https?:/i.test(ws),
    storagePublicUrlSet: !!process.env.STORAGE_PUBLIC_BASE_URL?.trim(),
    databaseUrlSet: !!process.env.DATABASE_URL?.trim(),
  };

  if (cfg) {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/stream?per_page=1`,
      { headers: { Authorization: `Bearer ${cfg.apiToken}` }, cache: "no-store" },
    );
    const body = (await res.json().catch(() => ({}))) as { success?: boolean };
    checks.cloudflareApiTokenValid = res.ok && body.success === true;

    const wh = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfg.accountId}/stream/webhook`,
      { headers: { Authorization: `Bearer ${cfg.apiToken}` }, cache: "no-store" },
    );
    const whBody = (await wh.json().catch(() => ({}))) as {
      success?: boolean;
      result?: { notification_url?: string; notificationUrl?: string; secret?: string };
    };
    checks.webhookRegistered = wh.ok && whBody.success === true;
    const url = whBody.result?.notification_url ?? whBody.result?.notificationUrl ?? "";
    checks.webhookUrlCorrect =
      typeof url === "string" && url.includes("story-time.online/api/stream/webhook");
    checks.webhookSecretMatchesCloudflare =
      !!whBody.result?.secret && whBody.result.secret === ws;
  }

  const [videoCount, streamUrlCount, streamAssets] = await Promise.all([
    prisma.content.count({ where: { videoUrl: { not: null } } }),
    prisma.content.count({
      where: {
        OR: [
          { videoUrl: { contains: "videodelivery", mode: "insensitive" } },
          { videoUrl: { contains: "cloudflarestream", mode: "insensitive" } },
        ],
      },
    }),
    prisma.streamAsset.count(),
  ]);

  console.log(JSON.stringify({ envChecks: checks, db: { videoCount, streamUrlCount, streamAssets } }, null, 2));

  const failed = Object.entries(checks).filter(([, v]) => v === false);
  if (failed.length) {
    console.error("\nFailed checks:", failed.map(([k]) => k).join(", "));
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
