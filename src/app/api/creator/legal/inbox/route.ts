import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SIGNED_CONTRACT_STATUSES } from "@/lib/contract-template-engine";
import { contractStatusLabel } from "@/lib/contract-lifecycle";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contracts = await prisma.projectContract.findMany({
    where: { counterpartyUserId: userId },
    orderBy: { updatedAt: "desc" },
    include: {
      project: { select: { id: true, title: true } },
      createdBy: { select: { id: true, name: true } },
      versions: { orderBy: { version: "desc" }, take: 1 },
      signatures: { orderBy: { signedAt: "asc" } },
    },
  });

  type InboxItem = {
    id: string;
    projectId: string;
    projectTitle: string;
    title: string;
    type: string;
    status: string;
    statusLabel: string;
    sentAt: string | null;
    signatureDeadline: string | null;
    senderName: string | null;
    recipientLabel: string | null;
    requiredAction: string | null;
    signaturesCount: number;
    preview: string | null;
    updatedAt: string;
  };

  const buckets: {
    waitingForYou: InboxItem[];
    pending: InboxItem[];
    completed: InboxItem[];
    rejected: InboxItem[];
    drafts: InboxItem[];
  } = {
    waitingForYou: [],
    pending: [],
    completed: [],
    rejected: [],
    drafts: [],
  };

  const items: InboxItem[] = contracts.map((c) => {
    const waiting =
      ["SENT", "VIEWED", "CHANGES_REQUESTED", "AWAITING_SIGNATURE"].includes(c.status);
    let requiredAction: string | null = null;
    if (waiting) requiredAction = "Review and sign";
    else if (c.status === "PARTIALLY_SIGNED") requiredAction = "Awaiting producer counter-signature";

    const row: InboxItem = {
      id: c.id,
      projectId: c.projectId,
      projectTitle: c.project.title,
      title: c.subject ?? c.type,
      type: c.type,
      status: c.status,
      statusLabel: contractStatusLabel(c.status),
      sentAt: c.sentAt?.toISOString() ?? null,
      signatureDeadline: c.signatureDeadline?.toISOString() ?? null,
      senderName: c.createdBy?.name ?? null,
      recipientLabel: c.recipientLabel ?? c.vendorName,
      requiredAction,
      signaturesCount: c.signatures.length,
      preview: c.versions[0]?.terms?.slice(0, 280) ?? null,
      updatedAt: c.updatedAt.toISOString(),
    };
    return row;
  });

  for (const item of items) {
    if (["SENT", "VIEWED", "AWAITING_SIGNATURE", "CHANGES_REQUESTED"].includes(item.status)) {
      buckets.waitingForYou.push(item);
    } else if (item.status === "PARTIALLY_SIGNED") {
      buckets.pending.push(item);
    } else if (SIGNED_CONTRACT_STATUSES.has(item.status) || item.status === "EXECUTED" || item.status === "COMPLETED") {
      buckets.completed.push(item);
    } else if (item.status === "REJECTED" || item.status === "CANCELLED" || item.status === "EXPIRED") {
      buckets.rejected.push(item);
    } else {
      buckets.drafts.push(item);
    }
  }

  return NextResponse.json({
    total: items.length,
    contracts: items,
    buckets,
  });
}
