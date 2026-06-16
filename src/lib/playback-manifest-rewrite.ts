/** Rewrite relative segment URLs in an HLS manifest to absolute Cloudflare URLs. */
export function rewriteHlsManifestForProxy(body: string, upstreamManifestUrl: string): string {
  let baseUrl: URL;
  try {
    baseUrl = new URL(upstreamManifestUrl);
  } catch {
    return body;
  }

  const manifestDir = baseUrl.href.replace(/\/[^/]*$/, "/");

  return body
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;
      if (/^https?:\/\//i.test(trimmed)) return line;
      try {
        return new URL(trimmed, manifestDir).href;
      } catch {
        return line;
      }
    })
    .join("\n");
}
