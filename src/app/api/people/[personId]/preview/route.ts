import { NextRequest, NextResponse } from "next/server";
import { buildPersonPreview } from "@/lib/credit-person";

type RouteParams = { params: Promise<{ personId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { personId } = await params;
  const preview = await buildPersonPreview(personId);
  if (!preview) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(preview);
}
