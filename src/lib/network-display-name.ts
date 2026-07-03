/** Fields used to resolve how a creator appears in Network UI. */
export type NetworkNameFields = {
  name?: string | null;
  networkHandle?: string | null;
  handle?: string | null;
  email?: string | null;
};

/** Public @handle for search and profile (without @). */
export function resolveNetworkHandle(user: NetworkNameFields): string | null {
  const raw = user.networkHandle ?? user.handle;
  const trimmed = raw?.trim();
  return trimmed || null;
}

/**
 * How a creator is shown in Network until they set a custom name/handle.
 * Priority: display name → @handle → signup email → fallback.
 */
export function resolveNetworkDisplayName(
  user: NetworkNameFields,
  fallback = "Creator",
): string {
  const name = user.name?.trim();
  if (name) return name;
  const handle = resolveNetworkHandle(user);
  if (handle) return `@${handle}`;
  const email = user.email?.trim();
  if (email) return email;
  return fallback;
}

/** First character for avatar initials. */
export function networkDisplayInitial(user: NetworkNameFields): string {
  const display = resolveNetworkDisplayName(user);
  if (display.startsWith("@")) return display.charAt(1).toUpperCase() || "C";
  if (display.includes("@") && display.includes(".")) {
    return display.charAt(0).toUpperCase() || "C";
  }
  return display.charAt(0).toUpperCase() || "C";
}

export function enrichNetworkUserRow<T extends NetworkNameFields>(user: T) {
  const handle = resolveNetworkHandle(user);
  return {
    ...user,
    handle,
    displayName: resolveNetworkDisplayName(user),
  };
}
