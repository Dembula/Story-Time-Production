/**
 * One-shot Live Email test send.
 * Usage: node scripts/send-live-email-test.mjs [email]
 */
import { readFileSync, unlinkSync, existsSync } from "fs";
import { execSync } from "child_process";
import { resolve } from "path";

const TMP = resolve(process.cwd(), ".env.vercel.live.tmp");
const TO = (process.argv[2] || "poizeneyevleaves@gmail.com").trim().toLowerCase();

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function parseFrom(raw) {
  const m = String(raw || "").match(/^(.+?)\s*<([^>]+)>$/);
  if (m) return { email: m[2], name: m[1].replace(/^["']|["']$/g, "") };
  return { email: raw || "noreply@story-time.online" };
}

async function main() {
  execSync("npx vercel env pull .env.vercel.live.tmp --environment=production --yes", {
    stdio: "inherit",
  });
  const env = loadEnvFile(TMP);
  const key = env.SENDGRID_API_KEY;
  const tid = env.SENDGRID_TEMPLATE_LIVE_ID;
  if (!key || !tid) throw new Error("Missing SENDGRID_API_KEY or SENDGRID_TEMPLATE_LIVE_ID");

  const sendRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: TO }] }],
      from: parseFrom(env.EMAIL_FROM),
      template_id: tid,
      dynamic_template_data: { email: TO, name: "Creator" },
    }),
  });

  console.log(`send_status=${sendRes.status}`);
  console.log(`x-message-id=${sendRes.headers.get("x-message-id") || ""}`);
  console.log(`to=${TO}`);
  if (existsSync(TMP)) unlinkSync(TMP);
  if (!sendRes.ok) {
    console.error(await sendRes.text());
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  try {
    if (existsSync(TMP)) unlinkSync(TMP);
  } catch {
    /* ignore */
  }
  process.exit(1);
});
