import { NextRequest, NextResponse } from "next/server";
import { ensureProjectFinanceAccess } from "@/lib/financial-ops-access";
import {
  createProjectVendor,
  listProjectVendors,
  syncVendorsFromContracts,
  updateProjectVendor,
} from "@/lib/vendor-service";
import {
  getVendorIntelligence,
  rebuildProjectVendorIntelligence,
  searchGlobalVendors,
} from "@/lib/financial-ops/vendor-intelligence-service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectFinanceAccess(projectId);
  if (access.error) return access.error;

  const url = new URL(req.url);
  const vendorId = url.searchParams.get("vendorId");
  if (vendorId) {
    const intel = await getVendorIntelligence(projectId, vendorId);
    if (!intel) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(intel);
  }
  const q = url.searchParams.get("q");
  if (q) {
    const global = await searchGlobalVendors(q);
    return NextResponse.json({ global });
  }

  const vendors = await listProjectVendors(projectId);
  return NextResponse.json({ vendors });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectFinanceAccess(projectId);
  if (access.error || !access.userId) return access.error;

  const body = await req.json().catch(() => ({}));
  if (body.action === "sync_from_contracts") {
    const created = await syncVendorsFromContracts(projectId, access.userId);
    return NextResponse.json({ created, count: created.length });
  }
  if (body.action === "rebuild_intelligence") {
    const result = await rebuildProjectVendorIntelligence(projectId);
    return NextResponse.json(result);
  }

  const vendor = await createProjectVendor({
    projectId,
    userId: access.userId,
    displayName: String(body.displayName ?? ""),
    vendorType: body.vendorType,
    contactEmail: body.contactEmail,
    contactPhone: body.contactPhone,
    taxNumber: body.taxNumber,
    paymentTerms: body.paymentTerms,
    bankDetails: body.bankDetails,
    notes: body.notes,
  });

  return NextResponse.json({ vendor });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await context.params;
  const access = await ensureProjectFinanceAccess(projectId);
  if (access.error) return access.error;

  const body = await req.json().catch(() => ({}));
  const vendorId = body.vendorId as string | undefined;
  if (!vendorId) return NextResponse.json({ error: "vendorId required" }, { status: 400 });

  const vendor = await updateProjectVendor(vendorId, projectId, body);
  if (!vendor) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ vendor });
}
