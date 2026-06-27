import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import type { InputJsonValue } from "@/lib/prisma-json";
import type { KnowledgeEntityType, KnowledgeRelation } from "./types";

export async function upsertKnowledgeEdge(input: {
  fromType: KnowledgeEntityType;
  fromId: string;
  toType: KnowledgeEntityType;
  toId: string;
  relation: KnowledgeRelation | string;
  label?: string | null;
  weight?: number;
  contentId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  await prisma.knowledgeEdge.upsert({
    where: {
      fromType_fromId_relation_toType_toId: {
        fromType: input.fromType,
        fromId: input.fromId,
        relation: input.relation,
        toType: input.toType,
        toId: input.toId,
      },
    },
    create: {
      id: randomUUID(),
      fromType: input.fromType,
      fromId: input.fromId,
      toType: input.toType,
      toId: input.toId,
      relation: input.relation,
      label: input.label ?? null,
      weight: input.weight ?? 1,
      contentId: input.contentId ?? null,
      metadata: (input.metadata ?? undefined) as InputJsonValue | undefined,
    },
    update: {
      label: input.label ?? null,
      weight: input.weight ?? 1,
      contentId: input.contentId ?? null,
      metadata: (input.metadata ?? undefined) as InputJsonValue | undefined,
      updatedAt: new Date(),
    },
  });
}

export async function deleteContentGraphEdges(contentId: string): Promise<void> {
  await prisma.knowledgeEdge.deleteMany({
    where: {
      OR: [{ contentId }, { fromType: "content", fromId: contentId }],
    },
  });
}
