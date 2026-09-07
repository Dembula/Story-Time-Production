import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  fetchMarketplaceDossier,
  isMarketplaceDossierType,
} from "@/lib/admin/marketplace-dossier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { type, id } = await params;
  if (!isMarketplaceDossierType(type)) {
    return NextResponse.json(
      { error: "Invalid marketplace type. Use crew, cast, locations, equipment, or catering." },
      { status: 400 },
    );
  }
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const dossier = await fetchMarketplaceDossier(type, id);
  if (!dossier) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(dossier);
}
