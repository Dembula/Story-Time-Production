const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIM = 1536;

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export async function embedText(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key || !text.trim()) return null;

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000),
    }),
  });

  if (!res.ok) return null;
  const body = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
  const vec = body.data?.[0]?.embedding;
  if (!vec || vec.length !== EMBEDDING_DIM) return null;
  return vec;
}

export function parseStoredEmbedding(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const nums = raw.filter((v): v is number => typeof v === "number");
  return nums.length > 0 ? nums : null;
}
