import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getTemplateByType,
  mapLegacyContractType,
  type ContractTemplateType,
} from "@/lib/contract-template-engine";
import {
  buildRenderedContract,
  emptyFieldValues,
  mergeFieldValues,
  projectFieldValues,
  resourceFieldValues,
} from "@/lib/contract-prefill";
import {
  buildContractResourceContext,
  findResourceInContext,
} from "@/lib/contract-resource-context";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;
  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        templateType?: ContractTemplateType;
        projectId?: string | null;
        resourceType?: string;
        resourceId?: string | null;
        fields?: Record<string, string>;
        templateBody?: string | null;
      }
    | null;

  if (!body?.templateType) {
    return NextResponse.json({ error: "Missing templateType" }, { status: 400 });
  }

  const templateType = mapLegacyContractType(body.templateType);
  const template = getTemplateByType(templateType);

  let merged = emptyFieldValues();
  let resourceContext = null;

  if (body.projectId) {
    resourceContext = await buildContractResourceContext(body.projectId, userId);
    if (resourceContext) {
      merged = mergeFieldValues(merged, projectFieldValues(resourceContext.project));
      const resource = findResourceInContext(
        resourceContext,
        body.resourceType ?? "GENERAL",
        body.resourceId,
      );
      if (resource) merged = mergeFieldValues(merged, resourceFieldValues(resource));
    }
  }

  merged = mergeFieldValues(merged, body.fields ?? {});

  const rendered = buildRenderedContract(
    templateType,
    merged,
    body.templateBody ?? template.body,
  );

  return NextResponse.json({
    templateType,
    fields: merged,
    rendered,
    resourceContext,
    legalReferences: template.legalReferences,
  });
}
