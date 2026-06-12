export class ProjectToolFetchError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ProjectToolFetchError";
    this.status = status;
  }
}

type ApiErrorBody = { error?: string; message?: string };

export function mutationErrorMessage(err: unknown, fallback = "Something went wrong. Try again."): string {
  if (err instanceof ProjectToolFetchError || err instanceof Error) {
    return err.message || fallback;
  }
  return fallback;
}

export async function projectToolFetch<T = Record<string, unknown>>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(input, init);
  const json = (await res.json().catch(() => ({}))) as ApiErrorBody & T;

  if (!res.ok) {
    const msg = json.error || json.message || res.statusText || "Request failed";
    throw new ProjectToolFetchError(msg, res.status);
  }

  if (typeof window !== "undefined") {
    const method = (init?.method ?? "GET").toUpperCase();
    if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
      void import("@/lib/modoc/infer-tool-activity")
        .then(({ inferToolActivityFromMutation }) => {
          const activity = inferToolActivityFromMutation(
            input,
            init,
            json as Record<string, unknown>,
          );
          if (activity) {
            return import("@/lib/modoc/modoc-activity-sync").then(({ notifyModocToolActivity }) =>
              notifyModocToolActivity(activity),
            );
          }
        })
        .catch(() => {});
    }
  }

  return json;
}

/** Matches legacy fetch().then(r => r.json()) typing for React Query loaders. */
// eslint-disable-next-line
export function projectToolQueryFn<T = any>(url: string): () => Promise<T> {
  return () => projectToolFetch<T>(url);
}
