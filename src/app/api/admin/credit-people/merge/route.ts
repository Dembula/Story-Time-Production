import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { mergeCreditPeople } from "@/lib/credit-person";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    keepPersonId?: string;
    mergePersonId?: string;
  } | null;

  if (!body?.keepPersonId || !body?.mergePersonId) {
    return NextResponse.json({ error: "keepPersonId and mergePersonId required" }, { status: 400 });
  }

  try {
    const keepPersonId = await mergeCreditPeople(body.keepPersonId, body.mergePersonId);
    return NextResponse.json({ ok: true, keepPersonId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Merge failed" },
      { status: 400 },
    );
  }
}
