import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isMediaConvertMezzanineConfigured } from "@/lib/mediaconvert-mezzanine";
import { getStorageConfig } from "@/lib/storage-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin diagnostic: confirm MediaConvert auto-compress is actually wired in this deployment. */
export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const storage = getStorageConfig();
  const roleArn = process.env.MEDIACONVERT_ROLE_ARN?.trim() || null;
  const publicFlag = process.env.NEXT_PUBLIC_STREAM_MEZZANINE_ENABLED?.trim() || null;

  return NextResponse.json({
    ok: true,
    mediaConvertConfigured: isMediaConvertMezzanineConfigured(),
    mediaconvertRoleArnSet: Boolean(roleArn),
    mediaconvertRoleArnSuffix: roleArn ? roleArn.slice(-48) : null,
    mediaconvertRegion: process.env.MEDIACONVERT_REGION?.trim() || storage.region || null,
    nextPublicMezzanineEnabled: publicFlag === "true",
    storageBucketSet: Boolean(storage.bucket),
    storageCredentialsSet: Boolean(storage.accessKeyId && storage.secretAccessKey),
    hint: isMediaConvertMezzanineConfigured()
      ? "MediaConvert is configured. High/unknown-bitrate uploads should mezzanine before Stream."
      : "MEDIACONVERT_ROLE_ARN is missing on this deployment — uploads will still hit Stream and fail above 200 Mbps.",
  });
}
