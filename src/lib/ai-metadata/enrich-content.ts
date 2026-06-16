import { prisma } from "@/lib/prisma";
import { embedText } from "./embeddings";
import { enrichContentFromScript } from "./enrich-from-script";
import { markEnrichmentFailed, persistEnrichmentResult } from "./persist-enrichment";
import { resolveContentCastNames } from "./resolve-content-cast";
import { resolveContentScriptText } from "./resolve-content-script";
import { buildPlaybackScenesFromLinkedProject } from "./scenes-from-project";
import type { EnrichmentResult, SceneSegment } from "./types";
import type { ScriptTextExtraction } from "./script-text";

function buildCatalogueEnrichmentPrompt(
  content: {
    title: string;
    description: string | null;
    category: string | null;
    tags: string | null;
    duration: number | null;
  },
  script: ScriptTextExtraction | null,
) {
  const durationSeconds =
    content.duration != null ? content.duration * 60 : null;
  const scriptBlock = script?.text
    ? `\nScript source: ${script.sourceType}${script.truncated ? " (excerpt truncated)" : ""}

Screenplay text:
---
${script.text}
---`
    : script?.error
      ? `\nScript file could not be read: ${script.error}`
      : "\nNo screenplay text available — infer scenes from catalogue metadata.";

  return `Analyze this film/TV catalogue title for a streaming platform. Return strict JSON only.

Title: ${content.title}
Description: ${content.description ?? "N/A"}
Category: ${content.category ?? "N/A"}
Tags: ${content.tags ?? "N/A"}
Runtime seconds: ${durationSeconds ?? "unknown"}
${scriptBlock}

JSON schema:
{
  "moodTags": string[],
  "atmosphere": string,
  "pacing": "slow"|"moderate"|"fast",
  "narrativeSummary": string,
  "scenes": [{ "startSeconds": number, "endSeconds": number, "summary": string, "mood": string, "actors": string[], "tags": string[] }],
  "dialogueIndex": [{ "startSeconds": number, "endSeconds": number, "text": string }]
}

Generate 4-16 playback scenes across the runtime. When screenplay text is present, ground summaries and on-screen actors in the script. List only characters present in each scene. Be concise.`;
}

async function runCatalogueEnrichmentAI(
  content: {
    title: string;
    description: string | null;
    category: string | null;
    tags: string | null;
    duration: number | null;
  },
  script: ScriptTextExtraction | null,
): Promise<EnrichmentResult> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY not configured");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_ENRICHMENT_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You are a film metadata analyst. Output valid JSON only.",
        },
        {
          role: "user",
          content: buildCatalogueEnrichmentPrompt(content, script),
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = body.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Empty enrichment response");

  const parsed = JSON.parse(raw) as Omit<EnrichmentResult, "embedding">;
  const embedInput = [
    content.title,
    content.description,
    script?.text,
    parsed.narrativeSummary,
    parsed.moodTags?.join(", "),
    parsed.atmosphere,
  ]
    .filter(Boolean)
    .join("\n");
  const embedding = (await embedText(embedInput)) ?? [];

  return { ...parsed, embedding };
}

export async function enrichContentById(contentId: string): Promise<EnrichmentResult | null> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      tags: true,
      duration: true,
      scriptUrl: true,
      linkedProjectId: true,
    },
  });
  if (!content) return null;

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  await prisma.contentEnrichment.upsert({
    where: { contentId },
    create: { contentId, status: "PROCESSING" },
    update: { status: "PROCESSING", error: null },
  });

  try {
    const resolvedScript = await resolveContentScriptText(contentId);
    const castNames = await resolveContentCastNames(contentId);

    if (resolvedScript?.text) {
      const result = await enrichContentFromScript(contentId, {
        title: content.title,
        description: content.description,
        duration: content.duration,
        screenplay: resolvedScript.text,
        scriptLabel: resolvedScript.label,
        scriptSource: resolvedScript.source,
        castNames,
        truncated: resolvedScript.truncated,
      });
      return result;
    }

    const runtimeSeconds =
      content.duration != null ? content.duration * 60 : null;
    const projectScenes = content.linkedProjectId
      ? await buildPlaybackScenesFromLinkedProject(
          content.linkedProjectId,
          runtimeSeconds,
        )
      : null;

    if (projectScenes?.length) {
      const parsed = await runCatalogueEnrichmentAI(content, null);
      return persistEnrichmentResult(contentId, {
        title: content.title,
        description: content.description,
        parsed: {
          ...parsed,
          scenes: projectScenes as SceneSegment[],
        },
        sceneSource: "project",
        scriptLabel: "Linked production breakdown",
        scriptAnalysis: {
          used: true,
          sourceType: "linked-project",
          truncated: false,
          error: null,
          label: "Production breakdown",
        },
      });
    }

    const parsed = await runCatalogueEnrichmentAI(content, null);
    return persistEnrichmentResult(contentId, {
      title: content.title,
      description: content.description,
      parsed,
      sceneSource: "catalogue",
      scriptAnalysis: {
        used: false,
        sourceType: null,
        truncated: false,
        error: null,
        label: null,
      },
    });
  } catch (err) {
    await markEnrichmentFailed(
      contentId,
      err instanceof Error ? err : new Error("Enrichment failed"),
    );
    return null;
  }
}
