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
  /** Curated host / manual / VA notes (not raw speech dump). */
  notes: string[];
  /** Speaker-attributed dialogue transcript. */
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

  const transcript = (input.transcript || "").trim().slice(0, 14000);
  const curated = input.notes.map((n) => n.trim()).filter(Boolean);

  const prompt = `You are the Story Time Meet VA — an attentive production note-taker for film, series, and creative studio calls.

You receive:
1) A speaker-attributed live transcript (who said what)
2) Optional curated host notes

Your job is NOT to paste random lines. Be attentive:
- Read the whole conversation for intent, decisions, blockers, creative direction, and next steps.
- Credit speakers by name when attributing quotes, decisions, or action owners.
- Ignore filler, greetings, and repeated fragments unless they carry meaning.
- Prefer substance over volume. If the transcript is long, compress intelligently.

Write a polished meeting report as JSON with exactly these keys:
- summary: 2–4 short paragraphs (string). Open with purpose, then what moved forward, then open threads. Name key speakers when relevant.
- keyPoints: 4–12 crisp bullets (string[]). Facts, updates, blockers, creative direction. When a point came from a specific person, start with their name (e.g. "Jordan — wants colder grade on night exteriors").
- decisions: concrete decisions that were agreed (string[]). Include who drove/confirmed when clear. Empty array if none.
- actionItems: owner + next step, e.g. "Alex — send revised beat sheet by Friday" (string[]). Infer owners from who volunteered or was assigned in the transcript. Empty if none.

Rules:
- Do not invent attendees, dates, or deliverables that are not supported by the transcript/notes.
- Do not treat every spoken sentence as a key point.
- If transcript/notes are thin, say so briefly in summary and keep lists short.
- Film/production vocabulary is welcome when it fits (table read, sides, coverage, VFX, deliverables).

Meeting title: ${input.title}
Duration minutes: ${input.elapsedMinutes != null ? Math.round(input.elapsedMinutes) : "unknown"}
Participants (approx): ${input.participantCount ?? "unknown"}

Curated host / VA notes:
${curated.map((n, i) => `${i + 1}. ${n}`).join("\n") || "(none)"}

Speaker-attributed transcript:
${transcript || "(none)"}

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
              "You are an attentive Story Time Meet VA. Attribute speakers, extract decisions and actions, and never dump raw transcript lines as the report. Output valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(55_000),
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
  transcript?: string | null;
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

  const curated = input.notes.map((n) => n.trim()).filter(Boolean);
  const transcriptLines = (input.transcript || "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!curated.length && !transcriptLines.length) {
    return {
      summary: [
        `“${input.title}” ended without captured notes.`,
        meta ? `Session length: ${meta}.` : null,
        "Keep mics unmuted in Chrome/Edge so the VA can attribute speakers and draft a real report next time.",
      ]
        .filter(Boolean)
        .join(" "),
      keyPoints: [],
      decisions: [],
      actionItems: [],
    };
  }

  const speakerHints = new Set<string>();
  for (const line of transcriptLines) {
    const m = /^([^:]{1,48}):\s+/.exec(line);
    if (m) speakerHints.add(m[1].trim());
  }

  return {
    summary: [
      `“${input.title}” captured live discussion${meta ? ` (${meta})` : ""}${
        speakerHints.size ? ` with ${[...speakerHints].slice(0, 6).join(", ")} contributing` : ""
      }.`,
      "Review the points below — regenerate with the VA online for a fuller speaker-aware report.",
    ].join("\n\n"),
    keyPoints: [...curated, ...transcriptLines]
      .filter((line, i, arr) => arr.indexOf(line) === i)
      .slice(0, 10),
    decisions: [],
    actionItems: [],
  };
}
