import {
  CreateJobCommand,
  DescribeEndpointsCommand,
  GetJobCommand,
  MediaConvertClient,
  type Job,
} from "@aws-sdk/client-mediaconvert";
import { getStorageConfig } from "@/lib/storage-config";
import { resolveStorageObjectRef } from "@/lib/storage-object-ref";
import { STREAM_MEZZANINE_MAX_BITRATE_BPS } from "@/lib/stream-input-limits";

export type MezzanineJobMeta = {
  sourceUrl: string;
  storageRef?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  creatorId?: string | null;
  fileName?: string | null;
  /** S3 key prefix under the media bucket, e.g. mezzanine/abc123/ */
  outputPrefix?: string | null;
};

export type MezzanineJobStart = {
  jobId: string;
  placeholderUid: string;
  outputPrefix: string;
};

function clean(value: string | undefined | null): string | null {
  const v = value?.trim();
  return v ? v : null;
}

export function isMediaConvertMezzanineConfigured(): boolean {
  return Boolean(clean(process.env.MEDIACONVERT_ROLE_ARN));
}

function mediaConvertPlaceholderUid(jobId: string): string {
  return `mc_${jobId}`;
}

export function isMediaConvertPlaceholderUid(uid: string | null | undefined): boolean {
  return Boolean(uid?.startsWith("mc_"));
}

export function mediaConvertJobIdFromPlaceholderUid(uid: string): string | null {
  if (!uid.startsWith("mc_")) return null;
  return uid.slice(3) || null;
}

type CachedClient = { client: MediaConvertClient; cacheKey: string };
let cachedMediaConvert: CachedClient | null = null;

/** Exported for admin diagnostics (ListJobs). */
export async function createMediaConvertClientForAdmin(): Promise<MediaConvertClient> {
  return createMediaConvertClient();
}

async function createMediaConvertClient(): Promise<MediaConvertClient> {
  const storage = getStorageConfig();
  const region = clean(process.env.MEDIACONVERT_REGION) || storage.region || "us-east-1";
  const accessKeyId = storage.accessKeyId;
  const secretAccessKey = storage.secretAccessKey;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Storage credentials are required for MediaConvert mezzanine jobs.");
  }

  const endpointEnv = clean(process.env.MEDIACONVERT_ENDPOINT);
  const cacheKey = `${region}|${accessKeyId}|${endpointEnv ?? ""}`;
  if (cachedMediaConvert?.cacheKey === cacheKey) {
    return cachedMediaConvert.client;
  }

  let endpoint = endpointEnv;
  if (!endpoint) {
    const probe = new MediaConvertClient({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
    const described = await probe.send(new DescribeEndpointsCommand({ MaxResults: 1 }));
    endpoint = described.Endpoints?.[0]?.Url ?? null;
    if (!endpoint) {
      throw new Error("Could not resolve MediaConvert endpoint. Set MEDIACONVERT_ENDPOINT.");
    }
  }

  const client = new MediaConvertClient({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  cachedMediaConvert = { client, cacheKey };
  return client;
}

function toS3Uri(bucket: string, key: string): string {
  return `s3://${bucket}/${key.replace(/^\/+/, "")}`;
}

function inputBaseName(fileInput: string): string {
  const leaf = fileInput.split("/").pop() || "mezzanine";
  return leaf.replace(/\.[^.]+$/, "") || "mezzanine";
}

/** GetJob rarely includes EventBridge-only outputFilePaths — reconstruct from Settings. */
function reconstructMezzanineOutputS3Uri(job: Job, meta: MezzanineJobMeta): string | null {
  const paths: string[] = [];
  const groups =
    (job as { OutputGroupDetails?: unknown; outputGroupDetails?: unknown }).OutputGroupDetails ??
    (job as { outputGroupDetails?: unknown }).outputGroupDetails;
  if (Array.isArray(groups)) {
    for (const group of groups) {
      const details =
        (group as { OutputDetails?: unknown; outputDetails?: unknown }).OutputDetails ??
        (group as { outputDetails?: unknown }).outputDetails;
      if (!Array.isArray(details)) continue;
      for (const detail of details) {
        const filePaths =
          (detail as { OutputFilePaths?: unknown; outputFilePaths?: unknown }).OutputFilePaths ??
          (detail as { outputFilePaths?: unknown }).outputFilePaths;
        if (!Array.isArray(filePaths)) continue;
        for (const p of filePaths) {
          if (typeof p === "string" && p.startsWith("s3://")) paths.push(p);
        }
      }
    }
  }
  if (paths[0]) return paths[0];

  const settings = job.Settings;
  const outputGroup = settings?.OutputGroups?.[0];
  const destination = outputGroup?.OutputGroupSettings?.FileGroupSettings?.Destination?.trim();
  const nameModifier = outputGroup?.Outputs?.[0]?.NameModifier ?? "_stream";
  const fileInput = settings?.Inputs?.[0]?.FileInput?.trim();

  if (destination && fileInput) {
    const dest = destination.endsWith("/") ? destination : `${destination}/`;
    return `${dest}${inputBaseName(fileInput)}${nameModifier}.mp4`;
  }

  if (meta.outputPrefix && fileInput) {
    const ref = resolveStorageObjectRef(meta.storageRef || meta.sourceUrl || fileInput);
    if (ref) {
      const prefix = meta.outputPrefix.replace(/^\/+/, "").replace(/\/?$/, "/");
      return toS3Uri(ref.bucket, `${prefix}${inputBaseName(fileInput)}${nameModifier}.mp4`);
    }
  }

  return null;
}

function metaFromJob(job: Job): MezzanineJobMeta {
  const metaRaw = job.UserMetadata ?? {};
  const fileInput = job.Settings?.Inputs?.[0]?.FileInput?.trim() || "";
  const sourceUrl = clean(metaRaw.sourceUrl) || fileInput;
  const storageRef = clean(metaRaw.storageRef) || (fileInput.startsWith("s3://") ? fileInput : null);
  return {
    sourceUrl: sourceUrl || "",
    storageRef,
    entityType: clean(metaRaw.entityType),
    entityId: clean(metaRaw.entityId),
    creatorId: clean(metaRaw.creatorId),
    fileName: clean(metaRaw.fileName),
    outputPrefix: clean(metaRaw.outputPrefix),
  };
}

/**
 * Start an H.264 mezzanine job (max ~40 Mbps) so Cloudflare Stream can ingest safely.
 */
export async function startStreamMezzanineJob(meta: MezzanineJobMeta): Promise<MezzanineJobStart> {
  const roleArn = clean(process.env.MEDIACONVERT_ROLE_ARN);
  if (!roleArn) {
    throw new Error("MEDIACONVERT_ROLE_ARN is not configured.");
  }

  const ref =
    (meta.storageRef ? resolveStorageObjectRef(meta.storageRef) : null) ??
    resolveStorageObjectRef(meta.sourceUrl);
  if (!ref) {
    throw new Error("Mezzanine job requires an S3 storage object.");
  }

  const client = await createMediaConvertClient();
  const queue = clean(process.env.MEDIACONVERT_QUEUE_ARN) ?? undefined;
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
  const outputPrefix = `mezzanine/${token}/`;
  const inputUri = toS3Uri(ref.bucket, ref.key);
  const destination = toS3Uri(ref.bucket, outputPrefix);

  const userMetadata: Record<string, string> = {
    sourceUrl: meta.sourceUrl.slice(0, 250),
    purpose: "stream-mezzanine",
    outputPrefix: outputPrefix.slice(0, 120),
  };
  if (meta.storageRef) userMetadata.storageRef = meta.storageRef.slice(0, 250);
  if (meta.entityType) userMetadata.entityType = meta.entityType;
  if (meta.entityId) userMetadata.entityId = meta.entityId;
  if (meta.creatorId) userMetadata.creatorId = meta.creatorId;
  if (meta.fileName) userMetadata.fileName = meta.fileName.slice(0, 120);

  const created = await client.send(
    new CreateJobCommand({
      Role: roleArn,
      Queue: queue,
      UserMetadata: userMetadata,
      Settings: {
        Inputs: [
          {
            FileInput: inputUri,
            AudioSelectors: {
              "Audio Selector 1": {
                DefaultSelection: "DEFAULT",
              },
            },
            VideoSelector: {},
          },
        ],
        OutputGroups: [
          {
            Name: "File Group",
            OutputGroupSettings: {
              Type: "FILE_GROUP_SETTINGS",
              FileGroupSettings: {
                Destination: destination,
              },
            },
            Outputs: [
              {
                NameModifier: "_stream",
                ContainerSettings: {
                  Container: "MP4",
                  Mp4Settings: {
                    MoovPlacement: "PROGRESSIVE_DOWNLOAD",
                  },
                },
                VideoDescription: {
                  CodecSettings: {
                    Codec: "H_264",
                    H264Settings: {
                      RateControlMode: "QVBR",
                      QvbrSettings: {
                        QvbrQualityLevel: 8,
                      },
                      MaxBitrate: STREAM_MEZZANINE_MAX_BITRATE_BPS,
                      SceneChangeDetect: "TRANSITION_DETECTION",
                      CodecProfile: "HIGH",
                      CodecLevel: "AUTO",
                      InterlaceMode: "PROGRESSIVE",
                      GopSize: 90,
                      GopSizeUnits: "FRAMES",
                      NumberBFramesBetweenReferenceFrames: 2,
                    },
                  },
                  // Keep source resolution (do not force 4K upscale); Stream builds the adaptive ladder.
                  ScalingBehavior: "DEFAULT",
                },
                AudioDescriptions: [
                  {
                    AudioSourceName: "Audio Selector 1",
                    CodecSettings: {
                      Codec: "AAC",
                      AacSettings: {
                        Bitrate: 192000,
                        CodingMode: "CODING_MODE_2_0",
                        SampleRate: 48000,
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    }),
  );

  const jobId = created.Job?.Id;
  if (!jobId) {
    throw new Error("MediaConvert did not return a job id.");
  }

  return {
    jobId,
    placeholderUid: mediaConvertPlaceholderUid(jobId),
    outputPrefix,
  };
}

export type MezzanineJobPollResult =
  | { status: "PROGRESSING" | "SUBMITTED" | "UNKNOWN"; progress?: number }
  | { status: "ERROR"; message: string }
  | { status: "COMPLETE"; outputS3Uri: string; meta: MezzanineJobMeta };

function isThrottleError(message: string, name: string): boolean {
  return /Too Many Requests|Throttl|Rate exceeded|429/i.test(`${name} ${message}`);
}

export async function pollStreamMezzanineJob(jobId: string): Promise<MezzanineJobPollResult> {
  try {
    const client = await createMediaConvertClient();
    const res = await client.send(new GetJobCommand({ Id: jobId }));
    const job = res.Job;
    if (!job) {
      return { status: "ERROR", message: "MediaConvert job not found." };
    }

    const meta = metaFromJob(job);
    const status = String(job.Status ?? "UNKNOWN").toUpperCase();
    if (status === "COMPLETE") {
      const outputS3Uri = reconstructMezzanineOutputS3Uri(job, meta);
      if (!outputS3Uri || !meta.sourceUrl) {
        return {
          status: "ERROR",
          message: `MediaConvert completed but output path or source metadata was missing.${
            outputS3Uri ? "" : " (no OutputFilePaths on GetJob — reconstruction failed)"
          }${!meta.sourceUrl ? " (sourceUrl empty)" : ""}`,
        };
      }
      return { status: "COMPLETE", outputS3Uri, meta };
    }

    if (status === "ERROR" || status === "CANCELED") {
      const messages = job.Messages as { Message?: string }[] | { Info?: { Message?: string }[] } | undefined;
      const fromArray = Array.isArray(messages)
        ? messages.map((m) => m.Message).filter(Boolean).join("; ")
        : "";
      const message =
        job.ErrorMessage ||
        fromArray ||
        `MediaConvert job ${status.toLowerCase()}`;
      return { status: "ERROR", message };
    }

    return {
      status: status === "PROGRESSING" || status === "SUBMITTED" ? (status as "PROGRESSING" | "SUBMITTED") : "UNKNOWN",
      progress: typeof job.JobPercentComplete === "number" ? job.JobPercentComplete : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err && typeof err === "object" && "name" in err ? String((err as { name?: string }).name) : "";
    // Never mark the asset failed for API throttling — retry later.
    if (isThrottleError(message, name)) {
      return { status: "UNKNOWN" };
    }
    if (/not\s*found|NotFound|ResourceNotFoundException/i.test(`${name} ${message}`)) {
      return {
        status: "ERROR",
        message: `MediaConvert job not found in region (check MEDIACONVERT_REGION matches the AWS console). ${message}`,
      };
    }
    return { status: "ERROR", message: `MediaConvert GetJob failed: ${message}` };
  }
}
