/**
 * One-shot: send SENDGRID_TEMPLATE_REMINDER to a single address.
 * Usage: node --env-file=.env.reminder.local scripts/send-viewer-package-reminder-test.mjs acenomvete@icloud.com
 */
import sgMail from "@sendgrid/mail";

const to = (process.argv[2] || "").trim().toLowerCase();
const key = process.env.SENDGRID_API_KEY?.trim();
const templateId = process.env.SENDGRID_TEMPLATE_REMINDER?.trim();
const fromRaw = process.env.EMAIL_FROM?.trim() || "Story Time <noreply@story-time.online>";

if (!to || !to.includes("@")) {
  console.error("Usage: node --env-file=.env.reminder.local scripts/send-viewer-package-reminder-test.mjs <email>");
  process.exit(1);
}
if (!key) {
  console.error("Missing SENDGRID_API_KEY");
  process.exit(1);
}
if (!templateId) {
  console.error("Missing SENDGRID_TEMPLATE_REMINDER");
  process.exit(1);
}

function parseFrom(value) {
  const m = value.match(/^(.*)<([^>]+)>$/);
  if (m) return { name: m[1].trim().replace(/^"|"$/g, ""), email: m[2].trim() };
  return value;
}

sgMail.setApiKey(key);
const packageUrl = "https://story-time.online/onboarding/package";

const [response] = await sgMail.send({
  to,
  from: parseFrom(fromRaw),
  templateId,
  dynamicTemplateData: {
    email: to,
    name: "Andile",
    first_name: "Andile",
    package_url: packageUrl,
    package_link: packageUrl,
    cta_url: packageUrl,
  },
});

const messageId =
  response?.headers?.["x-message-id"] || response?.headers?.["X-Message-Id"] || null;

console.log(
  JSON.stringify(
    {
      ok: true,
      to,
      templateIdPrefix: `${templateId.slice(0, 8)}…`,
      statusCode: response?.statusCode,
      messageId,
    },
    null,
    2,
  ),
);
