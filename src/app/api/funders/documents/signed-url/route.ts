import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStorageConfig } from "@/lib/storage-config";

const storage = getStorageConfig();
const s3Client = new S3Client({
  region: storage.region || undefined,
  endpoint: storage.endpoint || undefined,
  credentials:
    storage.accessKeyId && storage.secretAccessKey
      ? {
          accessKeyId: storage.accessKeyId,
          secretAccessKey: storage.secretAccessKey,
        }
      : undefined,
  forcePathStyle: Boolean(storage.endpoint),
});

function parseStorageRef(storageRef: string): { bucket: string; key: string } | null {
  if (!storageRef.startsWith("s3://")) return null;
  const withoutPrefix = storageRef.slice(5);
  const slash = withoutPrefix.indexOf("/");
  if (slash <= 0) return null;
  return {
    bucket: withoutPrefix.slice(0, slash),
    key: withoutPrefix.slice(slash + 1),
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "ADMIN" && user.role !== "FUNDER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const verificationId = req.nextUrl.searchParams.get("verificationId");
  if (!verificationId) {
    return NextResponse.json({ error: "verificationId is required." }, { status: 400 });
  }

  const verification = await prisma.funderVerification.findUnique({
    where: { id: verificationId },
    include: { funderProfile: { select: { userId: true } } },
  });
  if (!verification) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  if (user.role === "FUNDER" && verification.funderProfile.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = parseStorageRef(verification.documentUrl);
  if (!parsed) {
    return NextResponse.json({ error: "Document is not in private storage format." }, { status: 400 });
  }
  const signedUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: parsed.bucket,
      Key: parsed.key,
    }),
    { expiresIn: 60 * 5 },
  );
  return NextResponse.json({ url: signedUrl });
}
