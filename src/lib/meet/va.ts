import "server-only";

import { OPENROUTER_DEFAULT_MODELS, resolveWorkingModel } from "@/lib/modoc/openrouter-models";

export type MeetVaReport = {
  summary: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: string[];
};

export async function generateMeetSummaryReport(input: {
  title: string;
  notes: string[];
  transcript?: string | null;
  elapsedMinutes?: number;
  participantCount?: number;
}): Promise<MeetVaReport> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const fallback = buildFallbackReport(input);

  if (!apiKey) return fallback;

  const modelChain = [
    process.env.OPENROUTER_MODOC_CHAT_MODEL,
    ...OPENROUTER_DEFAULT_MODELS.chat,
  ].filter((m): m is string => Boolean(m?.trim()));
  const model = (await resolveWorkingModel(modelChain)) || "openai/gpt-4o-mini";

  const prompt = `You are the Story Time Meet VA — a production-savvy note-taker for film, series, and creative studio calls.

Write a polished meeting report as JSON with exactly these keys:
- summary: 2–4 short paragraphs (string). Lead with what the meeting was for, then what moved forward. Plain professional prose, no fluff.
- keyPoints: 4–10 crisp bullets (string[]). Facts, updates, blockers, creative direction — not filler.
- decisions: concrete decisions that were made (string[]). Empty array if none are clear.
- actionItems: each item should name the owner when known and the next step, e.g. "Alex — send revised beat sheet by Friday" (string[]). Empty if none.

Rules:
- Prefer specificity over vagueness. Use names/titles from the notes when present.
- Do not invent attendees, dates, or deliverables that are not supported by the notes/transcript.
- If notes are thin, say so briefly in summary and keep lists short.
- Film/production vocabulary is welcome when it fits (table read, sides, coverage, VFX, deliverables).

Meeting title: ${input.title}
Duration minutes: ${input.elapsedMinutes != null ? Math.round(input.elapsedMinutes) : "unknown"}
Participants (approx): ${input.participantCount ?? "unknown"}

Host / VA notes:
${input.notes.map((n, i) => `${i + 1}. ${n}`).join("\n") || "(none)"}

Speech / transcript excerpts:
${(input.transcript || "").slice(0, 10000) || "(none)"}

Return ONLY valid JSON.`;

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL ?? "https://story-time.online",
        "X-Title": "Story Time Meet VA",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You write clear, structured film-production meeting summaries for Story Time. Output valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.25,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<MeetVaReport>;
    return {
      summary: String(parsed.summary || fallback.summary).trim() || fallback.summary,
      keyPoints: cleanList(parsed.keyPoints, fallback.keyPoints),
      decisions: cleanList(parsed.decisions, []),
      actionItems: cleanList(parsed.actionItems, []),
    };
  } catch {
    return fallback;
  }
}

function cleanList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const next = value.map(String).map((s) => s.trim()).filter(Boolean);
  return next.length ? next : fallback;
}

function buildFallbackReport(input: {
  title: string;
  notes: string[];
  elapsedMinutes?: number;
  participantCount?: number;
}): MeetVaReport {
  const mins =
    input.elapsedMinutes != null ? Math.max(1, Math.round(input.elapsedMinutes)) : null;
  const meta = [
    mins != null ? `${mins} minute${mins === 1 ? "" : "s"}` : null,
    input.participantCount != null ? `${input.participantCount} participant(s)` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (input.notes.length === 0) {
    return {
      summary: [
        `“${input.title}” ended without captured notes.`,
        meta ? `Session length: ${meta}.` : null,
        "Open a future Meet with VA notes open to capture decisions and action items live.",
      ]
        .filter(Boolean)
        .join(" "),
      keyPoints: [],
      decisions: [],
      actionItems: [],
    };
  }

  return {
    summary: [
      `“${input.title}” covered the topics captured in the meeting notes${meta ? ` (${meta})` : ""}.`,
      "Review the key points below and convert any open threads into action items on your next sync.",
    ].join("\n\n"),
    keyPoints: input.notes.slice(0, 12),
    decisions: [],
    actionItems: [],
  };
}
