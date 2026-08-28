/** Convert SubRip (.srt) text to WebVTT for playback and storage. */
export function convertSrtToVtt(srt: string): string {
  const normalized = srt.replace(/\uFEFF/g, "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return "WEBVTT\n\n";

  const blocks = normalized.split(/\n\n+/);
  const cues: string[] = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n").filter(Boolean);
    if (lines.length < 2) continue;

    let timeLineIndex = 0;
    if (/^\d+$/.test(lines[0]!.trim())) {
      timeLineIndex = 1;
    }

    const timeLine = lines[timeLineIndex];
    if (!timeLine?.includes("-->")) continue;

    const [startRaw, endRaw] = timeLine.split("-->").map((part) => part.trim());
    const start = (startRaw ?? "").replace(/,/g, ".");
    const end = (endRaw ?? "").split(/\s+/)[0]?.replace(/,/g, ".") ?? "";
    const text = lines.slice(timeLineIndex + 1).join("\n").trim();
    if (!text || !start || !end) continue;

    cues.push(`${start} --> ${end}\n${text}`);
  }

  return cues.length > 0 ? `WEBVTT\n\n${cues.join("\n\n")}\n` : "WEBVTT\n\n";
}

export function isSrtFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".srt");
}

export function isVttFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".vtt");
}

/** Prepare a WebVTT blob for upload (convert SRT when needed). */
export async function prepareSubtitleUploadFile(file: File): Promise<File> {
  if (isVttFileName(file.name)) return file;
  if (!isSrtFileName(file.name)) return file;

  const srtText = await file.text();
  const vttText = convertSrtToVtt(srtText);
  const baseName = file.name.replace(/\.srt$/i, "");
  return new File([vttText], `${baseName}.vtt`, { type: "text/vtt" });
}
