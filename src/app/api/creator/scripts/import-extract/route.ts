import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { persistScriptImport } from "@/lib/script-studio/script-import-service";

export const runtime = "nodejs";
export const maxDuration = 60;

async function ensureCreatorSession() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      userId: null as string | null,
    };
  }

  return { error: null as NextResponse | null, userId };
}

function readFormString(form: FormData | null, key: string): string | null {
  const value = form?.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export async function POST(req: NextRequest) {
  const access = await ensureCreatorSession();
  if (access.error) return access.error;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing script file" }, { status: 400 });
  }

  const scriptId = readFormString(form, "scriptId");
  const projectId = readFormString(form, "projectId");

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await persistScriptImport({
      userId: access.userId!,
      buffer,
      fileName: file.name || "screenplay",
      mimeType: file.type || "",
      scriptId,
      projectId,
    });

    const { extraction } = result;
    if (extraction.error || !extraction.text.trim()) {
      return NextResponse.json(
        {
          error: extraction.error ?? "No readable screenplay text found in this file.",
          importId: result.importId,
          storageUrl: result.storageUrl,
          sourceType: extraction.sourceType,
          extractionMethod: extraction.extractionMethod,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      text: extraction.text,
      sourceType: extraction.sourceType,
      extractionMethod: extraction.extractionMethod,
      importId: result.importId,
      storageUrl: result.storageUrl,
    });
  } catch (err) {
    console.error("Script import failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 },
    );
  }
}
