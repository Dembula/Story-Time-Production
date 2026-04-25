import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findBreakdownMakeupsForProject, patchBreakdownMakeups } from "@/lib/breakdown-makeup-db";

async function ensureAccess(projectId: string) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), userId: null as string | null };
  }

  const project = await prisma.originalProject.findUnique({
    where: { id: projectId },
    include: { members: true, pitches: true },
  });

  if (!project) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }), userId: null as string | null };
  }

  const isCreatorMember =
    role === "ADMIN" ||
    project.members.some((m) => m.userId === userId) ||
    project.pitches.some((p) => p.creatorId === userId);

  if (!isCreatorMember) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), userId: null as string | null };
  }

  return { error: null as NextResponse | null, userId };
}

export async function GET(_req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;

  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const [characters, props, locations, wardrobe, extras, vehicles, stunts, sfx] = await Promise.all([
    prisma.breakdownCharacter.findMany({ where: { projectId } }),
    prisma.breakdownProp.findMany({ where: { projectId } }),
    prisma.breakdownLocation.findMany({ where: { projectId } }),
    prisma.breakdownWardrobe.findMany({ where: { projectId } }),
    prisma.breakdownExtra.findMany({ where: { projectId } }),
    prisma.breakdownVehicle.findMany({ where: { projectId } }),
    prisma.breakdownStunt.findMany({ where: { projectId } }),
    prisma.breakdownSfx.findMany({ where: { projectId } }),
  ]);
  const makeups = await findBreakdownMakeupsForProject(prisma, projectId);

  return NextResponse.json({
    projectId,
    characters,
    props,
    locations,
    wardrobe,
    extras,
    vehicles,
    stunts,
    sfx,
    makeups,
  });
}

// Bulk upsert simple breakdown items; each array element may have optional id for update
export async function PATCH(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;

  const access = await ensureAccess(projectId);
  if (access.error) return access.error;

  const body = (await req.json().catch(() => null)) as
    | {
        characters?: {
          id?: string;
          name: string;
          description?: string | null;
          importance?: string | null;
          sceneId?: string | null;
        }[];
        props?: {
          id?: string;
          name: string;
          description?: string | null;
          special?: boolean;
          sceneId?: string | null;
        }[];
        locations?: {
          id?: string;
          name: string;
          description?: string | null;
          sceneId?: string | null;
          locationListingId?: string | null;
        }[];
        wardrobe?: {
          id?: string;
          description: string;
          character?: string | null;
          sceneId?: string | null;
        }[];
        extras?: { id?: string; description: string; quantity?: number; sceneId?: string | null }[];
        vehicles?: {
          id?: string;
          description: string;
          stuntRelated?: boolean;
          sceneId?: string | null;
        }[];
        stunts?: { id?: string; description: string; safetyNotes?: string | null; sceneId?: string | null }[];
        sfx?: { id?: string; description: string; practical?: boolean; sceneId?: string | null }[];
        makeups?: { id?: string; notes: string; character?: string | null; sceneId?: string | null }[];
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    if (body.characters) {
      for (const ch of body.characters) {
        const data = {
          projectId,
          name: ch.name,
          description: ch.description ?? null,
          importance: ch.importance ?? null,
          sceneId: ch.sceneId ?? null,
        };
        if (ch.id) {
          await tx.breakdownCharacter.updateMany({
            where: { id: ch.id, projectId },
            data,
          });
        } else {
          await tx.breakdownCharacter.create({ data });
        }
      }
    }

    if (body.props) {
      for (const p of body.props) {
        const data = {
          projectId,
          name: p.name,
          description: p.description ?? null,
          special: p.special ?? false,
          sceneId: p.sceneId ?? null,
        };
        if (p.id) {
          await tx.breakdownProp.updateMany({
            where: { id: p.id, projectId },
            data,
          });
        } else {
          await tx.breakdownProp.create({ data });
        }
      }
    }

    if (body.locations) {
      for (const l of body.locations) {
        const data = {
          projectId,
          name: l.name,
          description: l.description ?? null,
          sceneId: l.sceneId ?? null,
          locationListingId: l.locationListingId ?? null,
        };
        if (l.id) {
          await tx.breakdownLocation.updateMany({
            where: { id: l.id, projectId },
            data,
          });
        } else {
          await tx.breakdownLocation.create({ data });
        }
      }
    }

    if (body.wardrobe) {
      for (const w of body.wardrobe) {
        const data = {
          projectId,
          description: w.description,
          character: w.character ?? null,
          sceneId: w.sceneId ?? null,
        };
        if (w.id) {
          await tx.breakdownWardrobe.updateMany({
            where: { id: w.id, projectId },
            data,
          });
        } else {
          await tx.breakdownWardrobe.create({ data });
        }
      }
    }

    if (body.extras) {
      for (const e of body.extras) {
        const data = {
          projectId,
          description: e.description,
          quantity: e.quantity ?? 1,
          sceneId: e.sceneId ?? null,
        };
        if (e.id) {
          await tx.breakdownExtra.updateMany({
            where: { id: e.id, projectId },
            data,
          });
        } else {
          await tx.breakdownExtra.create({ data });
        }
      }
    }

    if (body.vehicles) {
      for (const v of body.vehicles) {
        const data = {
          projectId,
          description: v.description,
          stuntRelated: v.stuntRelated ?? false,
          sceneId: v.sceneId ?? null,
        };
        if (v.id) {
          await tx.breakdownVehicle.updateMany({
            where: { id: v.id, projectId },
            data,
          });
        } else {
          await tx.breakdownVehicle.create({ data });
        }
      }
    }

    if (body.stunts) {
      for (const s of body.stunts) {
        const data = {
          projectId,
          description: s.description,
          safetyNotes: s.safetyNotes ?? null,
          sceneId: s.sceneId ?? null,
        };
        if (s.id) {
          await tx.breakdownStunt.updateMany({
            where: { id: s.id, projectId },
            data,
          });
        } else {
          await tx.breakdownStunt.create({ data });
        }
      }
    }

    if (body.sfx) {
      for (const fx of body.sfx) {
        const data = {
          projectId,
          description: fx.description,
          practical: fx.practical ?? false,
          sceneId: fx.sceneId ?? null,
        };
        if (fx.id) {
          await tx.breakdownSfx.updateMany({
            where: { id: fx.id, projectId },
            data,
          });
        } else {
          await tx.breakdownSfx.create({ data });
        }
      }
    }

    if (body.makeups) {
      await patchBreakdownMakeups(tx, projectId, body.makeups);
    }
  }, { timeout: 60000, maxWait: 10000 });

  const [characters, props, locations, wardrobe, extras, vehicles, stunts, sfx] = await Promise.all([
    prisma.breakdownCharacter.findMany({ where: { projectId } }),
    prisma.breakdownProp.findMany({ where: { projectId } }),
    prisma.breakdownLocation.findMany({ where: { projectId } }),
    prisma.breakdownWardrobe.findMany({ where: { projectId } }),
    prisma.breakdownExtra.findMany({ where: { projectId } }),
    prisma.breakdownVehicle.findMany({ where: { projectId } }),
    prisma.breakdownStunt.findMany({ where: { projectId } }),
    prisma.breakdownSfx.findMany({ where: { projectId } }),
  ]);
  const makeups = await findBreakdownMakeupsForProject(prisma, projectId);

  return NextResponse.json({
    projectId,
    characters,
    props,
    locations,
    wardrobe,
    extras,
    vehicles,
    stunts,
    sfx,
    makeups,
  });
}


