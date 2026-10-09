import { NextRequest, NextResponse } from "next/server";
import { actorHasAdminRight, requireAdminApiActor } from "@/lib/admin-api-auth";
import {
  BILLING_FAILURE_CAMPAIGN_PREFIX,
  countFailedBillingNeedingEmail,
  filterAlreadySentBillingFailure,
  listFailedViewerBillingCandidates,
  sendBillingFailureOnce,
} from "@/lib/emails/billing-failure";
import { sendBillingFailureEmail } from "@/lib/sendgrid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireBillingAdmin() {
  const actor = await requireAdminApiActor();
  if ("error" in actor) return { error: actor.error, status: actor.status } as const;
  if (!actorHasAdminRight(actor, "canManageSystem") && !actor.isGod) {
    return { error: "Forbidden", status: 403 } as const;
  }
  return { actor } as const;
}

/** Preview counts for PAST_DUE viewers who still need a billing-failure email this period. */
export async function GET() {
  const auth = await requireBillingAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const counts = await countFailedBillingNeedingEmail();
  return NextResponse.json({
    ok: true,
    campaignPrefix: BILLING_FAILURE_CAMPAIGN_PREFIX,
    templateEnv: "SENDGRID_TEMPLATE_BILLING",
    ...counts,
  });
}

/**
 * Admin actions:
 * - { action: "test", to?: email } — one billing-failure template (not logged as campaign)
 * - { action: "send_all", confirm: "SEND_ALL_FAILED_BILLING" } — mass send once per current period
 */
export async function POST(req: NextRequest) {
  const auth = await requireBillingAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    to?: string;
    confirm?: string;
    dryRun?: boolean;
  };

  if (body.action === "test") {
    const to = (body.to || auth.actor.email || "").trim().toLowerCase();
    if (!to.includes("@")) {
      return NextResponse.json({ error: "Valid to email required." }, { status: 400 });
    }
    await sendBillingFailureEmail(to, {
      name: "Andile",
      billingUrl: "https://story-time.online/browse/account",
      errorMessage: "Test: payment did not go through.",
    });
    return NextResponse.json({
      ok: true,
      action: "test",
      to,
      note: "Test send only — not recorded against the period campaign log unless you use send_all.",
    });
  }

  if (body.action === "send_all") {
    if (body.confirm !== "SEND_ALL_FAILED_BILLING") {
      return NextResponse.json(
        { error: 'Confirm mass send with confirm: "SEND_ALL_FAILED_BILLING"' },
        { status: 400 },
      );
    }

    const candidates = await listFailedViewerBillingCandidates({ take: 2000 });
    const eligible = await filterAlreadySentBillingFailure(candidates);

    if (body.dryRun) {
      return NextResponse.json({
        ok: true,
        action: "send_all",
        dryRun: true,
        wouldSend: eligible.length,
        emails: eligible.map((c) => c.email),
      });
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const emails: string[] = [];
    const errors: string[] = [];

    for (const row of eligible) {
      try {
        const result = await sendBillingFailureOnce({
          userId: row.userId,
          email: row.email,
          name: row.name,
          subscriptionId: row.subscriptionId,
          pastDueSince: row.pastDueSince,
          errorMessage: row.lastPaymentError,
        });
        if (result.sent) {
          sent += 1;
          emails.push(row.email);
        } else {
          skipped += 1;
        }
      } catch (err) {
        failed += 1;
        errors.push(`${row.email}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return NextResponse.json({
      ok: true,
      action: "send_all",
      scanned: candidates.length,
      eligible: eligible.length,
      sent,
      skipped,
      failed,
      emails,
      errors: errors.slice(0, 30),
    });
  }

  return NextResponse.json(
    { error: 'Unknown action. Use "test" or "send_all".' },
    { status: 400 },
  );
}
