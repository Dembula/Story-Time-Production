import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess, projectAccessDenied } from "@/lib/project-access";
import { createProjectClause, listProjectClauses, seedDefaultClauseLibrary, seedJurisdictionClausePacks } from "@/lib/legal/clause-library-service";
import { getClausePack, listClausePackJurisdictions } from "@/lib/legal/clause-packs-data";

export async function GET(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const url = new URL(req.url);
  const jurisdiction = url.searchParams.get("jurisdiction") ?? undefined;
  const category = url.searchParams.get("category") ?? undefined;

  const clauses = await listProjectClauses(projectId, { jurisdiction, category });
  return NextResponse.json({
    clauses,
    jurisdictions: listClausePackJurisdictions(),
    samplePack: getClausePack(jurisdiction ?? "South Africa"),
  });
}

export async function POST(req: NextRequest, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (projectAccessDenied(access)) return access.error;

  const body = await req.json().catch(() => ({}));
  if (body.action === "seed_defaults") {
    const result = await seedDefaultClauseLibrary(projectId, access.userId);
    return NextResponse.json(result);
  }

  if (body.action === "seed_jurisdiction_packs") {
    const result = await seedJurisdictionClausePacks(projectId, access.userId);
    return NextResponse.json(result);
  }

  if (!body.title || !body.body) {
    return NextResponse.json({ error: "title and body required" }, { status: 400 });
  }

  const clause = await createProjectClause({
    projectId,
    userId: access.userId,
    title: body.title,
    category: body.category ?? "custom",
    body: body.body,
    jurisdiction: body.jurisdiction ?? null,
    tags: body.tags ?? [],
  });
  return NextResponse.json({ clause });
}
