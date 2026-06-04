import { NextResponse } from "next/server";
import { getLandingSpotlight } from "@/lib/landing-spotlight";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await getLandingSpotlight(10);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("Landing spotlight API error:", err);
    return NextResponse.json({ items: [] });
  }
}
