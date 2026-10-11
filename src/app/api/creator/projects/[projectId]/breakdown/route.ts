import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findBreakdownMakeupsForProject, patchBreakdownMakeups } from "@/lib/breakdown-makeup-db";
import { consolidateCharacterRows } from "@/lib/breakdown/character-identity";
import { syncCastingRolesFromBreakdown } from "@/lib/casting-sync";

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
    // One identity per name; still one row per scene appearance for scene views.
    characters: consolidateCharacterRows(characters),
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
      const consolidated = consolidateCharacterRows(body.characters);
      const keepIds: string[] = [];

      for (const ch of consolidated) {
        const name = (ch.name ?? "").replace(/\s+/g, " ").trim();
        if (!name) continue;
        const data = {
          projectId,
          name,
          description: ch.description ?? null,
          importance: ch.importance ?? null,
          sceneId: ch.sceneId ?? null,
        };

        if (ch.id) {
          const updated = await tx.breakdownCharacter.updateMany({
            where: { id: ch.id, projectId },
            data,
          });
          if (updated.count > 0) {
            keepIds.push(ch.id);
            continue;
          }
        }

        const existing = await tx.breakdownCharacter.findFirst({
          where: {
            projectId,
            sceneId: ch.sceneId ?? null,
            name: { equals: name, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (existing) {
          await tx.breakdownCharacter.update({
            where: { id: existing.id },
            data,
          });
          keepIds.push(existing.id);
        } else {
          const created = await tx.breakdownCharacter.create({ data });
          keepIds.push(created.id);
        }
      }

      // Drop orphaned clones (same person written once per scene incorrectly, or removed rows).
      await tx.breakdownCharacter.deleteMany({
        where: {
          projectId,
          ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}),
        },
      });
    }

    if (body.props) {
      const keepIds: string[] = [];
      for (const p of body.props) {
        const name = (p.name ?? "").replace(/\s+/g, " ").trim();
        if (!name) continue;
        const data = {
          projectId,
          name,
          description: p.description ?? null,
          special: p.special ?? false,
          sceneId: p.sceneId ?? null,
        };
        if (p.id) {
          const updated = await tx.breakdownProp.updateMany({
            where: { id: p.id, projectId },
            data,
          });
          if (updated.count > 0) {
            keepIds.push(p.id);
            continue;
          }
        }
        const created = await tx.breakdownProp.create({ data });
        keepIds.push(created.id);
      }
      await tx.breakdownProp.deleteMany({
        where: {
          projectId,
          ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}),
        },
      });
    }

    if (body.locations) {
      const keepIds: string[] = [];
      for (const l of body.locations) {
        const name = (l.name ?? "").replace(/\s+/g, " ").trim();
        if (!name) continue;
        const data = {
          projectId,
          name,
          description: l.description ?? null,
          sceneId: l.sceneId ?? null,
          locationListingId: l.locationListingId ?? null,
        };
        if (l.id) {
          const updated = await tx.breakdownLocation.updateMany({
            where: { id: l.id, projectId },
            data,
          });
          if (updated.count > 0) {
            keepIds.push(l.id);
            continue;
          }
        }
        const created = await tx.breakdownLocation.create({ data });
        keepIds.push(created.id);
      }
      await tx.breakdownLocation.deleteMany({
        where: {
          projectId,
          ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}),
        },
      });
    }

    if (body.wardrobe) {
      const keepIds: string[] = [];
      for (const w of body.wardrobe) {
        const description = (w.description ?? "").replace(/\s+/g, " ").trim();
        if (!description) continue;
        const data = {
          projectId,
          description,
          character: w.character ?? null,
          sceneId: w.sceneId ?? null,
        };
        if (w.id) {
          const updated = await tx.breakdownWardrobe.updateMany({
            where: { id: w.id, projectId },
            data,
          });
          if (updated.count > 0) {
            keepIds.push(w.id);
            continue;
          }
        }
        const created = await tx.breakdownWardrobe.create({ data });
        keepIds.push(created.id);
      }
      await tx.breakdownWardrobe.deleteMany({
        where: {
          projectId,
          ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}),
        },
      });
    }

    if (body.extras) {
      const keepIds: string[] = [];
      for (const e of body.extras) {
        const description = (e.description ?? "").replace(/\s+/g, " ").trim();
        if (!description) continue;
        const data = {
          projectId,
          description,
          quantity: e.quantity ?? 1,
          sceneId: e.sceneId ?? null,
        };
        if (e.id) {
          const updated = await tx.breakdownExtra.updateMany({
            where: { id: e.id, projectId },
            data,
          });
          if (updated.count > 0) {
            keepIds.push(e.id);
            continue;
          }
        }
        const created = await tx.breakdownExtra.create({ data });
        keepIds.push(created.id);
      }
      await tx.breakdownExtra.deleteMany({
        where: {
          projectId,
          ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}),
        },
      });
    }

    if (body.vehicles) {
      const keepIds: string[] = [];
      for (const v of body.vehicles) {
        const description = (v.description ?? "").replace(/\s+/g, " ").trim();
        if (!description) continue;
        const data = {
          projectId,
          description,
          stuntRelated: v.stuntRelated ?? false,
          sceneId: v.sceneId ?? null,
        };
        if (v.id) {
          const updated = await tx.breakdownVehicle.updateMany({
            where: { id: v.id, projectId },
            data,
          });
          if (updated.count > 0) {
            keepIds.push(v.id);
            continue;
          }
        }
        const created = await tx.breakdownVehicle.create({ data });
        keepIds.push(created.id);
      }
      await tx.breakdownVehicle.deleteMany({
        where: {
          projectId,
          ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}),
        },
      });
    }

    if (body.stunts) {
      const keepIds: string[] = [];
      for (const s of body.stunts) {
        const description = (s.description ?? "").replace(/\s+/g, " ").trim();
        if (!description) continue;
        const data = {
          projectId,
          description,
          safetyNotes: s.safetyNotes ?? null,
          sceneId: s.sceneId ?? null,
        };
        if (s.id) {
          const updated = await tx.breakdownStunt.updateMany({
            where: { id: s.id, projectId },
            data,
          });
          if (updated.count > 0) {
            keepIds.push(s.id);
            continue;
          }
        }
        const created = await tx.breakdownStunt.create({ data });
        keepIds.push(created.id);
      }
      await tx.breakdownStunt.deleteMany({
        where: {
          projectId,
          ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}),
        },
      });
    }

    if (body.sfx) {
      const keepIds: string[] = [];
      for (const fx of body.sfx) {
        const description = (fx.description ?? "").replace(/\s+/g, " ").trim();
        if (!description) continue;
        const data = {
          projectId,
          description,
          practical: fx.practical ?? false,
          sceneId: fx.sceneId ?? null,
        };
        if (fx.id) {
          const updated = await tx.breakdownSfx.updateMany({
            where: { id: fx.id, projectId },
            data,
          });
          if (updated.count > 0) {
            keepIds.push(fx.id);
            continue;
          }
        }
        const created = await tx.breakdownSfx.create({ data });
        keepIds.push(created.id);
      }
      await tx.breakdownSfx.deleteMany({
        where: {
          projectId,
          ...(keepIds.length > 0 ? { id: { notIn: keepIds } } : {}),
        },
      });
    }

    if (body.makeups) {
      await patchBreakdownMakeups(tx, projectId, body.makeups, { replaceAll: true });
    }
  }, { timeout: 60000, maxWait: 10000 });

  if (body.characters) {
    // One casting role per character identity (not per scene appearance).
    await syncCastingRolesFromBreakdown(projectId).catch(() => null);
  }

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
    characters: consolidateCharacterRows(characters),
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


