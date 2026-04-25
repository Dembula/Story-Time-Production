import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { ensureProjectAccess } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import {
  AI_SCRIPT_BREAKDOWN_SYSTEM,
  buildAiScriptBreakdownUserPrompt,
  coerceAiBreakdown,
  extractJsonObjectFromAiText,
  normalizeAiBreakdown,
} from "@/lib/ai-script-breakdown";
import { deleteBreakdownMakeupsForProject, patchBreakdownMakeups } from "@/lib/breakdown-makeup-db";

export const maxDuration = 120;

const openRouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  baseURL: "https://openrouter.ai/api/v1",
  compatibility: "compatible",
});

const MODOC_MODEL = process.env.OPENROUTER_MODOC_MODEL ?? "openai/gpt-4o-mini";
const SCRIPT_CHAR_LIMIT = 120_000;

async function loadProjectScreenplay(projectId: string): Promise<{ title: string; content: string } | null> {
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

export async function POST(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "AI is not configured. Set OPENROUTER_API_KEY in the environment." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as { mode?: "full" | "scenes" } | null;
  const mode = body?.mode === "scenes" ? "scenes" : "full";

  const screenplay = await loadProjectScreenplay(projectId);
  if (!screenplay) {
    return NextResponse.json(
      { error: "No project screenplay with text found. Save a draft in Script Writing first." },
      { status: 400 },
    );
  }

  let rawText: string;
  try {
    const model = openRouter(MODOC_MODEL);
    const { text } = await generateText({
      model,
      maxTokens: 16_000,
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Model request failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  let parsed: ReturnType<typeof normalizeAiBreakdown>;
  try {
    const json = extractJsonObjectFromAiText(rawText);
    parsed = normalizeAiBreakdown(coerceAiBreakdown(json));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid JSON from model";
    return NextResponse.json(
      { error: `Could not parse AI response: ${msg}`, rawExcerpt: rawText.slice(0, 2000) },
      { status: 422 },
    );
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
        } as any,
      });
    }

    if (mode === "scenes") {
      return;
    }

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

    for (const c of parsed.characters ?? []) {
      for (const sid of resolve(c.sceneNumbers)) {
        await tx.breakdownCharacter.create({
          data: { projectId, name: c.name, sceneId: sid, description: null, importance: null },
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

  return NextResponse.json({
    ok: true,
    mode,
    warnings,
  });
}
