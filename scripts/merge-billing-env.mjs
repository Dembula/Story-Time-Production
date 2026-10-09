/**
 * Pull SENDGRID_TEMPLATE_BILLING from .env.billing.pull into .env.reminder.local
 */
import fs from "fs";

function parse(p) {
  const o = {};
  if (!fs.existsSync(p)) return o;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    o[t.slice(0, i).trim()] = v;
  }
  return o;
}

const pulled = parse(".env.billing.pull");
const local = parse(".env.reminder.local");

if (!pulled.SENDGRID_TEMPLATE_BILLING) {
  console.error("Missing SENDGRID_TEMPLATE_BILLING in .env.billing.pull");
  process.exit(1);
}

local.SENDGRID_TEMPLATE_BILLING = pulled.SENDGRID_TEMPLATE_BILLING;
for (const k of ["SENDGRID_API_KEY", "EMAIL_FROM", "DATABASE_URL"]) {
  if (pulled[k]) local[k] = pulled[k];
}

const lines = Object.entries(local).map(([k, v]) => {
  const needsQuote = /[\s#"']/.test(v);
  return needsQuote ? `${k}="${v.replace(/"/g, '\\"')}"` : `${k}=${v}`;
});
fs.writeFileSync(".env.reminder.local", lines.join("\n") + "\n");
if (fs.existsSync(".env.billing.pull")) fs.unlinkSync(".env.billing.pull");

console.log(
  JSON.stringify({
    ok: true,
    billingPrefix: `${local.SENDGRID_TEMPLATE_BILLING.slice(0, 8)}…`,
  }),
);
