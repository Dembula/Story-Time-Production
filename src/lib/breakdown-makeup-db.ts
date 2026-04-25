import { randomBytes } from "crypto";

export type BreakdownMakeupRow = {
  id: string;
  projectId: string;
  sceneId: string | null;
  notes: string;
  character: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MakeupDelegate = {
  findMany: (args: { where: { projectId: string } }) => Promise<BreakdownMakeupRow[]>;
  create: (args: {
    data: {
      projectId: string;
      notes: string;
      character: string | null;
      sceneId: string | null;
    };
  }) => Promise<unknown>;
  updateMany: (args: {
    where: { id: string; projectId: string };
    data: { notes: string; character: string | null; sceneId: string | null };
  }) => Promise<unknown>;
  deleteMany?: (args: { where: { projectId: string } }) => Promise<unknown>;
};

type DbLike = {
  $queryRaw: <T>(strings: TemplateStringsArray, ...values: unknown[]) => Promise<T>;
  $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<number>;
  breakdownMakeup?: MakeupDelegate;
};

function getMakeupDelegate(db: DbLike): MakeupDelegate | undefined {
  const d = db.breakdownMakeup;
  return typeof d?.findMany === "function" ? d : undefined;
}

/**
 * Load makeup rows. If Prisma Client is stale (no `breakdownMakeup` delegate after a schema change),
 * uses raw SQL so the app keeps working until `npx prisma generate` succeeds.
 */
export async function findBreakdownMakeupsForProject(db: DbLike, projectId: string): Promise<BreakdownMakeupRow[]> {
  const delegate = getMakeupDelegate(db);
  if (delegate) {
    return delegate.findMany({ where: { projectId } });
  }
  return db.$queryRaw<BreakdownMakeupRow[]>`
    SELECT id, "projectId", "sceneId", notes, "character", "createdAt", "updatedAt"
    FROM "BreakdownMakeup"
    WHERE "projectId" = ${projectId}
    ORDER BY "createdAt" ASC
  `;
}

function newMakeupId() {
  return randomBytes(16).toString("hex");
}

export async function deleteBreakdownMakeupsForProject(tx: DbLike, projectId: string) {
  const delegate = getMakeupDelegate(tx);
  if (delegate?.deleteMany) {
    await delegate.deleteMany({ where: { projectId } });
    return;
  }
  await tx.$executeRaw`
    DELETE FROM "BreakdownMakeup" WHERE "projectId" = ${projectId}
  `;
}

export async function patchBreakdownMakeups(
  tx: DbLike,
  projectId: string,
  makeups: { id?: string; notes: string; character?: string | null; sceneId?: string | null }[],
) {
  const delegate = getMakeupDelegate(tx);
  if (delegate) {
    for (const m of makeups) {
      const data = {
        notes: m.notes,
        character: m.character ?? null,
        sceneId: m.sceneId ?? null,
      };
      if (m.id) {
        await delegate.updateMany({
          where: { id: m.id, projectId },
          data,
        });
      } else {
        await delegate.create({
          data: {
            projectId,
            notes: m.notes,
            character: m.character ?? null,
            sceneId: m.sceneId ?? null,
          },
        });
      }
    }
    return;
  }

  for (const m of makeups) {
    if (m.id) {
      await tx.$executeRaw`
        UPDATE "BreakdownMakeup"
        SET
          notes = ${m.notes},
          "character" = ${m.character ?? null},
          "sceneId" = ${m.sceneId ?? null},
          "updatedAt" = NOW()
        WHERE id = ${m.id} AND "projectId" = ${projectId}
      `;
    } else {
      const id = newMakeupId();
      await tx.$executeRaw`
        INSERT INTO "BreakdownMakeup" (id, "projectId", "sceneId", notes, "character", "createdAt", "updatedAt")
        VALUES (${id}, ${projectId}, ${m.sceneId ?? null}, ${m.notes}, ${m.character ?? null}, NOW(), NOW())
      `;
    }
  }
}
