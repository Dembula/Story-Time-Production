export type VttCue = {
  start: number;
  end: number;
  text: string;
};

/** Minimal WebVTT parser for in-player subtitle overlay. */
export function parseVtt(raw: string): VttCue[] {
  const cues: VttCue[] = [];
  const blocks = raw.replace(/\r\n/g, "\n").split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;
    const timeLine = lines.find((l) => l.includes("-->"));
    if (!timeLine) continue;
    const [startRaw, endRaw] = timeLine.split("-->").map((s) => s.trim().split(" ")[0]);
    const start = parseVttTime(startRaw ?? "");
    const end = parseVttTime(endRaw ?? "");
    const text = lines.slice(lines.indexOf(timeLine) + 1).join("\n").trim();
    if (text && end > start) cues.push({ start, end, text });
  }

  return cues;
}

function parseVttTime(value: string): number {
  const parts = value.split(":");
  if (parts.length === 3) {
    return Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2]);
  }
  if (parts.length === 2) {
    return Number(parts[0]) * 60 + Number(parts[1]);
  }
  return 0;
}

export function findActiveCue(cues: VttCue[], time: number): VttCue | null {
  for (const cue of cues) {
    if (time >= cue.start && time <= cue.end) return cue;
  }
  return null;
}
