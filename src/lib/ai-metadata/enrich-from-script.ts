import "server-only";

import { parseScenesFromScreenplay } from "@/lib/scene-parser";
import type { EnrichmentResult } from "./types";
import { persistEnrichmentResult } from "./persist-enrichment";

function buildScriptPlaybackPrompt(input: {
  title: string;
  durationSeconds: number | null;
  screenplay: string;
  castNames: string[];
}) {
  const sluglines = parseScenesFromScreenplay(input.screenplay);
  const sluglineHint =
    sluglines.length > 0
      ? sluglines
          .slice(0, 40)
          .map((s) => `${s.number}. ${s.heading}`)
          .join("\n")
      : "No INT./EXT. sluglines detected — infer scenes from script structure.";

  return `Map this production screenplay to streaming playback scene intelligence. Return strict JSON only.

Title: ${input.title}
Runtime seconds: ${input.durationSeconds ?? "unknown"}
Detected slugline scenes (${sluglines.length}):
${sluglineHint}

Cast / crew on this release (use for "actors" when the script uses character names — prefer character names on screen):
${input.castNames.length > 0 ? input.castNames.join(", ") : "unknown"}

Rules:
- Create one playback segment per screenplay scene (INT./EXT. slugline order).
- Spread startSeconds/endSeconds across the full runtime proportionally to each scene's script length (dialogue + action), not equal slices.
- "actors": principal characters physically on screen in that scene (from script cues, dialogue headers, and action lines).
- "summary": 1–2 sentences of what happens (not the slugline alone).
- "mood": short tone (e.g. tense, playful, sombre).
- Include moodTags (3–8), atmosphere (one phrase), pacing (slow|moderate|fast), narrativeSummary, and optional dialogueIndex highlights.

JSON schema:
{
  "moodTags": string[],
  "atmosphere": string,
  "pacing": "slow"|"moderate"|"fast",
  "narrativeSummary": string,
  "scenes": [{ "startSeconds": number, "endSeconds": number, "summary": string, "mood": string, "actors": string[], "tags": string[] }],
  "dialogueIndex": [{ "startSeconds": number, "endSeconds": number, "text": string }]
}

Screenplay:
---
${input.screenplay}
---`;
}

export async function enrichContentFromScript(
  contentId: string,
  input: {
    title: string;
    description: string | null;
    duration: number | null;
    screenplay: string;
    scriptLabel: string;
    castNames?: string[];
  },
): Promise<EnrichmentResult | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const durationSeconds = input.duration != null ? input.duration * 60 : null;
  const castNames = input.castNames ?? [];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_ENRICHMENT_MODEL ?? "gpt-4o-mini",
      temperature: 0.15,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a script supervisor building playback scene intelligence for a streaming platform. Output valid JSON only. Base every scene on the screenplay text.",
        },
        {
          role: "user",
          content: buildScriptPlaybackPrompt({
            title: input.title,
            durationSeconds,
            screenplay: input.screenplay,
            castNames,
          }),
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = body.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Empty script enrichment response");

  const parsed = JSON.parse(raw) as EnrichmentResult;

  return persistEnrichmentResult(contentId, {
    title: input.title,
    description: input.description,
    parsed,
    sceneSource: "script",
    scriptLabel: input.scriptLabel,
  });
}
