import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extractScreenplayFromFileBuffer } from "@/lib/ai-metadata/extract-script-document";

export const runtime = "nodejs";

async function ensureCreatorSession() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;

  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { error: null as NextResponse | null };
}

export async function POST(req: NextRequest) {
  const access = await ensureCreatorSession();
  if (access.error) return access.error;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing script file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await extractScreenplayFromFileBuffer(buffer, file.name, file.type);

  if (result.error || !result.text.trim()) {
    return NextResponse.json(
      { error: result.error ?? "No readable screenplay text found in this file." },
      { status: 422 },
    );
  }

  return NextResponse.json({
    text: result.text,
    sourceType: result.sourceType,
  });
}
