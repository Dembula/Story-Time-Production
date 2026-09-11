import { NextResponse } from "next/server";
import { getLandingSpotlight } from "@/lib/landing-spotlight";

/** Cache briefly so landing hero remounts do not re-rank + re-pack every time. */
export const revalidate = 60;

export async function GET() {
  try {
    const items = await getLandingSpotlight(10);
    return NextResponse.json(
      { items },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (err) {
    console.error("Landing spotlight API error:", err);
    return NextResponse.json({ items: [] });
  }
}
