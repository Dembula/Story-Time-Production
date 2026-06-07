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
import {
  ensureOwnedStudioCompanyForUser,
  findUserByInviteEmail,
} from "@/lib/creator-studio-company";
import { countOccupiedStudioSeats, repairCompanySeatCapForInvites } from "@/lib/creator-studio-invite-seats";
import { isPrismaMissingTable } from "@/lib/prisma-missing-table";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const role = (session?.user as { role?: string })?.role;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureOwnedStudioCompanyForUser(userId);

  const companies = await prisma.studioCompany.findMany({
    where: { ownerUserId: userId },
    select: { id: true, displayName: true },
  });
  if (companies.length === 0) return NextResponse.json({ invites: [] });

  let invites;
  try {
    invites = await prisma.creatorStudioTeamInvite.findMany({
      where: { companyId: { in: companies.map((c) => c.id) } },
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { id: true, displayName: true } },
        invitedUser: { select: { id: true, email: true, name: true } },
      },
    });
  } catch (e) {
    if (isPrismaMissingTable(e, "CreatorStudioTeamInvite")) {
      return NextResponse.json({ invites: [] });
    }
    throw e;
  }

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
  if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const ownerRow = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (ownerRow?.email && normalizeInviteEmail(ownerRow.email) === emailNorm) {
    return NextResponse.json({ error: "You cannot invite your own email address." }, { status: 400 });
  }

  const suites = body?.suiteAccess ?? [];
  if (!Array.isArray(suites) || suites.length === 0) {
    return NextResponse.json({ error: "Select at least one suite for the invitee." }, { status: 400 });
  }
  if (!isValidSuiteList(suites)) {
    return NextResponse.json({ error: "Invalid suiteAccess list" }, { status: 400 });
  }

  try {
    await ensureOwnedStudioCompanyForUser(userId);

    let resolvedCompanyId = companyId;
    let company = resolvedCompanyId
      ? await prisma.studioCompany.findFirst({
          where: { id: resolvedCompanyId, ownerUserId: userId },
          select: { id: true, displayName: true, seatCap: true },
        })
      : null;

    if (!company) {
      const owned = await prisma.studioCompany.findMany({
        where: { ownerUserId: userId },
        select: { id: true, displayName: true, seatCap: true },
        orderBy: { createdAt: "asc" },
      });
      if (owned.length === 1) {
        company = owned[0];
        resolvedCompanyId = owned[0].id;
      } else if (owned.length === 0) {
        return NextResponse.json(
          { error: "No studio company workspace found. Complete company registration or contact support." },
          { status: 403 },
        );
      } else {
        return NextResponse.json(
          { error: "Company not found or you are not the owner. Select your company and try again." },
          { status: 403 },
        );
      }
    }

    const seats = await repairCompanySeatCapForInvites(resolvedCompanyId, userId);
    if (seats.occupied >= seats.seatCap) {
      return NextResponse.json(
        {
          error: `Seat cap reached (${seats.seatCap} including you). ${seats.members} member(s) and ${seats.pendingInvites} pending invite(s). Cancel a pending invite or remove a member before inviting again.`,
        },
        { status: 400 },
      );
    }

    company = { ...company, seatCap: seats.seatCap };

    const existingUser = await findUserByInviteEmail(emailNorm);

    let dup;
    try {
      dup = await prisma.creatorStudioTeamInvite.findFirst({
        where: {
          companyId: resolvedCompanyId,
          emailNorm,
          status: "PENDING",
        },
      });
    } catch (e) {
      if (isPrismaMissingTable(e, "CreatorStudioTeamInvite")) {
        return NextResponse.json(
          {
            error:
              "Team invites are not available yet. Apply the latest database migrations (CreatorStudioTeamInvite) and restart the app.",
          },
          { status: 503 },
        );
      }
      throw e;
    }
    if (dup) {
      return NextResponse.json(
        { error: "An open invite already exists for this email on this company." },
        { status: 409 },
      );
    }

    if (existingUser) {
      const alreadyMember = await prisma.creatorStudioProfile.findFirst({
        where: { companyId: resolvedCompanyId, userId: existingUser.id },
      });
      if (alreadyMember) {
        return NextResponse.json({ error: "This user is already on your studio team." }, { status: 409 });
      }
    }

    const token = generateInviteToken();
    let invite;
    try {
      invite = await prisma.creatorStudioTeamInvite.create({
        data: {
          companyId: resolvedCompanyId,
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
    } catch (e) {
      if (isPrismaMissingTable(e, "CreatorStudioTeamInvite")) {
        return NextResponse.json(
          {
            error:
              "Team invites are not available yet. Apply the latest database migrations (CreatorStudioTeamInvite) and restart the app.",
          },
          { status: 503 },
        );
      }
      throw e;
    }

    const joinPath = `/creator/join/company/${token}`;
    const origin =
      req.headers.get("x-forwarded-host") && req.headers.get("x-forwarded-proto")
        ? `${req.headers.get("x-forwarded-proto")}://${req.headers.get("x-forwarded-host")}`
        : req.headers.get("origin") ?? "";
    const joinUrl = origin ? `${origin}${joinPath}` : joinPath;

    if (existingUser) {
      try {
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
      } catch (e) {
        console.error("[studio-company/invites POST] notification create failed", e);
      }
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
  } catch (e) {
    console.error("[studio-company/invites POST]", e);
    return NextResponse.json({ error: "Could not send invite. Try again in a moment." }, { status: 500 });
  }
}
