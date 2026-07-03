import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { compare } from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, recordRateLimitFailure } from "@/lib/rate-limit";

export const runtime = "nodejs";

function clientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    null
  );
}

/**
 * App Store / Play Store requirement: users must be able to delete their account.
 * Requires confirmation phrase DELETE. Password required when the account has a password hash.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rate = checkRateLimit({
    key: "account-delete",
    ip: `${userId}:${clientIp(req)}`,
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many delete attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    confirmation?: string;
    password?: string;
  } | null;

  if (body?.confirmation?.trim().toUpperCase() !== "DELETE") {
    return NextResponse.json(
      { error: "Type DELETE to confirm permanent account deletion." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, role: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.role === "ADMIN") {
    return NextResponse.json(
      { error: "Admin accounts cannot be self-deleted. Contact support." },
      { status: 403 },
    );
  }

  if (user.passwordHash) {
    const password = body?.password ?? "";
    const ok = await compare(password, user.passwordHash);
    if (!ok) {
      recordRateLimitFailure({
        key: "account-delete-fail",
        ip: `${userId}:${clientIp(req)}`,
        windowMs: 60 * 60 * 1000,
      });
      return NextResponse.json({ error: "Incorrect password." }, { status: 403 });
    }
  }

  // Cancel active viewer subscriptions before delete (best-effort).
  await prisma.viewerSubscription
    .updateMany({
      where: { userId, status: { in: ["ACTIVE", "TRIALING", "TRIAL_ACTIVE", "PAST_DUE"] } },
      data: { status: "CANCELLED" },
    })
    .catch(() => {});

  await prisma.session.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.account.deleteMany({ where: { userId } }).catch(() => {});

  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch (err) {
    console.error("Account delete failed:", err);
    // Fallback anonymization if hard delete is blocked by relations.
    const tombstone = `deleted+${userId}@deleted.storytime.invalid`;
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: tombstone,
        name: "Deleted User",
        passwordHash: null,
        image: null,
        phoneNumber: null,
        bio: null,
        professionalName: null,
        website: null,
        location: null,
        socialLinks: null,
        networkProfilePublic: false,
      },
    });
    await prisma.session.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.account.deleteMany({ where: { userId } }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
