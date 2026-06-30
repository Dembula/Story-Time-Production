import { NextRequest, NextResponse } from "next/server";
import { buildPersonPreview, ensureCrewMemberCreditPerson } from "@/lib/credit-person";

export async function GET(req: NextRequest) {
  const crewMemberId = req.nextUrl.searchParams.get("crewMemberId");
  if (!crewMemberId) {
    return NextResponse.json({ error: "crewMemberId required" }, { status: 400 });
  }

  const person = await ensureCrewMemberCreditPerson(crewMemberId);
  if (!person) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const preview = await buildPersonPreview(person.id);
  if (!preview) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(preview);
}
