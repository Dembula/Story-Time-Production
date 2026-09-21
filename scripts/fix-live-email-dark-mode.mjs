/**
 * One-shot: harden SENDGRID_TEMPLATE_LIVE_ID against Apple Mail / iCloud
 * color inversion, then send a single preview to acenomvete@icloud.com.
 *
 * Usage: node scripts/fix-live-email-dark-mode.mjs
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { execSync } from "child_process";
import { resolve } from "path";

const TMP = resolve(process.cwd(), ".env.vercel.live.tmp");
const TO = "acenomvete@icloud.com";

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

function hardenHtml(html) {
  const alreadyHardened = /color-scheme/i.test(html) && /bgcolor=/i.test(html);
  if (alreadyHardened && /supported-color-schemes/i.test(html)) {
    return { html, skipped: true };
  }

  const darkMeta = `
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<style type="text/css">
:root { color-scheme: dark; supported-color-schemes: dark; }
html, body, .body, .st-root { background-color: #050505 !important; color: #ffffff !important; }
/* Keep the designed dark canvas even when clients try to invert */
@media (prefers-color-scheme: light) {
  html, body, .body, .st-root { background-color: #050505 !important; }
}
@media (prefers-color-scheme: dark) {
  html, body, .body, .st-root { background-color: #050505 !important; }
}
</style>
`;

  let next = html;
  if (/<head[^>]*>/i.test(next)) {
    next = next.replace(/<head[^>]*>/i, (m) => `${m}${darkMeta}`);
  } else {
    next = `${darkMeta}${next}`;
  }

  next = next.replace(/<(table|td|th|body)([^>]*?)>/gi, (full, tag, attrs) => {
    if (/\sbgcolor=/i.test(attrs)) return full;
    const m = attrs.match(/background-color\s*:\s*(#[0-9a-fA-F]{3,8})/i);
    if (!m) return full;
    return `<${tag}${attrs} bgcolor="${m[1]}">`;
  });

  next = next.replace(/<body([^>]*)>/i, (full, attrs) => {
    if (/\sclass=/i.test(attrs)) {
      return `<body${attrs.replace(/class="([^"]*)"/i, 'class="$1 body st-root"')}>`;
    }
    return `<body class="body st-root"${attrs}>`;
  });

  return { html: next, skipped: false };
}

async function main() {
  execSync("npx vercel env pull .env.vercel.live.tmp --environment=production --yes", {
    stdio: "inherit",
  });
  const env = loadEnvFile(TMP);
  const key = env.SENDGRID_API_KEY;
  const tid = env.SENDGRID_TEMPLATE_LIVE_ID;
  if (!key || !tid) {
    throw new Error("Missing SENDGRID_API_KEY or SENDGRID_TEMPLATE_LIVE_ID");
  }

  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  const tpl = await fetch(`https://api.sendgrid.com/v3/templates/${tid}`, { headers }).then((r) =>
    r.json()
  );
  const ver = (tpl.versions || []).find((v) => v.active === 1) || tpl.versions?.[0];
  if (!ver?.id) throw new Error("No active Live Email template version found");

  const { html, skipped } = hardenHtml(ver.html_content || "");
  console.log(skipped ? "already_hardened=true" : "patching_template=true");

  if (!skipped) {
    // Backup original HTML locally (gitignored via tmp name) in case we need rollback.
    writeFileSync(
      resolve(process.cwd(), ".live-email-backup.html"),
      ver.html_content || "",
      "utf8"
    );

    const patchRes = await fetch(
      `https://api.sendgrid.com/v3/templates/${tid}/versions/${ver.id}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          active: 1,
          name: ver.name || "Live Email",
          subject: ver.subject,
          html_content: html,
          plain_content: ver.plain_content || undefined,
        }),
      }
    );
    const patchText = await patchRes.text();
    console.log(`patch_status=${patchRes.status}`);
    if (!patchRes.ok) {
      console.error(patchText.slice(0, 1000));
      process.exit(1);
    }
  }

  const verify = await fetch(`https://api.sendgrid.com/v3/templates/${tid}`, { headers }).then((r) =>
    r.json()
  );
  const ver2 = (verify.versions || []).find((v) => v.active === 1) || verify.versions?.[0];
  const h2 = ver2.html_content || "";
  console.log(`has_color-scheme_meta=${/color-scheme/i.test(h2)}`);
  console.log(`bgcolor_count=${(h2.match(/bgcolor=/gi) || []).length}`);

  const sendRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers,
    body: JSON.stringify({
      personalizations: [{ to: [{ email: TO }] }],
      from: parseFrom(env.EMAIL_FROM),
      template_id: tid,
      dynamic_template_data: { email: TO, name: "Andile" },
    }),
  });
  console.log(`send_status=${sendRes.status}`);
  console.log(`x-message-id=${sendRes.headers.get("x-message-id") || ""}`);
  console.log(`to=${TO}`);

  unlinkSync(TMP);
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
