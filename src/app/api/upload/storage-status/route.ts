import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getStorageConfig } from "@/lib/storage-config";
import { getAllowedStorageBaseUrls } from "@/lib/storage-origin";

/** Lightweight check that S3 env is present (for company upload forms). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storage = getStorageConfig();
  const configured = Boolean(storage.bucket && storage.region && storage.accessKeyId && storage.secretAccessKey);
  const publicBase = storage.publicBaseUrl;

  return NextResponse.json({
    configured,
    bucket: storage.bucket || null,
    region: storage.region || null,
    publicBaseUrl: publicBase || null,
    allowedOrigins: getAllowedStorageBaseUrls(),
    /** Legacy server-proxy limit; client prefers presigned direct upload for all sizes. */
    directUploadMaxMb: 4,
    presignAvailable: configured,
    directToStorage: configured,
  });
}
