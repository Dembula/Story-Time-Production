import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getAdminMarketplaceTransactionDetail,
  getAdminPaymentRecordDetail,
} from "@/lib/admin/payment-transaction-detail";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { error: null as NextResponse | null };
}

export async function GET(req: NextRequest) {
  const access = await requireAdmin();
  if (access.error) return access.error;

  const kind = req.nextUrl.searchParams.get("kind")?.trim();
  const id = req.nextUrl.searchParams.get("id")?.trim();
  if (!kind || !id) {
    return NextResponse.json({ error: "kind and id are required." }, { status: 400 });
  }

  if (kind === "payment") {
    const detail = await getAdminPaymentRecordDetail(id);
    if (!detail) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    return NextResponse.json({ ok: true, detail });
  }

  if (kind === "marketplace") {
    const detail = await getAdminMarketplaceTransactionDetail(id);
    if (!detail) return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    return NextResponse.json({ ok: true, detail });
  }

  return NextResponse.json({ error: "kind must be payment or marketplace." }, { status: 400 });
}
