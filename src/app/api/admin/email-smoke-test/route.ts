import { NextRequest, NextResponse } from "next/server";
import { actorHasAdminRight, requireAdminApiActor } from "@/lib/admin-api-auth";
import {
  sendMonthlyUpdateEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "@/lib/sendgrid";
import { getAppBaseUrl } from "@/lib/app-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only smoke test: sends welcome + password reset + monthly update
 * to a single address (defaults to the signed-in admin email).
 */
export async function POST(req: NextRequest) {
  const actor = await requireAdminApiActor();
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });
  if (!actorHasAdminRight(actor, "canManageSystem") && !actor.isGod) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { to?: string };
  const to = (body.to || actor.email || "").trim().toLowerCase();
  if (!to || !to.includes("@")) {
    return NextResponse.json({ error: "A valid to email is required." }, { status: 400 });
  }

  const base = getAppBaseUrl() || "https://story-time.online";
  const results: { name: string; ok: boolean; detail?: string }[] = [];

  try {
    await sendWelcomeEmail(to, "Andile Nomvete", {
      role: "ADMIN",
      registrationType: "sendgrid_smoke_test",
    });
    results.push({ name: "welcome", ok: true });
  } catch (err) {
    results.push({
      name: "welcome",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const rawToken = `smoke-test-${Date.now()}`;
    const resetLink = `${base.replace(/\/$/, "")}/auth/reset-password?token=${encodeURIComponent(rawToken)}&portal=admin`;
    const mail = await sendPasswordResetEmail(to, resetLink, { rawToken, portal: "admin" });
    results.push({
      name: "password_reset",
      ok: true,
      detail: mail.messageId ? `messageId=${mail.messageId}` : undefined,
    });
  } catch (err) {
    results.push({
      name: "password_reset",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
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
  } catch (err) {
    results.push({
      name: "monthly_update",
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json(
    { ok: failed.length === 0, to, results },
    { status: failed.length === 0 ? 200 : 502 },
  );
}
