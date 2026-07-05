import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { prisma } from "@/lib/prisma";
import { modelsForTask, primaryModocModel } from "@/lib/modoc/model-router";
import {
  AI_SCRIPT_BREAKDOWN_SYSTEM,
  buildAiScriptBreakdownUserPrompt,
  coerceAiBreakdown,
  extractJsonObjectFromAiText,
  normalizeAiBreakdown,
} from "@/lib/ai-script-breakdown";
import { deleteBreakdownMakeupsForProject, patchBreakdownMakeups } from "@/lib/breakdown-makeup-db";
import { syncCastingRolesFromBreakdown, type CastingSyncResult } from "@/lib/casting-sync";

const openRouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  baseURL: "https://openrouter.ai/api/v1",
});

const BREAKDOWN_MODELS = modelsForTask("extraction");
const SCRIPT_CHAR_LIMIT = 120_000;

export type BreakdownMode = "full" | "scenes";

export async function loadProjectScreenplay(
  projectId: string,
): Promise<{ title: string; content: string } | null> {
  const script = await prisma.projectScript.findFirst({
    where: { projectId },
    include: {
      versions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!script) return null;
  let content = "";
  if (script.currentVersionId) {
    const v = await prisma.projectScriptVersion.findUnique({
      where: { id: script.currentVersionId },
    });
    content = v?.content ?? "";
  }
  if (!content && script.versions[0]) {
    content = script.versions[0].content ?? "";
  }
  if (!content.trim()) return null;
  const title = script.title || "Screenplay";
  const truncated =
    content.length > SCRIPT_CHAR_LIMIT
      ? `${content.slice(0, SCRIPT_CHAR_LIMIT)}\n\n[TRUNCATED — only first ${SCRIPT_CHAR_LIMIT} characters were sent to the model]`
      : content;
  return { title, content: truncated };
}

export async function executeScriptBreakdown(
  projectId: string,
  mode: BreakdownMode = "full",
): Promise<
  | { ok: true; warnings: string[]; castingSync: CastingSyncResult | null }
  | { ok: false; error: string; status?: number }
> {
  if (!process.env.OPENROUTER_API_KEY) {
    return { ok: false, error: "AI is not configured. Set OPENROUTER_API_KEY.", status: 503 };
  }

  const screenplay = await loadProjectScreenplay(projectId);
  if (!screenplay) {
    return {
      ok: false,
      error: "No project screenplay with text found. Save a draft in Script Writing first.",
      status: 400,
    };
  }

  let rawText: string | undefined;
  let lastError: unknown;
  const models = BREAKDOWN_MODELS.length > 0 ? BREAKDOWN_MODELS : [primaryModocModel("extraction")];
  for (const modelId of models) {
    try {
      const { text } = await generateText({
        model: openRouter.chat(modelId),
        maxOutputTokens: 16_000,
        temperature: 0.2,
        messages: [
          { role: "system", content: AI_SCRIPT_BREAKDOWN_SYSTEM },
          {
            role: "user",
            content: buildAiScriptBreakdownUserPrompt(screenplay.title, screenplay.content),
          },
        ],
      });
      rawText = text;
      break;
    } catch (e) {
      lastError = e;
      if (process.env.NODE_ENV === "development") {
        console.warn(`MODOC breakdown model ${modelId} failed, trying fallback…`, e);
      }
    }
  }
  if (!rawText) {
    const msg = lastError instanceof Error ? lastError.message : "All breakdown models failed";
    return { ok: false, error: msg, status: 502 };
  }

  let parsed: ReturnType<typeof normalizeAiBreakdown>;
  try {
    const json = extractJsonObjectFromAiText(rawText);
    parsed = normalizeAiBreakdown(coerceAiBreakdown(json));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid JSON from model";
    return { ok: false, error: `Could not parse AI response: ${msg}`, status: 422 };
  }

  const warnings: string[] = [];

  await prisma.$transaction(async (tx) => {
    const scenes = await tx.projectScene.findMany({
      where: { projectId },
      select: { id: true, number: true },
    });
    const byNumber = new Map(scenes.map((s) => [s.number.trim(), s.id]));

    for (const s of parsed.scenes ?? []) {
      const id = byNumber.get(s.sceneNumber.trim());
      if (!id) {
        warnings.push(`Scene number ${s.sceneNumber} from AI has no matching project scene — sync scenes first.`);
        continue;
      }
      await tx.projectScene.update({
        where: { id },
        data: {
          summary: s.summary,
          storyDay: s.storyDay,
          intExt: s.intExt,
          timeOfDay: s.timeOfDay,
          breakdownAnalysis: s.sceneAnalysis ?? undefined,
        } as Record<string, unknown>,
      });
    }

    if (mode === "scenes") return;

    await tx.breakdownCharacter.deleteMany({ where: { projectId } });
    await tx.breakdownProp.deleteMany({ where: { projectId } });
    await tx.breakdownLocation.deleteMany({ where: { projectId } });
    await tx.breakdownWardrobe.deleteMany({ where: { projectId } });
    await tx.breakdownExtra.deleteMany({ where: { projectId } });
    await tx.breakdownVehicle.deleteMany({ where: { projectId } });
    await tx.breakdownStunt.deleteMany({ where: { projectId } });
    await tx.breakdownSfx.deleteMany({ where: { projectId } });
    await deleteBreakdownMakeupsForProject(tx, projectId);

    const resolve = (nums: string[] | undefined): string[] => {
      const ids: string[] = [];
      for (const n of nums ?? []) {
        const id = byNumber.get(String(n).trim());
        if (id) ids.push(id);
        else warnings.push(`Unknown scene number "${n}" in AI output — skipped that link.`);
      }
      return ids;
    };

    // One identity per character name; one row per scene they appear in (for scene views).
    const characterIdentity = new Map<
      string,
      { displayName: string; importance: string | null }
    >();
    for (const c of parsed.characters ?? []) {
      const displayName = (c.name ?? "").replace(/\s+/g, " ").trim();
      const key = displayName.toLowerCase();
      if (!key) continue;
      const prev = characterIdentity.get(key);
      if (!prev) {
        characterIdentity.set(key, {
          displayName,
          importance: c.importance ?? null,
        });
      } else if (!prev.importance && c.importance) {
        prev.importance = c.importance;
      }
    }
    const writtenCharacterScenes = new Set<string>();
    for (const c of parsed.characters ?? []) {
      const displayName = (c.name ?? "").replace(/\s+/g, " ").trim();
      const key = displayName.toLowerCase();
      if (!key) continue;
      const identity = characterIdentity.get(key)!;
      for (const sid of resolve(c.sceneNumbers)) {
        const sceneKey = `${key}::${sid}`;
        if (writtenCharacterScenes.has(sceneKey)) continue;
        writtenCharacterScenes.add(sceneKey);
        await tx.breakdownCharacter.create({
          data: {
            projectId,
            name: identity.displayName,
            sceneId: sid,
            description: null,
            importance: identity.importance,
          },
        });
      }
    }

    for (const p of parsed.props ?? []) {
      for (const sid of resolve(p.sceneNumbers)) {
        await tx.breakdownProp.create({
          data: {
            projectId,
            name: p.name,
            description: p.description || null,
            special: p.special,
            sceneId: sid,
          },
        });
      }
    }

    for (const l of parsed.locations ?? []) {
      for (const sid of resolve(l.sceneNumbers)) {
        await tx.breakdownLocation.create({
          data: {
            projectId,
            name: l.name,
            description: l.description || null,
            sceneId: sid,
            locationListingId: null,
          },
        });
      }
    }

    for (const w of parsed.wardrobe ?? []) {
      for (const sid of resolve(w.sceneNumbers)) {
        await tx.breakdownWardrobe.create({
          data: {
            projectId,
            description: w.description,
            character: w.character ?? null,
            sceneId: sid,
          },
        });
      }
    }

    for (const e of parsed.extras ?? []) {
      for (const sid of resolve(e.sceneNumbers)) {
        await tx.breakdownExtra.create({
          data: {
            projectId,
            description: e.description,
            quantity: e.quantity,
            sceneId: sid,
          },
        });
      }
    }

    for (const v of parsed.vehicles ?? []) {
      for (const sid of resolve(v.sceneNumbers)) {
        await tx.breakdownVehicle.create({
          data: {
            projectId,
            description: v.description,
            stuntRelated: v.stuntRelated,
            sceneId: sid,
          },
        });
      }
    }

    for (const s of parsed.stunts ?? []) {
      for (const sid of resolve(s.sceneNumbers)) {
        await tx.breakdownStunt.create({
          data: {
            projectId,
            description: s.description,
            safetyNotes: s.safetyNotes ?? null,
            sceneId: sid,
          },
        });
      }
    }

    for (const fx of parsed.sfx ?? []) {
      for (const sid of resolve(fx.sceneNumbers)) {
        await tx.breakdownSfx.create({
          data: {
            projectId,
            description: fx.description,
            practical: fx.practical,
            sceneId: sid,
          },
        });
      }
    }

    const makeupRows: { notes: string; character?: string | null; sceneId?: string | null }[] = [];
    for (const m of parsed.makeups ?? []) {
      for (const sid of resolve(m.sceneNumbers)) {
        makeupRows.push({ notes: m.notes, character: m.character ?? null, sceneId: sid });
      }
    }
    if (makeupRows.length > 0) {
      await patchBreakdownMakeups(tx, projectId, makeupRows);
    }
  });

  // Full breakdown wipes BreakdownCharacter rows, which SetNulls casting role
  // links. Re-sync so cast keeps flowing to schedule / call sheets.
  let castingSync: CastingSyncResult | null = null;
  if (mode === "full") {
    try {
      castingSync = await syncCastingRolesFromBreakdown(projectId);
    } catch (e) {
      warnings.push(
        `Breakdown succeeded but casting sync failed: ${
          e instanceof Error ? e.message : "unknown error"
        }. Run "Sync from Script Breakdown" in Casting.`,
      );
    }
  }

  return { ok: true, warnings, castingSync };
}
