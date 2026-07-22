import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ListJobsCommand } from "@aws-sdk/client-mediaconvert";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isMediaConvertMezzanineConfigured,
  mediaConvertJobIdFromPlaceholderUid,
  pollStreamMezzanineJob,
} from "@/lib/mediaconvert-mezzanine";
import { getStorageConfig } from "@/lib/storage-config";
import { recoverFromStreamBitrateFailure } from "@/lib/stream-encode-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PlaceholderRow = {
  uid: string;
  sourceUrl: string;
  status: string | null;
  lastError: string | null;
  entityType: string | null;
  entityId: string | null;
  updatedAt: Date;
};

/** Admin diagnostic: confirm MediaConvert auto-compress is wired and inspect stuck jobs. */
export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const storage = getStorageConfig();
  const roleArn = process.env.MEDIACONVERT_ROLE_ARN?.trim() || null;
  const publicFlag = process.env.NEXT_PUBLIC_STREAM_MEZZANINE_ENABLED?.trim() || null;
  const region =
    process.env.MEDIACONVERT_REGION?.trim() || storage.region || null;

  let placeholders: PlaceholderRow[] = [];
  try {
    placeholders = (await prisma.$queryRaw`
      SELECT "uid", "sourceUrl", "status", "lastError", "entityType", "entityId", "updatedAt"
      FROM "StreamAsset"
      WHERE lower(coalesce("status", '')) = 'mezzanining'
         OR "uid" LIKE 'mc_%'
      ORDER BY "updatedAt" DESC
      LIMIT 20
    `) as PlaceholderRow[];
  } catch (err) {
    console.error("encode-health placeholder query failed:", err);
  }

  const placeholderProbes = await Promise.all(
    placeholders.slice(0, 10).map(async (row) => {
      const jobId = mediaConvertJobIdFromPlaceholderUid(row.uid);
      if (!jobId) {
        return { ...row, jobId: null, aws: { status: "ERROR", message: "Not an mc_ placeholder uid" } };
      }
      try {
        const aws = await pollStreamMezzanineJob(jobId);
        return { ...row, jobId, aws };
      } catch (err) {
        return {
          ...row,
          jobId,
          aws: {
            status: "ERROR" as const,
            message: err instanceof Error ? err.message : String(err),
          },
        };
      }
    }),
  );

  let recentAwsJobs: Array<{ id?: string; status?: string; createdAt?: string }> = [];
  let listJobsError: string | null = null;
  if (isMediaConvertMezzanineConfigured() && storage.accessKeyId && storage.secretAccessKey && region) {
    try {
      const { createMediaConvertClientForAdmin } = await import("@/lib/mediaconvert-mezzanine");
      const client = await createMediaConvertClientForAdmin();
      const listed = await client.send(new ListJobsCommand({ MaxResults: 10, Order: "DESCENDING" }));
      recentAwsJobs = (listed.Jobs ?? []).map((j) => ({
        id: j.Id,
        status: j.Status,
        createdAt: j.CreatedAt?.toISOString?.() ?? undefined,
      }));
    } catch (err) {
      listJobsError = err instanceof Error ? err.message : String(err);
    }
  }

  return NextResponse.json({
    ok: true,
    mediaConvertConfigured: isMediaConvertMezzanineConfigured(),
    mediaconvertRoleArnSet: Boolean(roleArn),
    mediaconvertRoleArnSuffix: roleArn ? roleArn.slice(-48) : null,
    mediaconvertRegion: region,
    consoleJobsUrl: region
      ? `https://${region}.console.aws.amazon.com/mediaconvert/home?region=${region}#/jobs/list`
      : null,
    nextPublicMezzanineEnabled: publicFlag === "true",
    storageBucketSet: Boolean(storage.bucket),
    storageCredentialsSet: Boolean(storage.accessKeyId && storage.secretAccessKey),
    placeholders: placeholderProbes,
    recentAwsJobs,
    listJobsError,
    hint: !isMediaConvertMezzanineConfigured()
      ? "MEDIACONVERT_ROLE_ARN is missing on this deployment — uploads will still hit Stream and fail above 200 Mbps."
      : listJobsError
        ? `MediaConvert ListJobs failed in ${region}: ${listJobsError}. Check IAM (CreateJob/GetJob/ListJobs + PassRole) and that you open the console in this exact region.`
        : recentAwsJobs.length === 0 && placeholderProbes.length > 0
          ? "DB shows mezzanining placeholders but AWS has no recent jobs — Approve again (or POST /api/admin/encode-health with {\"restart\":true,\"sourceUrl\":\"...\"}) to recreate CreateJob."
          : "MediaConvert is configured. Open consoleJobsUrl in the reported region to watch compress progress.",
  });
}

/** Force-restart mezzanine for a stuck source URL (or Content entityId). */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isMediaConvertMezzanineConfigured()) {
    return NextResponse.json(
      { error: "MEDIACONVERT_ROLE_ARN is not set on this deployment." },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    restart?: boolean;
    sourceUrl?: string;
    contentId?: string;
  };

  if (!body.restart) {
    return NextResponse.json({ error: "Pass { restart: true, sourceUrl } or { restart: true, contentId }" }, { status: 400 });
  }

  let sourceUrl = body.sourceUrl?.trim() || null;
  let entityId = body.contentId?.trim() || null;

  if (!sourceUrl && entityId) {
    const content = await prisma.content.findUnique({
      where: { id: entityId },
      select: { videoUrl: true },
    });
    sourceUrl = content?.videoUrl?.trim() || null;
  }

  if (!sourceUrl) {
    return NextResponse.json({ error: "sourceUrl or contentId with a main videoUrl is required." }, { status: 400 });
  }

  const result = await recoverFromStreamBitrateFailure({
    sourceUrl,
    lastError: "bitrate exceeds 200Mbps",
    entityType: "Content",
    entityId,
    forceRestart: true,
  });

  const region =
    process.env.MEDIACONVERT_REGION?.trim() ||
    getStorageConfig().region ||
    null;

  return NextResponse.json({
    ok: true,
    asset: result,
    message:
      result?.status?.toLowerCase() === "mezzanining"
        ? `Fresh MediaConvert job queued. Watch Jobs in region ${region}.`
        : result?.status?.toLowerCase() === "error"
          ? "Mezzanine restart failed — open GET /api/admin/encode-health for details."
          : `Restart finished with status ${result?.status ?? "null"}.`,
    consoleJobsUrl: region
      ? `https://${region}.console.aws.amazon.com/mediaconvert/home?region=${region}#/jobs/list`
      : null,
  });
}
