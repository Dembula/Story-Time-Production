import "server-only";

import {
  normalizeOpenRouterModelId,
  OPENROUTER_DEFAULT_MODELS,
  resolveModelChain,
  resolveWorkingModel,
} from "@/lib/modoc/openrouter-models";
import { stylePromptHint } from "@/lib/storyboard/style-presets";

export type PlannedShot = {
  sceneId?: string | null;
  sceneNumber: string;
  sceneHeading: string;
  shotLabel: string;
  prompt: string;
  directorNotes?: string;
};

type SceneInput = {
  id: string;
  number: string;
  heading: string | null;
  summary: string | null;
};

function planningModelChain(): string[] {
  return resolveModelChain(
    [
      process.env.OPENROUTER_STORYBOARD_PLAN_MODEL,
      process.env.OPENROUTER_MODOC_POWER_MODEL,
      process.env.OPENROUTER_MODOC_CREATIVE_MODEL,
      process.env.OPENROUTER_MODOC_MODEL,
    ],
    OPENROUTER_DEFAULT_MODELS.power,
  );
}

function extractJsonArray(text: string): unknown[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) throw new Error("Planner did not return a JSON array.");
  const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Planner JSON was not an array.");
  return parsed;
}

function fallbackShots(scenes: SceneInput[], stylePreset: string): PlannedShot[] {
  const style = stylePromptHint(stylePreset);
  return scenes.map((scene, index) => ({
    sceneId: scene.id,
    sceneNumber: scene.number,
    sceneHeading: scene.heading ?? `Scene ${scene.number}`,
    shotLabel: `Scene ${scene.number} · Master`,
    prompt: [
      `Storyboard frame for scene ${scene.number}: ${scene.heading ?? "Untitled"}.`,
      scene.summary ? `Action: ${scene.summary}` : null,
      style,
      "single clear storyboard panel, no text overlays, no watermarks",
    ]
      .filter(Boolean)
      .join(" "),
    directorNotes: `Coverage frame ${index + 1}`,
  }));
}

async function chatComplete(model: string, system: string, user: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured.");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL ?? "https://story-time.online",
      "X-Title": "Story Time Storyboard Planner",
    },
    body: JSON.stringify({
      model: normalizeOpenRouterModelId(model),
      temperature: 0.45,
      max_tokens: 8000,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  const json = (await res.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(json.error?.message || `Planner failed (${res.status}).`);
  }
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

/**
 * Astra-first shot planner: reads scenes (+ optional script excerpt) and returns
 * drawable storyboard prompts. Falls through the power model chain on failure.
 */
export async function planStoryboardShots(args: {
  title: string;
  stylePreset: string;
  aspectRatio: string;
  scenes: SceneInput[];
  scriptExcerpt?: string | null;
  globalNotes?: string | null;
  shotsPerScene?: number;
}): Promise<{ shots: PlannedShot[]; modelUsed: string }> {
  if (args.scenes.length === 0) {
    return { shots: [], modelUsed: "none" };
  }

  const shotsPerScene = Math.min(4, Math.max(1, args.shotsPerScene ?? 1));
  const style = stylePromptHint(args.stylePreset);
  const system = `You are a film storyboard director assisting Story Time creators.
Return ONLY a JSON array. Each item:
{
  "sceneId": string | null,
  "sceneNumber": string,
  "sceneHeading": string,
  "shotLabel": string,
  "prompt": string,
  "directorNotes": string
}
Rules:
- Create about ${shotsPerScene} shot(s) per scene (establishing / key action / emotional beat as needed).
- "prompt" must be a vivid English image-generation prompt for one storyboard panel (no dialogue bubbles, no UI chrome, no watermarks).
- Include framing, camera angle, lighting, and production design cues.
- Style base: ${style}
- Aspect ratio target: ${args.aspectRatio}
- Keep prompts self-contained so an image model can draw the frame without extra context.`;

  const user = JSON.stringify(
    {
      projectTitle: args.title,
      globalNotes: args.globalNotes ?? null,
      scriptExcerpt: (args.scriptExcerpt ?? "").slice(0, 12000) || null,
      scenes: args.scenes.map((s) => ({
        id: s.id,
        number: s.number,
        heading: s.heading,
        summary: s.summary,
      })),
    },
    null,
    2,
  );

  const chain = planningModelChain();
  const working = await resolveWorkingModel(chain);
  const models = working
    ? [working, ...chain.filter((m) => normalizeOpenRouterModelId(m) !== working)]
    : chain;

  let lastError: unknown;
  for (const model of models) {
    try {
      const text = await chatComplete(model, system, user);
      const rows = extractJsonArray(text);
      const shots: PlannedShot[] = rows.flatMap((row) => {
        const r = row as Record<string, unknown>;
        const sceneNumber = String(r.sceneNumber ?? "").trim();
        const prompt = String(r.prompt ?? "").trim();
        if (!sceneNumber || !prompt) return [];
        return [
          {
            sceneId: (r.sceneId as string | null | undefined) ?? null,
            sceneNumber,
            sceneHeading: String(r.sceneHeading ?? `Scene ${sceneNumber}`).trim(),
            shotLabel: String(r.shotLabel ?? `Scene ${sceneNumber}`).trim(),
            prompt,
            directorNotes: r.directorNotes ? String(r.directorNotes) : undefined,
          } satisfies PlannedShot,
        ];
      });

      if (shots.length === 0) throw new Error("Planner returned zero valid shots.");
      return { shots, modelUsed: normalizeOpenRouterModelId(model) };
    } catch (e) {
      lastError = e;
      console.warn(`[storyboard] plan model ${model} failed`, e);
    }
  }

  console.warn("[storyboard] using deterministic shot fallback", lastError);
  return {
    shots: fallbackShots(args.scenes, args.stylePreset),
    modelUsed: "fallback-local",
  };
}

export async function reviseStoryboardPrompt(args: {
  currentPrompt: string;
  editInstruction: string;
  stylePreset: string;
  sceneHeading?: string | null;
}): Promise<{ prompt: string; modelUsed: string }> {
  const style = stylePromptHint(args.stylePreset);
  const system = `You revise storyboard image prompts. Return ONLY the new prompt text (no JSON, no quotes).
Keep it as one drawable panel. Style: ${style}. No watermarks or on-image text.`;
  const user = [
    args.sceneHeading ? `Scene: ${args.sceneHeading}` : null,
    `Current prompt:\n${args.currentPrompt}`,
    `Edit request:\n${args.editInstruction}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const chain = planningModelChain();
  const working = await resolveWorkingModel(chain);
  const models = working
    ? [working, ...chain.filter((m) => normalizeOpenRouterModelId(m) !== working)]
    : chain;

  for (const model of models) {
    try {
      const text = await chatComplete(model, system, user);
      const prompt = text.replace(/^["']|["']$/g, "").trim();
      if (prompt.length > 20) {
        return { prompt, modelUsed: normalizeOpenRouterModelId(model) };
      }
    } catch (e) {
      console.warn(`[storyboard] revise model ${model} failed`, e);
    }
  }

  return {
    prompt: `${args.currentPrompt}\n\nRevision: ${args.editInstruction}. ${style}`,
    modelUsed: "fallback-local",
  };
}
