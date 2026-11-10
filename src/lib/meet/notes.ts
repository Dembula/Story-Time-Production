export type MeetNoteSource = "MANUAL" | "VA" | "SPEECH";

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

export function noteFromDbRow(row: {
  id: string;
  body: string;
  source: string;
  speakerName?: string | null;
  speakerPeerId?: string | null;
  createdAt: Date | string;
}): MeetNoteView {
  const source: MeetNoteSource =
    row.source === "SPEECH" || row.source === "VA" || row.source === "MANUAL"
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

/** Split curated host notes from live speech for the VA report. */
export function splitNotesForVa(notes: Array<{ body: string; source: string; speakerName?: string | null }>) {
  const curated: string[] = [];
  const transcript: string[] = [];
  for (const n of notes) {
    const line =
      n.source === "SPEECH"
        ? formatSpeakerLine(n.speakerName || parseSpeakerLine(n.body).speakerName, parseSpeakerLine(n.body).text || n.body)
        : n.body.trim();
    if (!line) continue;
    if (n.source === "SPEECH") transcript.push(line);
    else curated.push(line);
  }
  return { curated, transcript };
}
