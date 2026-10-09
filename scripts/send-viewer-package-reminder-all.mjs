/**
 * Mass-send SENDGRID_TEMPLATE_REMINDER to inactive unpaid viewers (once each).
 * Usage: node --env-file=.env.reminder.local scripts/send-viewer-package-reminder-all.mjs
 */
import { PrismaClient } from "../generated/prisma/index.js";
import sgMail from "@sendgrid/mail";

const CAMPAIGN = "viewer_package_reminder";
const ENGAGED = ["ACTIVE", "TRIAL_ACTIVE", "TRIAL_CARD_PENDING", "PAST_DUE"];
const packageUrl = "https://story-time.online/onboarding/package";

const key = process.env.SENDGRID_API_KEY?.trim();
const templateId = process.env.SENDGRID_TEMPLATE_REMINDER?.trim();
const fromRaw = process.env.EMAIL_FROM?.trim() || "Story Time <noreply@story-time.online>";

if (!key) {
  console.error("Missing SENDGRID_API_KEY");
  process.exit(1);
}
if (!templateId) {
  console.error("Missing SENDGRID_TEMPLATE_REMINDER");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

function parseFrom(value) {
  const m = value.match(/^(.*)<([^>]+)>$/);
  if (m) return { name: m[1].trim().replace(/^"|"$/g, ""), email: m[2].trim() };
  return value;
}

function firstName(name) {
  const n = (name || "").trim();
  if (!n) return "there";
  return n.split(/\s+/)[0];
}

sgMail.setApiKey(key);
const prisma = new PrismaClient();
const from = parseFrom(fromRaw);

async function main() {
  const users = await prisma.user.findMany({
    where: {
      role: "SUBSCRIBER",
      email: { not: null },
      NOT: {
        viewerSubscriptions: {
          some: {
            viewerModel: "SUBSCRIPTION",
            status: { in: ENGAGED },
          },
        },
      },
    },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 2000,
  });

  const candidates = users
    .map((u) => ({
      userId: u.id,
      email: (u.email ?? "").trim().toLowerCase(),
      name: u.name,
    }))
    .filter((u) => Boolean(u.email));

  const already = await prisma.emailCampaignDelivery.findMany({
    where: {
      campaignKey: CAMPAIGN,
      email: { in: candidates.map((c) => c.email) },
    },
    select: { email: true },
  });
  const sentSet = new Set(already.map((r) => r.email.toLowerCase()));
  const eligible = candidates.filter((c) => !sentSet.has(c.email));

  console.error(
    JSON.stringify(
      {
        inactive: candidates.length,
        alreadySent: candidates.length - eligible.length,
        remaining: eligible.length,
      },
      null,
      2,
    ),
  );

  const sentEmails = [];
  const failed = [];
  const skipped = [];

  for (const row of eligible) {
    try {
      const existing = await prisma.emailCampaignDelivery.findUnique({
        where: {
          email_campaignKey: { email: row.email, campaignKey: CAMPAIGN },
        },
        select: { id: true },
      });
      if (existing) {
        skipped.push(row.email);
        continue;
      }

      const name = firstName(row.name);
      await sgMail.send({
        to: row.email,
        from,
        templateId,
        dynamicTemplateData: {
          email: row.email,
          name,
          first_name: name,
          package_url: packageUrl,
          package_link: packageUrl,
          cta_url: packageUrl,
        },
      });

      await prisma.emailCampaignDelivery.create({
        data: {
          userId: row.userId,
          email: row.email,
          campaignKey: CAMPAIGN,
          metadata: { source: "mass_send_script" },
        },
      });

      sentEmails.push(row.email);
      // light pacing for SendGrid
      await new Promise((r) => setTimeout(r, 80));
    } catch (err) {
      failed.push({
        email: row.email,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        sent: sentEmails.length,
        skipped: skipped.length,
        failed: failed.length,
        emails: sentEmails,
        failures: failed.slice(0, 50),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
