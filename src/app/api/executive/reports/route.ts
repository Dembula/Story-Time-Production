import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireExecutiveActor } from "@/lib/executive/seats";
import { writeExecutiveAudit } from "@/lib/executive/audit";
import { fetchExecutiveDataBundle } from "@/lib/executive/bundle";
import { formatZar } from "@/lib/format-currency-zar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Role report builder — numbers come only from the executive data layer. */
export async function GET() {
  const actor = await requireExecutiveActor();
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });

  try {
    const reports = await prisma.executiveReport.findMany({
      where: { office: actor.office },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { schedules: true },
    });
    return NextResponse.json({
      reports: reports.map((r) => ({
        id: r.id,
        title: r.title,
        definition: r.definition,
        lastRunAt: r.lastRunAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        schedules: r.schedules.map((s) => ({
          id: s.id,
          cadence: s.cadence,
          hourLocal: s.hourLocal,
          weekday: s.weekday,
          active: s.active,
          nextRunAt: s.nextRunAt?.toISOString() ?? null,
        })),
      })),
    });
  } catch {
    return NextResponse.json({ reports: [] });
  }
}

export async function POST(req: NextRequest) {
  const actor = await requireExecutiveActor();
  if ("error" in actor) return NextResponse.json({ error: actor.error }, { status: actor.status });

  const body = (await req.json().catch(() => null)) as {
    action?: "save" | "generate" | "schedule";
    title?: string;
    reportId?: string;
    kpiIds?: string[];
    cadence?: string;
    hourLocal?: number;
    weekday?: number;
    format?: "json" | "csv";
  } | null;

  const bundle = await fetchExecutiveDataBundle(actor.office);

  if (body?.action === "generate" || !body?.action) {
    const selected = body?.kpiIds?.length
      ? bundle.kpis.filter((k) => body.kpiIds!.includes(k.id))
      : bundle.kpis;

    const generatedAt = new Date().toISOString();
    const narrative = [
      `${actor.office} executive report — ${bundle.meta.period.label}`,
      `Question: ${bundle.question}`,
      `Generated: ${generatedAt}`,
      `Data freshness: ${bundle.meta.freshnessLabel}`,
      "",
      "KPI summary (source: Executive Data Layer):",
      ...selected.map((k) => {
        const value =
          k.unit === "ZAR" && typeof k.value === "number"
            ? formatZar(k.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : `${k.value}${k.unit ? ` ${k.unit}` : ""}`;
        return `- ${k.label}: ${value}`;
      }),
      "",
      bundle.alerts.length
        ? `Alerts (${bundle.alerts.length}):\n${bundle.alerts.map((a) => `- [${a.severity}] ${a.title}: ${a.description}`).join("\n")}`
        : "No active anomaly alerts.",
    ].join("\n");

    const rows = selected.map((k) => ({
      id: k.id,
      label: k.label,
      value: k.value,
      unit: k.unit ?? "",
      deltaPct: k.deltaPct ?? "",
    }));

    if (body?.format === "csv") {
      const header = "id,label,value,unit,deltaPct";
      const lines = rows.map(
        (r) =>
          `${JSON.stringify(r.id)},${JSON.stringify(r.label)},${JSON.stringify(String(r.value))},${JSON.stringify(r.unit)},${JSON.stringify(String(r.deltaPct))}`,
      );
      await writeExecutiveAudit({
        userId: actor.userId,
        email: actor.email,
        office: actor.office,
        action: "GENERATE_REPORT_CSV",
      });
      return new NextResponse([header, ...lines].join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${actor.office.toLowerCase()}-report.csv"`,
        },
      });
    }

    await writeExecutiveAudit({
      userId: actor.userId,
      email: actor.email,
      office: actor.office,
      action: "GENERATE_REPORT",
    });

    return NextResponse.json({
      title: body?.title?.trim() || `${actor.office} snapshot — ${bundle.meta.period.label}`,
      period: bundle.meta.period,
      generatedAt,
      freshness: bundle.meta.freshnessLabel,
      narrative,
      kpis: rows,
      alerts: bundle.alerts,
      methodology:
        "All figures are taken from fetchExecutiveDataBundle (viewer pool, churn, content pipeline, encode, AI observability). No fabricated numbers.",
    });
  }

  if (body?.action === "save") {
    const title = body.title?.trim() || `${actor.office} saved report`;
    try {
      const report = await prisma.executiveReport.create({
        data: {
          office: actor.office,
          title,
          definition: {
            kpiIds: body.kpiIds ?? bundle.kpis.map((k) => k.id),
            periodKey: bundle.meta.period.key,
          },
          createdById: actor.userId,
          lastRunAt: new Date(),
        },
      });
      await writeExecutiveAudit({
        userId: actor.userId,
        email: actor.email,
        office: actor.office,
        action: "SAVE_REPORT",
        entityType: "ExecutiveReport",
        entityId: report.id,
      });
      return NextResponse.json({ report: { id: report.id, title: report.title } }, { status: 201 });
    } catch (e) {
      console.error("save report", e);
      return NextResponse.json({ error: "Failed to save report" }, { status: 500 });
    }
  }

  if (body?.action === "schedule") {
    const reportId = body.reportId?.trim();
    if (!reportId) return NextResponse.json({ error: "reportId required" }, { status: 400 });
    try {
      const owned = await prisma.executiveReport.findFirst({
        where: { id: reportId, office: actor.office },
      });
      if (!owned) return NextResponse.json({ error: "Report not found" }, { status: 404 });
      const cadence = body.cadence || "weekly";
      const hourLocal = typeof body.hourLocal === "number" ? body.hourLocal : 8;
      const nextRunAt = new Date();
      nextRunAt.setDate(nextRunAt.getDate() + (cadence === "daily" ? 1 : 7));
      nextRunAt.setHours(hourLocal, 0, 0, 0);

      const schedule = await prisma.executiveReportSchedule.create({
        data: {
          reportId,
          cadence,
          hourLocal,
          weekday: body.weekday ?? 1,
          nextRunAt,
          active: true,
        },
      });
      await writeExecutiveAudit({
        userId: actor.userId,
        email: actor.email,
        office: actor.office,
        action: "SCHEDULE_REPORT",
        entityType: "ExecutiveReportSchedule",
        entityId: schedule.id,
      });
      return NextResponse.json({ schedule: { id: schedule.id, nextRunAt: nextRunAt.toISOString() } }, { status: 201 });
    } catch (e) {
      console.error("schedule report", e);
      return NextResponse.json({ error: "Failed to schedule report" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
