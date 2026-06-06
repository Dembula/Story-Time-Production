/** Tag written when upload wizard links a platform screenplay version. */
export const PLATFORM_SCRIPT_VERSION_TAG_PREFIX = "platform-script-version:";

export function parsePlatformScriptVersionId(tags: string | null | undefined): string | null {
  if (!tags) return null;
  const match = tags
    .split(",")
    .map((t) => t.trim())
    .find((t) => t.startsWith(PLATFORM_SCRIPT_VERSION_TAG_PREFIX));
  return match ? match.slice(PLATFORM_SCRIPT_VERSION_TAG_PREFIX.length) : null;
}
