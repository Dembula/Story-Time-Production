import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCreatorCommandCenter } from "@/lib/creator-command-center";

const VALID_RANGES = new Set(["7d", "30d", "month", "all"]);

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const creatorId = (session?.user as { id?: string })?.id;

  if (role !== "CONTENT_CREATOR" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!creatorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("range");
  const range = raw && VALID_RANGES.has(raw) ? raw : "month";

  const payload = await getCreatorCommandCenter(creatorId, role ?? "", { range });
  return NextResponse.json(payload);
}
