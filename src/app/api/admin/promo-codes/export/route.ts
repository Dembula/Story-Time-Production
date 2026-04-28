import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function csvEscape(value: string | number | null | undefined) {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const search = req.nextUrl.searchParams;
  const code = search.get("code")?.trim().toUpperCase() || null;
  const start = search.get("start");
  const end = search.get("end");

  const redeemedAtFilter: { gte?: Date; lte?: Date } = {};
  if (start) {
    const d = new Date(start);
    if (!Number.isNaN(d.getTime())) redeemedAtFilter.gte = d;
  }
  if (end) {
    const d = new Date(end);
    if (!Number.isNaN(d.getTime())) redeemedAtFilter.lte = d;
  }

  const rows = await prisma.promoCodeRedemption.findMany({
    where: {
      ...(Object.keys(redeemedAtFilter).length > 0 ? { redeemedAt: redeemedAtFilter } : {}),
      ...(code ? { promoCode: { code } } : {}),
    },
    orderBy: { redeemedAt: "desc" },
    include: {
      promoCode: { select: { code: true, kind: true, target: true } },
      user: { select: { id: true, email: true, name: true } },
    },
    take: 5000,
  });

  const header = [
    "redeemedAt",
    "promoCode",
    "promoKind",
    "promoTarget",
    "context",
    "resultingPlan",
    "discountAmount",
    "userId",
    "userEmail",
    "userName",
    "referenceId",
  ];

  const lines = rows.map((row) =>
    [
      row.redeemedAt.toISOString(),
      row.promoCode.code,
      row.promoCode.kind,
      row.promoCode.target,
      row.context,
      row.resultingPlan,
      row.discountAmount,
      row.user.id,
      row.user.email,
      row.user.name,
      row.referenceId,
    ]
      .map(csvEscape)
      .join(","),
  );
  const csv = [header.join(","), ...lines].join("\n");

  const today = new Date().toISOString().slice(0, 10);
  const codeSuffix = code ? `-${code}` : "-all";
  const filename = `promo-redemptions${codeSuffix}-${today}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
