export function toGatewaySafeReference(prefix: string, rawId: string) {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 12) || "ref";
  const cleanId = rawId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 48) || Date.now().toString(36);
  return `${cleanPrefix}-${cleanId}`;
}

