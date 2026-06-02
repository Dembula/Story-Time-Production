/** Shared JSON helper for company portal API routes. */
export async function readCompanyApiJson<T>(res: Response): Promise<{ data: T | null; error: string | null }> {
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof (payload as { error: unknown }).error === "string"
        ? (payload as { error: string }).error
        : `Request failed (${res.status})`;
    return { data: null, error: message };
  }

  return { data: payload as T, error: null };
}

/** @deprecated Use readCompanyApiJson */
export const readCastingApiJson = readCompanyApiJson;
