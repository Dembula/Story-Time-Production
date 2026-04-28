import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { embedMeta } from "@/lib/marketplace-profile-meta";
import { validateStorageUrlField, validateStorageUrlList } from "@/lib/storage-origin";
import { ensureCloudflareStreamPlaybackUrl } from "@/lib/cloudflare-stream";
import { sendWelcomeEmail } from "@/lib/sendgrid";
import {
  isMissingCreatorStudioInfrastructure,
  isMissingUserCreatorRegistrationColumns,
  MISSING_PRISMA_STUDIO_DELEGATES,
} from "@/lib/prisma-missing-table";
import { ensureUserRole } from "@/lib/user-roles";

const CREATOR_TYPES = ["content", "music", "equipment", "location", "crew", "casting", "catering", "funder"] as const;
const ROLE_MAP: Record<string, string> = {
  music: "MUSIC_CREATOR",
  equipment: "EQUIPMENT_COMPANY",
  location: "LOCATION_OWNER",
  content: "CONTENT_CREATOR",
  crew: "CREW_TEAM",
  casting: "CASTING_AGENCY",
  catering: "CATERING_COMPANY",
  funder: "FUNDER",
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      password,
      type,
      name,
      bio,
      socialLinks,
      education,
      goals,
      previousWork,
      isAfda,
      accountStructure,
      companyName,
      contactEmail,
      city,
      country,
      website,
      actorProfile,
      crewProfile,
      locationProfile,
      equipmentProfile,
      teamSeatCap,
    } = body as {
      email?: string;
      password?: string;
      type?: string;
      name?: string;
      bio?: string;
      socialLinks?: string;
      education?: string;
      goals?: string;
      previousWork?: string;
      isAfda?: boolean;
      accountStructure?: "INDIVIDUAL" | "COMPANY";
      companyName?: string;
      contactEmail?: string;
      city?: string;
      country?: string;
      website?: string;
      actorProfile?: {
        fullName?: string;
        profilePhoto?: string;
        ageRange?: string;
        gender?: string;
        location?: string;
        languages?: string[];
        skills?: string[];
        experienceLevel?: string;
        showreel?: string;
        pastWork?: string;
        dailyRate?: number;
        projectRate?: number;
        availability?: string;
        contactInfo?: string;
      };
      crewProfile?: {
        name?: string;
        role?: string;
        department?: string;
        experienceLevel?: string;
        portfolio?: string;
        dailyRate?: number;
        availability?: string;
        location?: string;
        skills?: string[];
      };
      locationProfile?: {
        name?: string;
        photos?: string[];
        address?: string;
        type?: string;
        description?: string;
        availability?: string;
        rentalCostPerDay?: number;
        rentalCostPerHour?: number;
        permitRequirements?: string;
        restrictions?: string;
        region?: string;
      };
      equipmentProfile?: {
        name?: string;
        category?: string;
        specifications?: string;
        dailyRentalRate?: number;
        quantityAvailable?: number;
        availability?: string;
        location?: string;
      };
      teamSeatCap?: number | string;
    };

    const normalizedEmail = email?.trim()?.toLowerCase();
    if (!normalizedEmail || !password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Email and password (min 8 characters) are required" },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }
    if (!type || !CREATOR_TYPES.includes(type as (typeof CREATOR_TYPES)[number])) {
      return NextResponse.json(
        { error: "Valid creator type is required" },
        { status: 400 }
      );
    }

    const normalizedActorProfile = actorProfile
      ? {
          ...actorProfile,
          profilePhoto: actorProfile.profilePhoto?.trim() || undefined,
          showreel: actorProfile.showreel?.trim() || undefined,
        }
      : undefined;
    const normalizedLocationPhotos = (locationProfile?.photos ?? []).map((p) => p?.trim()).filter(Boolean) as string[];
    const actorPhotoErr = validateStorageUrlField(normalizedActorProfile?.profilePhoto, "actorProfile.profilePhoto");
    if (actorPhotoErr) return NextResponse.json({ error: actorPhotoErr }, { status: 400 });
    const locationPhotosErr = validateStorageUrlList(normalizedLocationPhotos, "locationProfile.photos");
    if (locationPhotosErr) return NextResponse.json({ error: locationPhotosErr }, { status: 400 });
    const normalizedActorShowreel = await ensureCloudflareStreamPlaybackUrl(normalizedActorProfile?.showreel ?? null, {
      area: "creator-register-showreel",
      creatorType: type,
    });
    const actorShowreelErr = validateStorageUrlField(normalizedActorShowreel, "actorProfile.showreel");
    if (actorShowreelErr) return NextResponse.json({ error: actorShowreelErr }, { status: 400 });

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, passwordHash: true, role: true },
    });

    const passwordHash = await hash(password, 10);
    const role = ROLE_MAP[type] ?? "CONTENT_CREATOR";
    const isStudioCreator = type === "content" || type === "music";

    let studioAccountStructure: "INDIVIDUAL" | "COMPANY" | null = null;
    let studioTeamSeatCap: number | null = null;
    if (isStudioCreator) {
      if (accountStructure !== "INDIVIDUAL" && accountStructure !== "COMPANY") {
        return NextResponse.json(
          { error: "Select Individual creator or Company / team account for film or music signup." },
          { status: 400 }
        );
      }
      studioAccountStructure = accountStructure;
      if (studioAccountStructure === "COMPANY") {
        const rawCap =
          typeof teamSeatCap === "number" && Number.isFinite(teamSeatCap)
            ? teamSeatCap
            : typeof teamSeatCap === "string"
              ? parseInt(teamSeatCap.trim(), 10)
              : NaN;
        if (!Number.isFinite(rawCap) || rawCap < 1 || rawCap > 5) {
          return NextResponse.json(
            { error: "Company accounts must choose a team size between 1 and 5 (including you as admin)." },
            { status: 400 }
          );
        }
        studioTeamSeatCap = Math.floor(rawCap);
      }
    }

    const normalizedStructure = accountStructure === "INDIVIDUAL" ? "INDIVIDUAL" : "COMPANY";
    const normalizedCompanyName = (companyName?.trim() || name?.trim() || "").slice(0, 120);
    const normalizedContactEmail = (contactEmail?.trim() || normalizedEmail || "").slice(0, 255);

    const goalsMeta: Record<string, unknown> = {
      creatorType: type,
    };
    if (isStudioCreator && studioAccountStructure) {
      goalsMeta.accountStructure = studioAccountStructure;
      goalsMeta.companyName = normalizedCompanyName || null;
      if (studioAccountStructure === "COMPANY" && studioTeamSeatCap != null) {
        goalsMeta.teamSeatCap = studioTeamSeatCap;
      }
    } else {
      goalsMeta.accountStructure = normalizedStructure;
      goalsMeta.companyName = normalizedCompanyName || null;
    }

    const runCreatorRegistrationTx = async (
      persistStudioColumns: boolean,
      persistStudioProfiles: boolean,
    ) => {
      await prisma.$transaction(async (tx) => {
        const user = existing
          ? await tx.user.update({
              where: { id: existing.id },
              data: {
                name: name?.trim() || null,
                role,
                passwordHash: existing.passwordHash ? undefined : passwordHash,
                bio: bio?.trim() || null,
                socialLinks: socialLinks?.trim() || null,
                education: education?.trim() || null,
                goals: embedMeta(goals?.trim() || null, goalsMeta),
                previousWork: previousWork?.trim() || null,
                isAfdaStudent: Boolean(isAfda),
                ...(persistStudioColumns
                  ? {
                      creatorAccountStructure: studioAccountStructure,
                      creatorTeamSeatCap: studioAccountStructure === "COMPANY" ? studioTeamSeatCap : null,
                    }
                  : {}),
              },
            })
          : await tx.user.create({
              data: {
                email: normalizedEmail,
                name: name?.trim() || null,
                role,
                passwordHash,
                bio: bio?.trim() || null,
                socialLinks: socialLinks?.trim() || null,
                education: education?.trim() || null,
                goals: embedMeta(goals?.trim() || null, goalsMeta),
                previousWork: previousWork?.trim() || null,
                isAfdaStudent: Boolean(isAfda),
                ...(persistStudioColumns
                  ? {
                      creatorAccountStructure: studioAccountStructure,
                      creatorTeamSeatCap: studioAccountStructure === "COMPANY" ? studioTeamSeatCap : null,
                    }
                  : {}),
              },
            });

        if (
          persistStudioProfiles &&
          (role === "CONTENT_CREATOR" || role === "MUSIC_CREATOR") &&
          isStudioCreator &&
          studioAccountStructure
        ) {
          const txDelegates = tx as unknown as {
            creatorStudioProfile?: { create: (args: object) => Promise<{ id: string }> };
            studioCompany?: { create: (args: object) => Promise<{ id: string }> };
          };
          if (typeof txDelegates.creatorStudioProfile?.create !== "function") {
            throw new Error(MISSING_PRISMA_STUDIO_DELEGATES);
          }
          if (studioAccountStructure === "COMPANY" && typeof txDelegates.studioCompany?.create !== "function") {
            throw new Error(MISSING_PRISMA_STUDIO_DELEGATES);
          }

          const display = (name?.trim() || normalizedEmail.split("@")[0] || "Creator").slice(0, 120);
          if (studioAccountStructure === "INDIVIDUAL") {
            const prof = await tx.creatorStudioProfile.create({
              data: {
                userId: user.id,
                companyId: null,
                displayName: display,
                kind: "INDIVIDUAL",
              },
            });
            await tx.user.update({
              where: { id: user.id },
              data: { activeCreatorStudioProfileId: prof.id },
            });
          } else {
            const cap = Math.min(5, Math.max(1, studioTeamSeatCap ?? 1));
            const company = await tx.studioCompany.create({
              data: {
                ownerUserId: user.id,
                displayName: display,
                seatCap: cap,
              },
            });
            const prof = await tx.creatorStudioProfile.create({
              data: {
                userId: user.id,
                companyId: company.id,
                displayName: display,
                kind: "COMPANY",
              },
            });
            await tx.user.update({
              where: { id: user.id },
              data: { activeCreatorStudioProfileId: prof.id },
            });
          }
        }

      if (role === "CASTING_AGENCY") {
        const agency = await tx.castingAgency.upsert({
          where: { userId: user.id },
          update: {
            agencyName:
              normalizedStructure === "INDIVIDUAL"
                ? `${normalizedCompanyName || "Independent"} Casting`
                : normalizedCompanyName || "Casting Agency",
            description: bio?.trim() || null,
            city: city?.trim() || null,
            country: country?.trim() || null,
            website: website?.trim() || null,
            contactEmail: normalizedContactEmail || null,
            tagline:
              normalizedStructure === "INDIVIDUAL"
                ? "Independent casting professional"
                : "Casting agency profile",
          },
          create: {
            userId: user.id,
            agencyName:
              normalizedStructure === "INDIVIDUAL"
                ? `${normalizedCompanyName || "Independent"} Casting`
                : normalizedCompanyName || "Casting Agency",
            description: bio?.trim() || null,
            city: city?.trim() || null,
            country: country?.trim() || null,
            website: website?.trim() || null,
            contactEmail: normalizedContactEmail || null,
            tagline:
              normalizedStructure === "INDIVIDUAL"
                ? "Independent casting professional"
                : "Casting agency profile",
          },
        });
        if (actorProfile?.fullName?.trim()) {
          await tx.castingTalent.create({
            data: {
              castingAgencyId: agency.id,
              name: actorProfile.fullName.trim(),
              bio: embedMeta(actorProfile.pastWork ?? null, {
                location: actorProfile.location ?? null,
                languages: actorProfile.languages ?? [],
                experienceLevel: actorProfile.experienceLevel ?? null,
                dailyRate: actorProfile.dailyRate ?? null,
                projectRate: actorProfile.projectRate ?? null,
                availability: actorProfile.availability ?? null,
                contactVisibility: "PRIVATE",
              }),
              headshotUrl: normalizedActorProfile?.profilePhoto || null,
              ageRange: actorProfile.ageRange?.trim() || null,
              gender: actorProfile.gender?.trim() || null,
              skills: (actorProfile.skills ?? []).join(", ") || null,
              pastWork: actorProfile.pastWork?.trim() || null,
              reelUrl: normalizedActorShowreel || null,
              contactEmail: actorProfile.contactInfo?.trim() || normalizedContactEmail || null,
              cvUrl: null,
              sortOrder: 0,
            },
          });
        }
      }

      if (role === "CREW_TEAM") {
        const team = await tx.crewTeam.upsert({
          where: { userId: user.id },
          update: {
            companyName:
              normalizedStructure === "INDIVIDUAL"
                ? `${normalizedCompanyName || "Independent"} Crew`
                : normalizedCompanyName || "Crew Team",
            description: bio?.trim() || null,
            city: city?.trim() || null,
            country: country?.trim() || null,
            website: website?.trim() || null,
            contactEmail: normalizedContactEmail || null,
            specializations: (crewProfile?.skills ?? []).join(", ") || null,
            pastWorkSummary: crewProfile?.portfolio?.trim() || previousWork?.trim() || null,
            tagline:
              normalizedStructure === "INDIVIDUAL"
                ? "Independent crew professional"
                : "Production crew provider",
          },
          create: {
            userId: user.id,
            companyName:
              normalizedStructure === "INDIVIDUAL"
                ? `${normalizedCompanyName || "Independent"} Crew`
                : normalizedCompanyName || "Crew Team",
            description: bio?.trim() || null,
            city: city?.trim() || null,
            country: country?.trim() || null,
            website: website?.trim() || null,
            contactEmail: normalizedContactEmail || null,
            specializations: (crewProfile?.skills ?? []).join(", ") || null,
            pastWorkSummary: crewProfile?.portfolio?.trim() || previousWork?.trim() || null,
            tagline:
              normalizedStructure === "INDIVIDUAL"
                ? "Independent crew professional"
                : "Production crew provider",
          },
        });

        if (crewProfile?.name?.trim()) {
          await tx.crewTeamMember.create({
            data: {
              crewTeamId: team.id,
              name: crewProfile.name.trim(),
              role: crewProfile.role?.trim() || "Crew Member",
              department: crewProfile.department?.trim() || null,
              bio: embedMeta(crewProfile.portfolio ?? null, {
                role: crewProfile.role ?? null,
                department: crewProfile.department ?? null,
                experienceLevel: crewProfile.experienceLevel ?? null,
                dailyRate: crewProfile.dailyRate ?? null,
                availability: crewProfile.availability ?? null,
                location: crewProfile.location ?? null,
                tools: crewProfile.skills ?? [],
                accountStructure: normalizedStructure,
              }),
              skills: (crewProfile.skills ?? []).join(", ") || null,
              pastWork: crewProfile.portfolio?.trim() || null,
              email: normalizedContactEmail || null,
              sortOrder: 0,
            },
          });
        }
      }

      if (role === "LOCATION_OWNER") {
        await tx.locationListing.create({
          data: {
            companyId: user.id,
            name: locationProfile?.name?.trim() || normalizedCompanyName || "Production Location",
            type: locationProfile?.type?.trim() || "location",
            description: locationProfile?.description?.trim() || bio?.trim() || null,
            address: locationProfile?.address?.trim() || null,
            city: city?.trim() || locationProfile?.region?.trim() || null,
            country: country?.trim() || null,
            dailyRate: locationProfile?.rentalCostPerDay ?? null,
            photoUrls: normalizedLocationPhotos.join(", ") || null,
            availability: locationProfile?.availability?.trim() || null,
            rules: embedMeta(locationProfile?.restrictions ?? null, {
              hourlyRate: locationProfile?.rentalCostPerHour ?? null,
              dailyRate: locationProfile?.rentalCostPerDay ?? null,
              permitRequired: !!locationProfile?.permitRequirements,
              permitNotes: locationProfile?.permitRequirements ?? null,
              restrictions: locationProfile?.restrictions ?? null,
              logistics: null,
              availability: locationProfile?.availability ?? null,
            }),
            contactUrl: website?.trim() || null,
          },
        });
      }

      if (role === "EQUIPMENT_COMPANY") {
        await tx.equipmentListing.create({
          data: {
            companyId: user.id,
            companyName: normalizedCompanyName || "Equipment Provider",
            category: equipmentProfile?.category?.trim() || "General",
            description: embedMeta(equipmentProfile?.name?.trim() || bio?.trim() || null, {
              specifications: equipmentProfile?.specifications ?? null,
              dailyRate: equipmentProfile?.dailyRentalRate ?? null,
              quantityAvailable: equipmentProfile?.quantityAvailable ?? null,
              availability: equipmentProfile?.availability ?? null,
            }),
            location: equipmentProfile?.location?.trim() || city?.trim() || null,
            contactUrl: website?.trim() || null,
          },
        });
      }
      });
    };

    try {
      await runCreatorRegistrationTx(true, true);
    } catch (firstErr) {
      if (isMissingUserCreatorRegistrationColumns(firstErr)) {
        console.warn(
          "[creator/register] User studio columns unavailable (DB or outdated Prisma client); retrying without creatorAccountStructure / creatorTeamSeatCap (values remain in goals meta).",
        );
        try {
          await runCreatorRegistrationTx(false, true);
        } catch (secondErr) {
          if (isMissingCreatorStudioInfrastructure(secondErr)) {
            console.warn(
              "[creator/register] Creator studio tables/columns unavailable; retrying without studio profile rows. Apply prisma migrations when ready.",
            );
            await runCreatorRegistrationTx(false, false);
          } else {
            throw secondErr;
          }
        }
      } else if (isMissingCreatorStudioInfrastructure(firstErr)) {
        console.warn(
          "[creator/register] Creator studio tables/columns unavailable; retrying without studio profile rows. Apply prisma migrations when ready.",
        );
        try {
          await runCreatorRegistrationTx(true, false);
        } catch (secondErr) {
          if (isMissingUserCreatorRegistrationColumns(secondErr)) {
            console.warn(
              "[creator/register] Retrying without user studio columns and without studio profiles.",
            );
            await runCreatorRegistrationTx(false, false);
          } else {
            throw secondErr;
          }
        }
      } else {
        throw firstErr;
      }
    }

    const userForRole = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (!userForRole) {
      return NextResponse.json({ error: "Registration failed" }, { status: 500 });
    }
    await ensureUserRole(userForRole.id, role);

    try {
      await sendWelcomeEmail(normalizedEmail, name?.trim() || null, {
        role,
        registrationType: "creator_signup",
      });
    } catch (emailError) {
      console.error("Creator welcome email send failed:", emailError);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Creator register error:", e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
