/** Safe JSON parse for marketplace list endpoints — never throws on error bodies. */
export async function fetchMarketplaceList<T>(url: string): Promise<{ data: T[]; error: string | null }> {
  try {
    const res = await fetch(url);
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        payload && typeof payload === "object" && "error" in payload && typeof (payload as { error: unknown }).error === "string"
          ? (payload as { error: string }).error
          : `Request failed (${res.status})`;
      return { data: [], error: message };
    }
    return { data: Array.isArray(payload) ? payload : [], error: null };
  } catch {
    return { data: [], error: "Network error — could not load listings." };
  }
}

export async function postMarketplaceJson<T>(
  url: string,
  body: unknown,
): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        payload && typeof payload === "object" && "error" in payload && typeof (payload as { error: unknown }).error === "string"
          ? (payload as { error: string }).error
          : `Request failed (${res.status})`;
      return { data: null, error: message };
    }
    return { data: payload as T, error: null };
  } catch {
    return { data: null, error: "Network error — could not save." };
  }
}
