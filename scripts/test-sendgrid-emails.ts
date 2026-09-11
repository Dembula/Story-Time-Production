/**
 * One-shot SendGrid smoke test: welcome + password reset + monthly update.
 *
 * Usage:
 *   npx tsx scripts/test-sendgrid-emails.ts acenomvete@icloud.com
 *
 * Requires in .env.local (or process env):
 *   SENDGRID_API_KEY
 *   EMAIL_FROM (optional)
 *   SENDGRID_TEMPLATE_WELCOME_ID
 *   SENDGRID_TEMPLATE_PASSWORD_RESET_ID
 *   SENDGRID_TEMPLATE_MONTHLY_UPDATE_ID
 *   NEXTAUTH_URL or NEXT_PUBLIC_BASE_URL (for reset link host)
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
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
    if (!(key in process.env) || !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

async function main() {
  const to = (process.argv[2] || "acenomvete@icloud.com").trim().toLowerCase();
  const required = [
    "SENDGRID_API_KEY",
    "SENDGRID_TEMPLATE_WELCOME_ID",
    "SENDGRID_TEMPLATE_PASSWORD_RESET_ID",
    "SENDGRID_TEMPLATE_MONTHLY_UPDATE_ID",
  ] as const;

  const missing = required.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    console.error("Missing env vars:", missing.join(", "));
    console.error("Add them to .env.local (or Vercel pull), then re-run.");
    process.exit(1);
  }

  const base =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    "https://story-time.online";

  const { sendWelcomeEmail, sendPasswordResetEmail, sendMonthlyUpdateEmail } = await import(
    "../src/lib/sendgrid"
  );

  const results: { name: string; ok: boolean; detail?: string }[] = [];

  try {
    await sendWelcomeEmail(to, "Andile Nomvete", {
      role: "ADMIN",
      registrationType: "sendgrid_smoke_test",
    });
    results.push({ name: "welcome", ok: true });
    console.log("✓ Welcome email sent");
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ name: "welcome", ok: false, detail });
    console.error("✗ Welcome email failed:", detail);
  }

  try {
    const rawToken = `smoke-test-${Date.now()}`;
    const resetLink = `${base}/auth/reset-password?token=${encodeURIComponent(rawToken)}&portal=admin`;
    const mail = await sendPasswordResetEmail(to, resetLink, {
      rawToken,
      portal: "admin",
    });
    results.push({
      name: "password_reset",
      ok: true,
      detail: mail.messageId ? `messageId=${mail.messageId}` : undefined,
    });
    console.log("✓ Password reset email sent", mail.messageId ? `(${mail.messageId})` : "");
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ name: "password_reset", ok: false, detail });
    console.error("✗ Password reset email failed:", detail);
  }

  try {
    await sendMonthlyUpdateEmail([to], {
      subject: "Story Time Monthly Update — SendGrid smoke test",
      preview: "This is a live SendGrid template test.",
      body: "If you received this, the monthly update template is working.",
      latestReleases: [{ title: "Smoke Test Title", type: "MOVIE", creatorName: "Story Time" }],
      creatorHighlights: [{ name: "Story Time Team", role: "Platform" }],
    });
    results.push({ name: "monthly_update", ok: true });
    console.log("✓ Monthly update email sent");
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ name: "monthly_update", ok: false, detail });
    console.error("✗ Monthly update email failed:", detail);
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\nSummary:", JSON.stringify({ to, results }, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
