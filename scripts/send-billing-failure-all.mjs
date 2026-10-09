/**
 * Mass-send SENDGRID_TEMPLATE_BILLING to PAST_DUE viewers with failed renewals
 * (once per current dunning period).
 * Usage: node --env-file=.env.reminder.local scripts/send-billing-failure-all.mjs
 */
import { PrismaClient } from "../generated/prisma/index.js";
import sgMail from "@sendgrid/mail";

const CAMPAIGN_PREFIX = "billing_failure";
const FAILED_STATUSES = ["FAILED", "ERROR", "DECLINED"];
const billingUrl = "https://story-time.online/browse/account";

const key = process.env.SENDGRID_API_KEY?.trim();
const templateId = process.env.SENDGRID_TEMPLATE_BILLING?.trim();
const fromRaw = process.env.EMAIL_FROM?.trim() || "Story Time <noreply@story-time.online>";

if (!key) {
  console.error("Missing SENDGRID_API_KEY");
  process.exit(1);
}
if (!templateId) {
  console.error("Missing SENDGRID_TEMPLATE_BILLING");
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

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function campaignKey(subscriptionId, pastDueSince, now) {
  const day = (pastDueSince ?? now).toISOString().slice(0, 10);
  return `${CAMPAIGN_PREFIX}:${subscriptionId}:${day}`;
}

sgMail.setApiKey(key);
const prisma = new PrismaClient();
const from = parseFrom(fromRaw);
const now = new Date();

async function main() {
  const rows = await prisma.viewerSubscription.findMany({
    where: {
      viewerModel: "SUBSCRIPTION",
      status: "PAST_DUE",
      lastPaymentStatus: { in: FAILED_STATUSES },
      user: { email: { not: null } },
    },
    select: {
      id: true,
      pastDueSince: true,
      lastPaymentError: true,
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: { pastDueSince: "asc" },
    take: 2000,
  });

  const candidates = rows
    .map((row) => ({
      userId: row.user.id,
      email: String(row.user.email ?? "")
        .trim()
        .toLowerCase(),
      name: row.user.name,
      subscriptionId: row.id,
      pastDueSince: row.pastDueSince,
      lastPaymentError: row.lastPaymentError,
      campaignKey: campaignKey(row.id, row.pastDueSince, now),
    }))
    .filter((c) => looksLikeEmail(c.email));

  const already = await prisma.emailCampaignDelivery.findMany({
    where: {
      email: { in: candidates.map((c) => c.email) },
      campaignKey: { in: candidates.map((c) => c.campaignKey) },
    },
    select: { email: true, campaignKey: true },
  });
  const sentSet = new Set(already.map((r) => `${r.email.toLowerCase()}|${r.campaignKey}`));
  const eligible = candidates.filter((c) => !sentSet.has(`${c.email}|${c.campaignKey}`));

  console.error(
    JSON.stringify(
      {
        failed: candidates.length,
        alreadySentThisPeriod: candidates.length - eligible.length,
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
          email_campaignKey: { email: row.email, campaignKey: row.campaignKey },
        },
        select: { id: true },
      });
      if (existing) {
        skipped.push(row.email);
        continue;
      }

      const name = firstName(row.name);
      const errorMessage = row.lastPaymentError || "";
      await sgMail.send({
        to: row.email,
        from,
        templateId,
        dynamicTemplateData: {
          email: row.email,
          name,
          first_name: name,
          billing_url: billingUrl,
          billing_link: billingUrl,
          account_url: billingUrl,
          cta_url: billingUrl,
          error_message: errorMessage,
          payment_error: errorMessage,
        },
      });

      await prisma.emailCampaignDelivery.create({
        data: {
          userId: row.userId,
          email: row.email,
          campaignKey: row.campaignKey,
          metadata: {
            source: "mass_send_script",
            subscriptionId: row.subscriptionId,
            periodAnchor: (row.pastDueSince ?? now).toISOString(),
          },
        },
      });

      sentEmails.push(row.email);
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
