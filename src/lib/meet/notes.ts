export type MeetNoteSource = "MANUAL" | "VA" | "SPEECH" | "CHAT";

export type MeetNoteView = {
  id?: string;
  text: string;
  speakerName: string | null;
  speakerPeerId?: string | null;
  source: MeetNoteSource;
  at: string;
};

/** Format a speaker-attributed transcript line. */
export function formatSpeakerLine(speakerName: string | null | undefined, text: string): string {
  const clean = text.trim();
  if (!clean) return "";
  const name = (speakerName || "").trim();
  if (!name) return clean;
  // Avoid double-prefix if body already starts with "Name: "
  if (clean.toLowerCase().startsWith(`${name.toLowerCase()}:`)) return clean;
  return `${name}: ${clean}`;
}

/** Parse "Name: utterance" bodies written by older clients / signal route. */
export function parseSpeakerLine(body: string): { speakerName: string | null; text: string } {
  const raw = body.trim();
  if (!raw) return { speakerName: null, text: "" };
  const match = /^([^:]{1,80}):\s+([\s\S]+)$/.exec(raw);
  if (!match) return { speakerName: null, text: raw };
  const name = match[1].trim();
  const text = match[2].trim();
  // Heuristic: very long "names" are probably not speakers.
  if (!name || name.length > 48 || /\s{2,}/.test(name)) {
    return { speakerName: null, text: raw };
  }
  return { speakerName: name, text };
}

function formatNoteClock(at?: Date | string | null): string {
  if (!at) return "";
  const d = typeof at === "string" ? new Date(at) : at;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function noteFromDbRow(row: {
  id: string;
  body: string;
  source: string;
  speakerName?: string | null;
  speakerPeerId?: string | null;
  createdAt: Date | string;
}): MeetNoteView {
  const source: MeetNoteSource =
    row.source === "SPEECH" ||
    row.source === "VA" ||
    row.source === "MANUAL" ||
    row.source === "CHAT"
      ? row.source
      : "MANUAL";
  const parsed = parseSpeakerLine(row.body);
  const speakerName = row.speakerName?.trim() || parsed.speakerName;
  const text = parsed.speakerName ? parsed.text : row.body.trim();
  return {
    id: row.id,
    text: text || row.body.trim(),
    speakerName,
    speakerPeerId: row.speakerPeerId ?? null,
    source,
    at: typeof row.createdAt === "string" ? row.createdAt : row.createdAt.toISOString(),
  };
}

/** Split curated host notes from live speech + typed chat for the VA report. */
export function splitNotesForVa(
  notes: Array<{
    body: string;
    source: string;
    speakerName?: string | null;
    createdAt?: Date | string | null;
  }>,
) {
  const curated: string[] = [];
  const transcript: string[] = [];
  for (const n of notes) {
    const parsed = parseSpeakerLine(n.body);
    const speaker = n.speakerName || parsed.speakerName;
    const text = parsed.speakerName ? parsed.text : n.body.trim();
    if (!text && !n.body.trim()) continue;

    if (n.source === "SPEECH") {
      const line = formatSpeakerLine(speaker, text || n.body);
      if (line) transcript.push(line);
      continue;
    }

    if (n.source === "CHAT") {
      const clock = formatNoteClock(n.createdAt);
      const spoken = formatSpeakerLine(speaker, text || n.body);
      if (!spoken) continue;
      transcript.push(clock ? `[chat ${clock}] ${spoken}` : `[chat] ${spoken}`);
      continue;
    }

    const line = n.body.trim();
    if (line) curated.push(line);
  }
  return { curated, transcript };
}
