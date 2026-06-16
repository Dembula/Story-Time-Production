const warmedSegmentSets = new Set<string>();

/**
 * Parse an HLS master or media playlist and prefetch the first segments
 * so playback starts immediately when the user presses play.
 */
export async function warmHlsFirstSegments(manifestUrl: string, maxSegments = 3): Promise<void> {
  if (typeof window === "undefined") return;
  const url = manifestUrl.trim();
  if (!url || warmedSegmentSets.has(url)) return;

  try {
    const manifestRes = await fetch(url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      priority: "high",
    } as RequestInit);
    if (!manifestRes.ok) return;

    const manifestText = await manifestRes.text();
    const segmentUrls = extractSegmentUrls(manifestText, url).slice(0, maxSegments);
    if (!segmentUrls.length) return;

    warmedSegmentSets.add(url);
    await Promise.all(
      segmentUrls.map((segmentUrl) =>
        fetch(segmentUrl, {
          method: "GET",
          mode: "cors",
          credentials: "omit",
          priority: "high",
        } as RequestInit).catch(() => undefined),
      ),
    );
  } catch {
    warmedSegmentSets.delete(url);
  }
}

function extractSegmentUrls(manifestText: string, baseUrl: string): string[] {
  const lines = manifestText.split(/\r?\n/).map((line) => line.trim());
  const isMaster = lines.some((line) => line.startsWith("#EXT-X-STREAM-INF"));

  if (isMaster) {
    const variantUrl = lines.find((line) => line && !line.startsWith("#"));
    if (!variantUrl) return [];
    return [resolveUrl(baseUrl, variantUrl)];
  }

  const segments: string[] = [];
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    segments.push(resolveUrl(baseUrl, line));
  }
  return segments;
}

/** Also warm variant playlist when given a master manifest. */
export async function warmHlsPlayback(manifestUrl: string): Promise<void> {
  if (typeof window === "undefined") return;
  const url = manifestUrl.trim();
  if (!url) return;

  try {
    const manifestRes = await fetch(url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      priority: "high",
    } as RequestInit);
    if (!manifestRes.ok) {
      await warmHlsFirstSegments(url);
      return;
    }

    const manifestText = await manifestRes.text();
    const isMaster = manifestText.includes("#EXT-X-STREAM-INF");
    if (isMaster) {
      const variantUrl = manifestText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line && !line.startsWith("#"));
      if (variantUrl) {
        const mediaUrl = resolveUrl(url, variantUrl);
        await warmHlsFirstSegments(mediaUrl);
        return;
      }
    }

    await warmHlsFirstSegments(url);
  } catch {
    await warmHlsFirstSegments(url);
  }
}

function resolveUrl(baseUrl: string, relative: string): string {
  try {
    return new URL(relative, baseUrl).toString();
  } catch {
    return relative;
  }
}
