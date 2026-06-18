import { NextRequest, NextResponse } from "next/server";
import { processPayFastItn } from "@/lib/payments/payfast-itn-processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const result = await processPayFastItn(rawBody);

  if (!result.ok) {
    console.warn("payfast itn rejected", {
      status: result.status,
      error: result.error,
      bodyLength: rawBody.length,
    });
    if (result.status === 401) return new NextResponse("Invalid signature", { status: 401 });
    if (result.status === 404) return new NextResponse(result.error, { status: 404 });
    if (result.status === 400) return new NextResponse(result.error, { status: 400 });
    return new NextResponse(result.error, { status: result.status });
  }

  return new NextResponse("OK", { status: 200 });
}
