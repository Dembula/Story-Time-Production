import { NextRequest, NextResponse } from "next/server";
import { ensureProjectAccess } from "@/lib/project-access";
import { buildDepartmentWorkspace, listDepartmentIds } from "@/lib/breakdown/department-workspace";
import type { BreakdownDepartmentId } from "@/lib/breakdown/types";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectAccess(projectId);
  if (access.error) return access.error;

  const departmentId = req.nextUrl.searchParams.get("department") as BreakdownDepartmentId | null;
  if (!departmentId || !listDepartmentIds().includes(departmentId)) {
    return NextResponse.json(
      { error: "department query param required", departments: listDepartmentIds() },
      { status: 400 },
    );
  }

  const workspace = await buildDepartmentWorkspace(projectId, departmentId);
  return NextResponse.json({ workspace });
}
