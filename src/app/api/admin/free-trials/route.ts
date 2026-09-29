import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getFreeTrialSettings,
  listFreeTrialSettingsHistory,
  upsertFreeTrialSettings,
} from "@/lib/payments/free-trial-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [settings, history] = await Promise.all([
    getFreeTrialSettings(),
    listFreeTrialSettingsHistory(20),
  ]);

  return NextResponse.json({
    settings,
    history: history.map((row) => ({
      id: row.id,
      freeTrialsEnabled: row.freeTrialsEnabled,
      note: row.note,
      updatedByUserId: row.updatedByUserId,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const adminId = (session?.user as { id?: string } | undefined)?.id;
  if (role !== "ADMIN" || !adminId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    freeTrialsEnabled?: boolean;
    note?: string | null;
  };

  if (typeof body.freeTrialsEnabled !== "boolean") {
    return NextResponse.json(
      { error: "freeTrialsEnabled (boolean) is required" },
      { status: 400 },
    );
  }

  const settings = await upsertFreeTrialSettings({
    freeTrialsEnabled: body.freeTrialsEnabled,
    note: body.note,
    updatedByUserId: adminId,
  });

  try {
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: adminId,
        action: body.freeTrialsEnabled ? "FREE_TRIALS_ENABLED" : "FREE_TRIALS_DISABLED",
        entityType: "PlatformFreeTrialSettings",
        entityId: settings.id ?? "unknown",
        newValue: {
          freeTrialsEnabled: settings.freeTrialsEnabled,
          note: settings.note,
        },
      },
    });
  } catch {
    // Audit is best-effort.
  }

  return NextResponse.json({ settings });
}
