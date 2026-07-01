import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { compare, hash } from "bcryptjs";
import { normalizeAvatarImageUrl } from "@/lib/avatar-image-url";
import { completeViewerAccountOnboarding, isViewerAccountOnboardingComplete } from "@/lib/viewer-account-onboarding";
import { loadViewerBillingAddress, upsertViewerBillingAddress } from "@/lib/user-settings-persistence";
import { mergeCreatorGoalsForSave } from "@/lib/creator-profile-goals";
import { sanitizeCreatorEducation } from "@/lib/creator-viewer-profile";
import { buildPlatformRoleOptions, loadUserPlatformRoles } from "@/lib/platform-roles";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      image: true,
      role: true,
      bio: true,
      socialLinks: true,
      education: true,
      goals: true,
      previousWork: true,
      isAfdaStudent: true,
      institutionName: true,
      studentId: true,
      showCreatorAboutOnTitles: true,
      headline: true,
      location: true,
      website: true,
      professionalName: true,
      bannerImageUrl: true,
      primaryRole: true,
      skills: true,
      expertiseAreas: true,
      yearsExperience: true,
      availabilityStatus: true,
      reputationScore: true,
      networkProfilePublic: true,
      creatorAccountStructure: true,
      creatorTeamSeatCap: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const address =
    (session.user as { role?: string }).role === "SUBSCRIBER" ||
    (session.user as { role?: string }).role === "ADMIN"
      ? await loadViewerBillingAddress(session.user.id).catch(() => null)
      : null;

  const activeRole = (session.user as { role?: string }).role ?? user.role;
  const platformRoles = await loadUserPlatformRoles(session.user.id, activeRole);

  return NextResponse.json({
    ...user,
    activeRole,
    platformRoles,
    platformRoleOptions: buildPlatformRoleOptions(platformRoles),
    multiRole: platformRoles.length > 1,
    address,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    name,
    email,
    phoneNumber,
    currentPassword,
    newPassword,
    bio,
    socialLinks,
    education,
    goals,
    previousWork,
    headline,
    location,
    website,
    isAfdaStudent,
    institutionName,
    studentId,
    showCreatorAboutOnTitles,
    image,
    residentialAddress,
    city,
    provinceState,
    postalCode,
    country,
  } = body as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = typeof name === "string" ? name.trim() : name;
  if (phoneNumber !== undefined) {
    data.phoneNumber = typeof phoneNumber === "string" ? phoneNumber.trim() || null : null;
  }
  if (image !== undefined) {
    try {
      data.image = normalizeAvatarImageUrl(typeof image === "string" ? image : "");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid image URL";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }
  if (bio !== undefined) data.bio = bio;
  if (socialLinks !== undefined) data.socialLinks = typeof socialLinks === "string" ? socialLinks : JSON.stringify(socialLinks);
  if (education !== undefined) {
    const existingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { institutionName: true },
    });
    data.education =
      typeof education === "string"
        ? sanitizeCreatorEducation(education, existingUser?.institutionName)
        : null;
  }
  if (goals !== undefined) {
    const existing = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { goals: true },
    });
    data.goals =
      typeof goals === "string"
        ? mergeCreatorGoalsForSave(existing?.goals, goals)
        : goals;
  }
  if (previousWork !== undefined) data.previousWork = previousWork;
  if (typeof isAfdaStudent === "boolean") data.isAfdaStudent = isAfdaStudent;
  if (institutionName !== undefined) {
    data.institutionName = typeof institutionName === "string" ? institutionName.trim() || null : null;
  }
  if (studentId !== undefined) {
    data.studentId = typeof studentId === "string" ? studentId.trim() || null : null;
  }
  if (typeof showCreatorAboutOnTitles === "boolean") {
    data.showCreatorAboutOnTitles = showCreatorAboutOnTitles;
  }

  if (email !== undefined) {
    const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!normalized) return NextResponse.json({ error: "Email is required" }, { status: 400 });
    const existing = await prisma.user.findFirst({
      where: { email: normalized, id: { not: session.user.id } },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 400 });
    data.email = normalized;
  }

  if (newPassword !== undefined) {
    const current = typeof currentPassword === "string" ? currentPassword : "";
    const next = typeof newPassword === "string" ? newPassword : "";
    if (next.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }
    const userAuth = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });
    if (userAuth?.passwordHash) {
      const ok = await compare(current, userAuth.passwordHash);
      if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
    data.passwordHash = await hash(next, 10);
  }

  if (headline !== undefined) data.headline = headline;
  if (location !== undefined) data.location = location;
  if (website !== undefined) data.website = website;

  const userSelect = {
    id: true,
    name: true,
    email: true,
    phoneNumber: true,
    image: true,
    role: true,
    bio: true,
    socialLinks: true,
    education: true,
    goals: true,
    previousWork: true,
    isAfdaStudent: true,
    institutionName: true,
    studentId: true,
    showCreatorAboutOnTitles: true,
    headline: true,
    location: true,
    website: true,
  } as const;

  let updated;
  try {
    if (Object.keys(data).length > 0) {
      updated = await prisma.user.update({
        where: { id: session.user.id },
        data,
        select: userSelect,
      });
    } else {
      updated = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: userSelect,
      });
      if (!updated) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update profile.";
    const hint =
      message.includes("phoneNumber") || message.includes("column")
        ? " Database may be missing viewer onboarding columns. Run: npx prisma migrate deploy"
        : "";
    return NextResponse.json({ error: `${message}${hint}` }, { status: 400 });
  }

  const hasAddressField =
    residentialAddress !== undefined ||
    city !== undefined ||
    provinceState !== undefined ||
    postalCode !== undefined ||
    country !== undefined;
  if (hasAddressField) {
    try {
      await upsertViewerBillingAddress(session.user.id, {
        residentialAddress: typeof residentialAddress === "string" ? residentialAddress : undefined,
        city: typeof city === "string" ? city : undefined,
        provinceState: typeof provinceState === "string" ? provinceState : undefined,
        postalCode: typeof postalCode === "string" ? postalCode : undefined,
        country: typeof country === "string" ? country : undefined,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Could not save billing address. Ensure UserPreference table exists (run migrations).",
        },
        { status: 400 },
      );
    }
  }

  const role = (session.user as { role?: string }).role;
  if (role === "SUBSCRIBER" || role === "ADMIN") {
    const fresh = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, phoneNumber: true, accountOnboardingCompletedAt: true },
    });
    if (fresh && !isViewerAccountOnboardingComplete(fresh) && fresh.name && fresh.email && fresh.phoneNumber) {
      await completeViewerAccountOnboarding(session.user.id, {
        name: fresh.name,
        email: fresh.email,
        phoneNumber: fresh.phoneNumber,
      }).catch(() => null);
    }
  }

  const billingAddress =
    hasAddressField || role === "SUBSCRIBER" || role === "ADMIN"
      ? await loadViewerBillingAddress(session.user.id).catch(() => null)
      : null;

  if (name !== undefined && typeof name === "string" && name.trim()) {
    const { linkUserToCreditProfiles } = await import("@/lib/credit-person");
    void linkUserToCreditProfiles(session.user.id).catch(() => null);
  }

  return NextResponse.json({ ...updated, billingAddress });
}
