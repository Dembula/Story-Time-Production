import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  assertSecureFileAccess,
  type SecureFileAccessContext,
} from "@/lib/secure-file-access";
import { getStorageObjectSignedUrl } from "@/lib/storage-object-fetch";

export const runtime = "nodejs";

function parseContext(req: NextRequest): SecureFileAccessContext | undefined {
  const kind = req.nextUrl.searchParams.get("context");
  if (kind === "project") {
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (projectId) return { kind: "project", projectId };
  }
  if (kind === "admin") return { kind: "admin" };
  if (kind === "marketplace") return { kind: "marketplace" };
  return { kind: "marketplace" };
}

/**
 * Short-lived signed URL for browser media playback.
 * Prefer this over proxying large videos through /api/files/preview —
 * S3 serves byte ranges natively so seek/play work reliably.
 */
export async function GET(req: NextRequest) {
  const fileRef = req.nextUrl.searchParams.get("ref");
  if (!fileRef?.trim()) {
    return NextResponse.json({ error: "ref is required" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await assertSecureFileAccess(
    user.id,
    user.role ?? "",
    fileRef,
    parseContext(req),
  );
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const expiresIn = 60 * 60; // 1 hour
    const url = await getStorageObjectSignedUrl(access.ref, expiresIn);
    return NextResponse.json({
      url,
      expiresIn,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    });
  } catch (error) {
    console.error("signed url failed", error);
    return NextResponse.json({ error: "Could not sign file URL" }, { status: 500 });
  }
}
