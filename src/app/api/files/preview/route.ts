import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertSecureFileAccess, isPlatformStorageReference, type SecureFileAccessContext } from "@/lib/secure-file-access";
import { getStorageObjectStream } from "@/lib/storage-object-fetch";
import { resolveTalentPortalToken } from "@/lib/stakeholder-ecosystem/talent-portal-service";
import { resolveStorageObjectRef } from "@/lib/storage-object-ref";

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

function buildPreviewHeaders(stream: Awaited<ReturnType<typeof getStorageObjectStream>>) {
  const headers = new Headers({
    "Content-Type": stream.contentType,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
    "Accept-Ranges": stream.acceptRanges,
  });
  if (stream.contentLength != null) {
    headers.set("Content-Length", String(stream.contentLength));
  }
  if (stream.contentRange) {
    headers.set("Content-Range", stream.contentRange);
  }
  return headers;
}

async function streamPreviewResponse(
  ref: NonNullable<ReturnType<typeof resolveStorageObjectRef>>,
  rangeHeader: string | null,
) {
  const stream = await getStorageObjectStream(ref, { rangeHeader });
  return new NextResponse(stream.body as unknown as BodyInit, {
    status: stream.statusCode,
    headers: buildPreviewHeaders(stream),
  });
}

/** Stream a platform storage object after auth — never expose the raw S3 bucket URL to the client. */
export async function GET(req: NextRequest) {
  const fileRef = req.nextUrl.searchParams.get("ref");
  if (!fileRef?.trim()) {
    return NextResponse.json({ error: "ref is required" }, { status: 400 });
  }

  const rangeHeader = req.headers.get("range");

  const portalToken = req.nextUrl.searchParams.get("portalToken");
  if (portalToken) {
    const row = await resolveTalentPortalToken(portalToken);
    if (!row) return NextResponse.json({ error: "Invalid portal token" }, { status: 401 });
    const allowed = [row.talent.headshotUrl, row.talent.cvUrl, row.talent.reelUrl].filter(Boolean) as string[];
    const normalized = allowed
      .filter(isPlatformStorageReference)
      .map((url) => resolveStorageObjectRef(url))
      .filter(Boolean);
    const requested = resolveStorageObjectRef(fileRef);
    if (!requested || !normalized.some((r) => r!.bucket === requested.bucket && r!.key === requested.key)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
      return await streamPreviewResponse(requested, rangeHeader);
    } catch {
      return NextResponse.json({ error: "Could not load file" }, { status: 404 });
    }
  }

  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await assertSecureFileAccess(user.id, user.role ?? "", fileRef, parseContext(req));
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    return await streamPreviewResponse(access.ref, rangeHeader);
  } catch (error) {
    console.error("secure file preview failed", error);
    return NextResponse.json({ error: "Could not load file" }, { status: 404 });
  }
}
