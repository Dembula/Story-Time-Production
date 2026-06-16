import { prisma } from "@/lib/prisma";
import { embedText } from "./embeddings";
import type { EnrichmentResult, SceneSegment } from "./types";
import { extractScriptTextFromUrl, type ScriptTextExtraction } from "./script-text";

function buildEnrichmentPrompt(content: {
  title: string;
  description: string | null;
  category: string | null;
  tags: string | null;
  duration: number | null;
}, script: ScriptTextExtraction | null) {
  const scriptBlock = script?.text
    ? `\nUploaded script source: ${script.sourceType}${script.truncated ? " (excerpt truncated for token limits)" : ""}

Screenplay text:
---
${script.text}
---`
    : script?.error
      ? `\nUploaded script source could not be read automatically: ${script.error}`
      : "\nNo uploaded script text was available. Use catalogue metadata only and mark scene details as inferred.";

  return `Analyze this film/TV catalogue title for a streaming platform. Return strict JSON only.

Title: ${content.title}
Description: ${content.description ?? "N/A"}
Category: ${content.category ?? "N/A"}
Tags: ${content.tags ?? "N/A"}
Duration seconds: ${content.duration ?? "unknown"}
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

Generate 4-12 scenes spread across the runtime. When screenplay text is present, ground scene summaries, actors, and dialogue snippets in the script. Map script scenes proportionally across the runtime if exact timecodes are not present. List only characters that are actually present or speaking in each scene. Be concise.`;
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
    const script = await extractScriptTextFromUrl(content.scriptUrl);
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
          { role: "system", content: "You are a film metadata analyst. Output valid JSON only." },
          { role: "user", content: buildEnrichmentPrompt(content, script) },
        ],
      }),
    });

    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = body.choices?.[0]?.message?.content;
    if (!raw) throw new Error("Empty enrichment response");

    const parsed = JSON.parse(raw) as EnrichmentResult;
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

    const enrichment = await prisma.contentEnrichment.update({
      where: { contentId },
      data: {
        status: "READY",
        moodTags: parsed.moodTags ?? [],
        atmosphere: parsed.atmosphere ?? null,
        pacing: parsed.pacing ?? null,
        narrativeJson: {
          summary: parsed.narrativeSummary,
          scriptAnalysis: script
            ? {
                sourceType: script.sourceType,
                used: Boolean(script.text),
                truncated: script.truncated,
                error: script.error ?? null,
              }
            : { used: false, sourceType: null, truncated: false, error: null },
        },
        dialogueIndex: parsed.dialogueIndex ?? [],
        embedding,
        processedAt: new Date(),
        error: null,
      },
    });

    await prisma.contentScene.deleteMany({ where: { contentId } });
    const scenes = (parsed.scenes ?? []) as SceneSegment[];
    if (scenes.length > 0) {
      await prisma.contentScene.createMany({
        data: scenes.map((s) => ({
          contentId,
          enrichmentId: enrichment.id,
          startSeconds: s.startSeconds,
          endSeconds: s.endSeconds,
          summary: s.summary,
          mood: s.mood ?? null,
          actors: s.actors ?? [],
          tags: s.tags ?? [],
        })),
      });
    }

    return { ...parsed, embedding };
  } catch (err) {
    await prisma.contentEnrichment.update({
      where: { contentId },
      data: {
        status: "FAILED",
        error: err instanceof Error ? err.message : "Enrichment failed",
      },
    });
    return null;
  }
}
