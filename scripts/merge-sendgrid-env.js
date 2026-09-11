const fs = require("fs");

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

const pulled = parse(".env.vercel.production");
const local = parse(".env.local");
const want = [
  "SENDGRID_API_KEY",
  "EMAIL_FROM",
  "SENDGRID_TEMPLATE_WELCOME_ID",
  "SENDGRID_TEMPLATE_PASSWORD_RESET_ID",
  "SENDGRID_TEMPLATE_MONTHLY_UPDATE_ID",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_BASE_URL",
];

for (const k of want) {
  if (pulled[k]) local[k] = pulled[k];
  console.log(`${k}:${local[k] ? "ok" : "MISSING"}`);
}

const lines = Object.entries(local).map(([k, v]) => {
  const needsQuote = /[\s#"']/.test(v);
  return needsQuote ? `${k}="${v.replace(/"/g, '\\"')}"` : `${k}=${v}`;
});
fs.writeFileSync(".env.local", lines.join("\n") + "\n");
console.log("merged into .env.local");
