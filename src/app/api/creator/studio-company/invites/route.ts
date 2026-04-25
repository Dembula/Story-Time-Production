import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateInviteToken,
  inviteExpiresAtDefault,
  isValidSuiteList,
  normalizeInviteEmail,
} from "@/lib/creator-team-invites";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const companies = await prisma.studioCompany.findMany({
    where: { ownerUserId: userId },
    select: { id: true, displayName: true },
  });
  if (companies.length === 0) return NextResponse.json({ invites: [] });

  const invites = await prisma.creatorStudioTeamInvite.findMany({
    where: { companyId: { in: companies.map((c) => c.id) } },
    orderBy: { createdAt: "desc" },
    include: {
      company: { select: { id: true, displayName: true } },
      invitedUser: { select: { id: true, email: true, name: true } },
    },
  });

  return NextResponse.json({
    invites: invites.map((i: (typeof invites)[number]) => ({
      id: i.id,
      companyId: i.companyId,
      companyName: i.company.displayName,
      emailNorm: i.emailNorm,
      invitedUserId: i.invitedUserId,
      invitedUserEmail: i.invitedUser?.email ?? null,
      status: i.status,
      suiteAccess: i.suiteAccess,
      personalMessage: i.personalMessage,
      token: i.token,
      expiresAt: i.expiresAt.toISOString(),
      createdAt: i.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    companyId?: string;
    email?: string;
    suiteAccess?: string[];
    personalMessage?: string;
  } | null;

  const companyId = typeof body?.companyId === "string" ? body.companyId.trim() : "";
  const emailRaw = typeof body?.email === "string" ? body.email : "";
  const emailNorm = normalizeInviteEmail(emailRaw);
  if (!companyId || !emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return NextResponse.json({ error: "companyId and valid email are required" }, { status: 400 });
  }

  const suites = body?.suiteAccess ?? [];
  if (!isValidSuiteList(suites)) {
    return NextResponse.json({ error: "Invalid suiteAccess list" }, { status: 400 });
  }

  const company = await prisma.studioCompany.findFirst({
    where: { id: companyId, ownerUserId: userId },
    include: {
      profiles: { select: { id: true } },
    },
  });
  if (!company) {
    return NextResponse.json({ error: "Company not found or you are not the owner." }, { status: 403 });
  }

  if (company.profiles.length >= company.seatCap) {
    return NextResponse.json(
      { error: `Seat cap reached (${company.seatCap}). Remove a member or raise seats before inviting.` },
      { status: 400 },
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: emailNorm },
    select: { id: true, email: true },
  });

  const dup = await prisma.creatorStudioTeamInvite.findFirst({
    where: {
      companyId,
      emailNorm,
      status: "PENDING",
    },
  });
  if (dup) {
    return NextResponse.json({ error: "An open invite already exists for this email on this company." }, { status: 409 });
  }

  if (existingUser) {
    const alreadyMember = await prisma.creatorStudioProfile.findFirst({
      where: { companyId, userId: existingUser.id },
    });
    if (alreadyMember) {
      return NextResponse.json({ error: "This user is already on your studio team." }, { status: 409 });
    }
  }

  const token = generateInviteToken();
  const invite = await prisma.creatorStudioTeamInvite.create({
    data: {
      companyId,
      invitedByUserId: userId,
      emailNorm,
      invitedUserId: existingUser?.id ?? null,
      status: "PENDING",
      suiteAccess: suites,
      personalMessage: typeof body?.personalMessage === "string" ? body.personalMessage.slice(0, 2000) : null,
      token,
      expiresAt: inviteExpiresAtDefault(),
    },
  });

  const joinPath = `/creator/join/company/${token}`;
  const origin =
    req.headers.get("x-forwarded-host") && req.headers.get("x-forwarded-proto")
      ? `${req.headers.get("x-forwarded-proto")}://${req.headers.get("x-forwarded-host")}`
      : req.headers.get("origin") ?? "";
  const joinUrl = origin ? `${origin}${joinPath}` : joinPath;

  if (existingUser) {
    await prisma.notification.create({
      data: {
        userId: existingUser.id,
        type: "STUDIO_TEAM_INVITE",
        title: `Team invite: ${company.displayName}`,
        body: `You were invited to join the studio company “${company.displayName}” on Story Time. Open to review and accept.`,
        metadata: JSON.stringify({
          url: joinPath,
          inviteId: invite.id,
          companyId: company.id,
          companyName: company.displayName,
        }),
      },
    });
  }

  return NextResponse.json({
    invite: {
      id: invite.id,
      emailNorm: invite.emailNorm,
      status: invite.status,
      token: invite.token,
      expiresAt: invite.expiresAt.toISOString(),
    },
    registeredOnPlatform: Boolean(existingUser),
    joinUrl,
    message: existingUser
      ? "They will see this invite in their notification bell."
      : "This email is not registered yet. Share the join link — after they sign up with the same email they can open it to finish onboarding for your company.",
  });
}
