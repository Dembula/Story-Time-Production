import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureProjectAccess } from "@/lib/project-access";
import { extractPdfTextFromBuffer } from "@/lib/ai-metadata/pdf-text-extract";
import { parseEquipmentPlanText } from "@/lib/equipment-plan-import";

interface Params {
  params: Promise<{ projectId: string }>;
}

const MAX_BYTES = 8 * 1024 * 1024;

async function textFromUpload(file: File): Promise<string> {
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (type.includes("pdf") || name.endsWith(".pdf")) {
    const extracted = await extractPdfTextFromBuffer(buffer);
    if (!extracted.text?.trim()) {
      throw new Error("Could not read text from that PDF. Try a text-based PDF, CSV, or TXT list.");
    }
    return extracted.text;
  }

  return buffer.toString("utf8");
}

export async function POST(req: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const contentType = req.headers.get("content-type") || "";
  let rawText = "";
  let sourceName = "paste";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const pasted = form.get("text");
      if (file instanceof File && file.size > 0) {
        if (file.size > MAX_BYTES) {
          return NextResponse.json({ error: "File too large (max 8MB)." }, { status: 400 });
        }
        sourceName = file.name || "upload";
        rawText = await textFromUpload(file);
      } else if (typeof pasted === "string" && pasted.trim()) {
        rawText = pasted;
        sourceName = "paste";
      } else {
        return NextResponse.json({ error: "Upload a PDF, CSV, or TXT equipment list." }, { status: 400 });
      }
    } else {
      const body = (await req.json().catch(() => null)) as { text?: string } | null;
      if (!body?.text?.trim()) {
        return NextResponse.json({ error: "text is required" }, { status: 400 });
      }
      rawText = body.text;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read import file" },
      { status: 400 },
    );
  }

  const rows = parseEquipmentPlanText(rawText);
  if (rows.length === 0) {
    return NextResponse.json(
      {
        error:
          "No equipment rows found. Use one item per line (e.g. “2x Tripod” or “Camera,2,Arri Alexa”).",
      },
      { status: 400 },
    );
  }

  const created = await prisma.$transaction(
    rows.map((row) =>
      prisma.equipmentPlanItem.create({
        data: {
          projectId,
          category: row.category,
          quantity: row.quantity,
          description: row.description,
        },
      }),
    ),
  );

  return NextResponse.json({
    ok: true,
    sourceName,
    imported: created.length,
    items: created,
  });
}
