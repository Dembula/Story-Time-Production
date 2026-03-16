import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCreatorAnalytics } from "@/lib/creator-analytics";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const creatorId = (session?.user as { id?: string })?.id;

  if (role !== "CONTENT_CREATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!creatorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const analytics = await getCreatorAnalytics(creatorId);
  return NextResponse.json(analytics);
}
