import { NextRequest, NextResponse } from "next/server";
import { actorHasAdminRight, requireAdminApiActor } from "@/lib/admin-api-auth";
import {
  countInactiveViewersNeedingReminder,
  filterAlreadyReminded,
  listInactiveViewerPackageCandidates,
  sendViewerPackageReminderOnce,
  VIEWER_PACKAGE_REMINDER_CAMPAIGN,
} from "@/lib/emails/viewer-package-reminder";
import { sendViewerPackageReminderEmail } from "@/lib/sendgrid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireReminderAdmin() {
  const actor = await requireAdminApiActor();
  if ("error" in actor) return { error: actor.error, status: actor.status } as const;
  if (!actorHasAdminRight(actor, "canManageSystem") && !actor.isGod) {
    return { error: "Forbidden", status: 403 } as const;
  }
  return { actor } as const;
}

/** Preview counts / list inactive viewers who still need the package reminder. */
export async function GET() {
  const auth = await requireReminderAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const counts = await countInactiveViewersNeedingReminder();
  return NextResponse.json({
    ok: true,
    campaignKey: VIEWER_PACKAGE_REMINDER_CAMPAIGN,
    templateEnv: "SENDGRID_TEMPLATE_REMINDER",
    ...counts,
  });
}

/**
 * Admin actions:
 * - { action: "test", to?: email } — send one reminder (does not require inactive user; default admin email)
 * - { action: "send_all", confirm: "SEND_ALL_INACTIVE" } — mass send to remaining inactive viewers (once each)
 */
export async function POST(req: NextRequest) {
  const auth = await requireReminderAdmin();
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
    await sendViewerPackageReminderEmail(to, {
      name: "Andile",
      packageUrl: "https://story-time.online/onboarding/package",
    });
    return NextResponse.json({
      ok: true,
      action: "test",
      to,
      note: "Test send only — not recorded against the one-shot campaign log unless you use send_all.",
    });
  }

  if (body.action === "send_all") {
    if (body.confirm !== "SEND_ALL_INACTIVE") {
      return NextResponse.json(
        {
          error: 'Confirm mass send with confirm: "SEND_ALL_INACTIVE"',
        },
        { status: 400 },
      );
    }

    const candidates = await listInactiveViewerPackageCandidates({ take: 2000 });
    const eligible = await filterAlreadyReminded(candidates);

    if (body.dryRun) {
      return NextResponse.json({
        ok: true,
        action: "send_all",
        dryRun: true,
        wouldSend: eligible.length,
        sample: eligible.slice(0, 20).map((c) => ({ email: c.email, userId: c.userId })),
      });
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of eligible) {
      try {
        const result = await sendViewerPackageReminderOnce({
          userId: row.userId,
          email: row.email,
          name: row.name,
        });
        if (result.sent) sent += 1;
        else skipped += 1;
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
      errors: errors.slice(0, 30),
    });
  }

  return NextResponse.json(
    { error: 'Unknown action. Use "test" or "send_all".' },
    { status: 400 },
  );
}
