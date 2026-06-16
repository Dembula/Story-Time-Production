function resolveManifestUrl(relativeOrAbsolute: string, manifestDir: string): string {
  if (/^https?:\/\//i.test(relativeOrAbsolute)) return relativeOrAbsolute;
  try {
    return new URL(relativeOrAbsolute, manifestDir).href;
  } catch {
    return relativeOrAbsolute;
  }
}

/** Rewrite URI="..." attributes on HLS tag lines (#EXT-X-MEDIA, #EXT-X-MAP, etc.). */
function rewriteTagUriAttributes(line: string, manifestDir: string): string {
  return line.replace(/URI=("|')([^"']+)\1/gi, (_match, quote: string, uri: string) => {
    return `URI=${quote}${resolveManifestUrl(uri, manifestDir)}${quote}`;
  });
}

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
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        return rewriteTagUriAttributes(line, manifestDir);
      }

      if (/^https?:\/\//i.test(trimmed)) return line;
      return resolveManifestUrl(trimmed, manifestDir);
    })
    .join("\n");
}
