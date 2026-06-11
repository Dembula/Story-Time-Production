import "server-only";

import { prisma } from "@/lib/prisma";
import {
  CONTRACT_STATUS,
  getTemplateByType,
  type ContractTemplateType,
} from "@/lib/contract-template-engine";
import {
  buildRenderedContract,
  emptyFieldValues,
  mergeFieldValues,
  projectFieldValues,
  resourceFieldValues,
} from "@/lib/contract-prefill";
import {
  buildContractResourceContext,
  findResourceInContext,
} from "@/lib/contract-resource-context";
import { patchBreakdownMakeups } from "@/lib/breakdown-makeup-db";
import type { ModocActionPayload, ModocActionType } from "./action-types";
import type { ModocActionResult } from "./actions";
import {
  breakdownSuggestionsToPatchBody,
  countBreakdownPatchItems,
  parseBreakdownSuggestions,
  type BreakdownPatchBody,
} from "./parse-breakdown-suggestions";
import { resolveVaProjectId } from "./va-scheduling";
import { ensureProjectAccess } from "@/lib/project-access";

async function projectCtx(
  userId: string,
  payload: ModocActionPayload,
): Promise<{ projectId: string; userId: string } | ModocActionResult> {
  const projectId = await resolveVaProjectId(userId, payload.projectId);
  if (!projectId) {
    return { ok: false, error: "projectId is required", status: 400 };
  }
  const access = await ensureProjectAccess(projectId);
  if (access.error) return { ok: false, error: "Project access denied", status: 403 };
  return { projectId, userId };
}

async function applyBreakdownPatch(projectId: string, body: BreakdownPatchBody): Promise<number> {
  let added = 0;
  await prisma.$transaction(async (tx) => {
    if (body.characters) {
      for (const ch of body.characters) {
        await tx.breakdownCharacter.create({
          data: {
            projectId,
            name: ch.name,
            description: ch.description ?? null,
            importance: ch.importance ?? null,
            sceneId: ch.sceneId ?? null,
          },
        });
        added++;
      }
    }
    if (body.props) {
      for (const p of body.props) {
        await tx.breakdownProp.create({
          data: {
            projectId,
            name: p.name,
            description: p.description ?? null,
            sceneId: p.sceneId ?? null,
          },
        });
        added++;
      }
    }
    if (body.locations) {
      for (const l of body.locations) {
        await tx.breakdownLocation.create({
          data: {
            projectId,
            name: l.name,
            description: l.description ?? null,
            sceneId: l.sceneId ?? null,
          },
        });
        added++;
      }
    }
    if (body.wardrobe) {
      for (const w of body.wardrobe) {
        await tx.breakdownWardrobe.create({
          data: {
            projectId,
            description: w.description,
            character: w.character ?? null,
            sceneId: w.sceneId ?? null,
          },
        });
        added++;
      }
    }
    if (body.extras) {
      for (const e of body.extras) {
        await tx.breakdownExtra.create({
          data: {
            projectId,
            description: e.description,
            quantity: e.quantity ?? 1,
            sceneId: e.sceneId ?? null,
          },
        });
        added++;
      }
    }
    if (body.vehicles) {
      for (const v of body.vehicles) {
        await tx.breakdownVehicle.create({
          data: {
            projectId,
            description: v.description,
            stuntRelated: v.stuntRelated ?? false,
            sceneId: v.sceneId ?? null,
          },
        });
        added++;
      }
    }
    if (body.stunts) {
      for (const s of body.stunts) {
        await tx.breakdownStunt.create({
          data: {
            projectId,
            description: s.description,
            safetyNotes: s.safetyNotes ?? null,
            sceneId: s.sceneId ?? null,
          },
        });
        added++;
      }
    }
    if (body.sfx) {
      for (const s of body.sfx) {
        await tx.breakdownSfx.create({
          data: {
            projectId,
            description: s.description,
            practical: s.practical ?? false,
            sceneId: s.sceneId ?? null,
          },
        });
        added++;
      }
    }
    if (body.makeups?.length) {
      await patchBreakdownMakeups(
        tx,
        projectId,
        body.makeups.map((m) => ({
          notes: m.notes,
          character: m.character ?? null,
          sceneId: m.sceneId ?? null,
        })),
      );
      added += body.makeups.length;
    }
  });
  return added;
}

export async function executeVaLegalPostAction(
  userId: string,
  action: ModocActionType,
  payload: ModocActionPayload,
): Promise<ModocActionResult | null> {
  switch (action) {
    case "incorporate_breakdown_items": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const text = payload.notes ?? payload.content ?? payload.description ?? "";
      const suggestions = parseBreakdownSuggestions(text);
      if (suggestions.length === 0) {
        return { ok: false, error: "No CHARACTER/PROP/LOCATION lines found to incorporate", status: 400 };
      }
      const patchBody = breakdownSuggestionsToPatchBody(suggestions, payload.sceneId ?? null);
      const count = countBreakdownPatchItems(patchBody);
      await applyBreakdownPatch(ctx.projectId, patchBody);
      return {
        ok: true,
        message: `Added ${count} breakdown item${count === 1 ? "" : "s"}.`,
        data: { projectId: ctx.projectId, count },
      };
    }

    case "create_contract": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const templateType = (payload.template ?? payload.category) as ContractTemplateType | undefined;
      if (!templateType) {
        return { ok: false, error: "template or templateType required (e.g. ACTOR_AGREEMENT)", status: 400 };
      }
      const template = getTemplateByType(templateType);
      const resourceContext = await buildContractResourceContext(ctx.projectId, ctx.userId);
      if (!resourceContext) {
        return { ok: false, error: "Project not found", status: 404 };
      }
      const resourceType = (payload.resourceType ?? "GENERAL") as
        | "ACTOR"
        | "CREW"
        | "LOCATION"
        | "EQUIPMENT"
        | "CATERING"
        | "FUNDING"
        | "GENERAL";
      const selectedResource = findResourceInContext(resourceContext, resourceType, payload.resourceId ?? null);
      const mergedFields = mergeFieldValues(
        emptyFieldValues(),
        projectFieldValues(resourceContext.project),
        selectedResource ? resourceFieldValues(selectedResource) : {},
        {
          role: payload.role ?? undefined,
          rate: payload.amount !== undefined ? String(payload.amount) : undefined,
          party_name: payload.vendor ?? undefined,
        },
      );
      const terms =
        payload.content?.trim() ||
        buildRenderedContract(templateType, mergedFields, template.body);
      const sendNow = payload.mode === "send" || payload.status?.toUpperCase() === "SENT";
      const contract = await prisma.projectContract.create({
        data: {
          projectId: ctx.projectId,
          type: template.type,
          status: sendNow ? CONTRACT_STATUS.SENT : CONTRACT_STATUS.DRAFT,
          subject:
            payload.title?.trim() ??
            `${template.label}${selectedResource?.partyName ? ` · ${selectedResource.partyName}` : ""}`,
          castingTalentId: selectedResource?.castingTalentId ?? null,
          crewTeamId: selectedResource?.crewTeamId ?? null,
          locationListingId: selectedResource?.locationListingId ?? null,
          vendorName: payload.vendor ?? selectedResource?.vendorName ?? null,
          createdById: ctx.userId,
        },
      });
      const version = await prisma.projectContractVersion.create({
        data: {
          contractId: contract.id,
          version: 1,
          terms,
          createdById: ctx.userId,
        },
      });
      await prisma.projectContract.update({
        where: { id: contract.id },
        data: { currentVersionId: version.id },
      });
      return {
        ok: true,
        message: sendNow
          ? `Contract "${contract.subject}" created and sent.`
          : `Draft contract "${contract.subject}" created.`,
        data: { contractId: contract.id, projectId: ctx.projectId },
      };
    }

    case "send_contract": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const contractId = payload.contractId ?? payload.taskId;
      if (!contractId) return { ok: false, error: "contractId required", status: 400 };
      const result = await prisma.projectContract.updateMany({
        where: { id: contractId, projectId: ctx.projectId, status: CONTRACT_STATUS.DRAFT },
        data: { status: CONTRACT_STATUS.SENT },
      });
      if (result.count === 0) {
        return { ok: false, error: "Draft contract not found", status: 404 };
      }
      return { ok: true, message: "Contract sent for signature.", data: { contractId } };
    }

    case "update_contract": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const contractId = payload.contractId ?? payload.taskId;
      if (!contractId) return { ok: false, error: "contractId required", status: 400 };
      const existing = await prisma.projectContract.findFirst({
        where: { id: contractId, projectId: ctx.projectId },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      });
      if (!existing) return { ok: false, error: "Contract not found", status: 404 };

      if (payload.title !== undefined) {
        await prisma.projectContract.update({
          where: { id: contractId },
          data: { subject: payload.title.trim() || existing.subject },
        });
      }
      if (payload.status !== undefined) {
        await prisma.projectContract.update({
          where: { id: contractId },
          data: { status: payload.status.trim() },
        });
      }
      const terms = payload.content ?? payload.notes;
      if (terms !== undefined) {
        const nextVersion = (existing.versions[0]?.version ?? 0) + 1;
        const version = await prisma.projectContractVersion.create({
          data: {
            contractId,
            version: nextVersion,
            terms,
            changeNotes: payload.description ?? null,
            createdById: ctx.userId,
          },
        });
        await prisma.projectContract.update({
          where: { id: contractId },
          data: { currentVersionId: version.id, status: CONTRACT_STATUS.DRAFT },
        });
      }
      return { ok: true, message: "Contract updated.", data: { contractId } };
    }

    case "delete_contract": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const contractId = payload.contractId ?? payload.taskId;
      if (!contractId) return { ok: false, error: "contractId required", status: 400 };
      const result = await prisma.projectContract.deleteMany({
        where: { id: contractId, projectId: ctx.projectId },
      });
      if (result.count === 0) return { ok: false, error: "Contract not found", status: 404 };
      return { ok: true, message: "Contract deleted.", data: { contractId } };
    }

    case "create_post_review": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const review = await prisma.postProductionReview.create({
        data: {
          projectId: ctx.projectId,
          cutAssetId: payload.cutAssetId ?? null,
        },
      });
      return {
        ok: true,
        message: "Post-production review session created.",
        data: { reviewId: review.id, projectId: ctx.projectId },
      };
    }

    case "add_post_review_note": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const reviewId = payload.reviewId ?? payload.taskId;
      const body = payload.notes ?? payload.content ?? payload.description;
      if (!reviewId || !body?.trim()) {
        return { ok: false, error: "reviewId and notes required", status: 400 };
      }
      const review = await prisma.postProductionReview.findFirst({
        where: { id: reviewId, projectId: ctx.projectId },
      });
      if (!review) return { ok: false, error: "Review not found", status: 404 };
      const note = await prisma.reviewNote.create({
        data: {
          reviewId,
          userId: ctx.userId,
          body: body.trim(),
        },
      });
      return {
        ok: true,
        message: "Review note added.",
        data: { noteId: note.id, reviewId },
      };
    }

    case "update_post_review": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const reviewId = payload.reviewId ?? payload.taskId;
      if (!reviewId) return { ok: false, error: "reviewId required", status: 400 };
      if (!payload.status?.trim()) {
        return { ok: false, error: "status required", status: 400 };
      }
      const result = await prisma.postProductionReview.updateMany({
        where: { id: reviewId, projectId: ctx.projectId },
        data: { status: payload.status.trim() },
      });
      if (result.count === 0) return { ok: false, error: "Review not found", status: 404 };
      return { ok: true, message: `Review marked ${payload.status}.`, data: { reviewId } };
    }

    case "delete_post_review": {
      const ctx = await projectCtx(userId, payload);
      if ("ok" in ctx) return ctx;
      const reviewId = payload.reviewId ?? payload.taskId;
      if (!reviewId) return { ok: false, error: "reviewId required", status: 400 };
      const result = await prisma.postProductionReview.deleteMany({
        where: { id: reviewId, projectId: ctx.projectId },
      });
      if (result.count === 0) return { ok: false, error: "Review not found", status: 404 };
      return { ok: true, message: "Review session deleted.", data: { reviewId } };
    }

    default:
      return null;
  }
}
