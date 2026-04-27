import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashPassword, validateEmail, validatePassword } from "@/lib/auth-utils";

/**
 * Public: request admin portal access. Creates a pending application reviewed in /admin/requests.
 */
export async function POST(request: NextRequest) {
  const rate = checkRateLimit({
    key: "admin-access-request",
    ip: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown",
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let body: { email?: string; password?: string; name?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const name = body.name?.trim() || null;

  if (!validateEmail(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (!validatePassword(password)) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const existingAdmin = await prisma.user.findFirst({
    where: { email, role: "ADMIN" },
    select: { id: true },
  });
  if (existingAdmin) {
    return NextResponse.json({ error: "This email already has an admin account." }, { status: 409 });
  }

  const pending = await prisma.adminAccessApplication.findFirst({
    where: { email, status: "PENDING" },
    select: { id: true },
  });
  if (pending) {
    return NextResponse.json(
      { error: "A request for this email is already pending review." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);

  await prisma.adminAccessApplication.create({
    data: {
      email,
      name,
      passwordHash,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    ok: true,
    message: "Request submitted. An administrator will review your application.",
  });
}
