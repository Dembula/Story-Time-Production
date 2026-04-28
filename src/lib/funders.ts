import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { FUNDING_MARKET_CATEGORIES } from "@/lib/funder-markets";

export async function requireSessionUser() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!session || !user?.id || !user?.role) {
    return { userId: null, role: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { userId: user.id, role: user.role, error: null as NextResponse | null };
}

export function canCreateListings(role: string) {
  return [
    "CONTENT_CREATOR",
    "MUSIC_CREATOR",
    "EQUIPMENT_COMPANY",
    "LOCATION_OWNER",
    "CREW_TEAM",
    "CASTING_AGENCY",
    "CATERING_COMPANY",
    "ADMIN",
  ].includes(role);
}

export function isFunderRole(role: string) {
  return role === "FUNDER" || role === "ADMIN";
}
