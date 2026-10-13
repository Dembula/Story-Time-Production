import "server-only";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { buildContentMediaFinalizePayload } from "@/lib/content-media-post-upload";
import { createContentMediaS3Client } from "@/lib/content-media-s3";
import { buildUserScopedUploadKey } from "@/lib/content-media-shared";
import { normalizeOpenRouterModelId, resolveModelChain } from "@/lib/modoc/openrouter-models";

/** Strong OpenRouter image models used to draw storyboard frames. */
export const STORYBOARD_IMAGE_DEFAULT_MODELS = [
  "openai/gpt-image-2.5-sunburst",
  "openai/gpt-image-2",
  "black-forest-labs/flux-3-image",
  "bytedance-seed/seedream-5-0-pro",
  "google/gemini-nano-banana-2.1",
] as const;

export function storyboardImageModelChain(): string[] {
  return resolveModelChain(
    [
      process.env.OPENROUTER_STORYBOARD_IMAGE_MODEL,
      process.env.OPENROUTER_IMAGE_MODEL,
    ],
    STORYBOARD_IMAGE_DEFAULT_MODELS,
  );
}

type OpenRouterImageResponse = {
  data?: Array<{ b64_json?: string; url?: string }>;
  error?: { message?: string };
};

async function generateImageBytes(args: {
  model: string;
  prompt: string;
  aspectRatio: string;
}): Promise<{ buffer: Buffer; contentType: string; modelUsed: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured.");

  const model = normalizeOpenRouterModelId(args.model);
  const res = await fetch("https://openrouter.ai/api/v1/images", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL ?? "https://story-time.online",
      "X-Title": "Story Time Storyboard",
    },
    body: JSON.stringify({
      model,
      prompt: args.prompt,
      aspect_ratio: args.aspectRatio,
      n: 1,
      output_format: "png",
      quality: "high",
    }),
    signal: AbortSignal.timeout(180_000),
  });

  const json = (await res.json().catch(() => ({}))) as OpenRouterImageResponse;
  if (!res.ok) {
    throw new Error(json.error?.message || `Image generation failed (${res.status}).`);
  }

  const first = json.data?.[0];
  if (first?.b64_json) {
    return {
      buffer: Buffer.from(first.b64_json, "base64"),
      contentType: "image/png",
      modelUsed: model,
    };
  }
  if (first?.url) {
    const imgRes = await fetch(first.url, { signal: AbortSignal.timeout(60_000) });
    if (!imgRes.ok) throw new Error(`Could not download generated image (${imgRes.status}).`);
    const contentType = (imgRes.headers.get("content-type") || "image/png").split(";")[0].trim();
    return {
      buffer: Buffer.from(await imgRes.arrayBuffer()),
      contentType,
      modelUsed: model,
    };
  }
  throw new Error("Image API returned no image data.");
}

export async function generateStoryboardImageWithFallback(args: {
  prompt: string;
  aspectRatio: string;
}): Promise<{ buffer: Buffer; contentType: string; modelUsed: string }> {
  const chain = storyboardImageModelChain();
  let lastError: unknown;
  for (const model of chain) {
    try {
      return await generateImageBytes({
        model,
        prompt: args.prompt,
        aspectRatio: args.aspectRatio,
      });
    } catch (e) {
      lastError = e;
      console.warn(`[storyboard] image model ${model} failed`, e);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All storyboard image models failed.");
}

export async function persistStoryboardImage(args: {
  userId: string;
  buffer: Buffer;
  contentType: string;
  fileStem: string;
}): Promise<{ storageUrl: string; storageRef: string }> {
  const { client, storage } = createContentMediaS3Client();
  const bucket = storage.bucket;
  if (!bucket || !storage.region) {
    throw new Error("Storage is not configured.");
  }

  const ext = args.contentType.includes("webp")
    ? "webp"
    : args.contentType.includes("jpeg") || args.contentType.includes("jpg")
      ? "jpg"
      : "png";
  const key = buildUserScopedUploadKey(args.userId, `${args.fileStem}.${ext}`);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: args.buffer,
      ContentType: args.contentType,
    }),
  );

  const payload = buildContentMediaFinalizePayload({
    key,
    contentType: args.contentType,
  });

  return {
    storageUrl: payload.sourceUrl,
    storageRef: payload.storageRef,
  };
}
