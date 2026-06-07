import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getContractTemplates,
  getDefaultDisclaimer,
  getTemplatePlaceholders,
} from "@/lib/contract-template-engine";

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  if (!session || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    templates: getContractTemplates().map((t) => ({
      type: t.type,
      label: t.label,
      description: t.description,
      body: t.body,
      placeholders: getTemplatePlaceholders(t.body),
      resourceKinds: t.resourceKinds,
      legalReferences: t.legalReferences,
    })),
    defaultDisclaimer: getDefaultDisclaimer(),
  });
}
