import { NextResponse } from "next/server";

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";

import { prisma } from "@/lib/prisma";

import {

  buildReviewPermissions,

  resolveReviewCollaborationMode,

  type ReviewPermissions,

} from "@/lib/script-review/permissions";



export type ReviewAccessResult = {

  userId: string;

  isAdmin: boolean;

  memberRole: string | null;

  isOwner: boolean;

  permissions: ReviewPermissions;

};



export async function ensureReviewProjectAccess(projectId: string) {

  const session = await getServerSession(authOptions);

  const role = (session?.user as { role?: string })?.role;

  const userId = (session?.user as { id?: string })?.id;



  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "ADMIN")) {

    return {

      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),

      userId: null as string | null,

      access: null as ReviewAccessResult | null,

    };

  }



  const project = await prisma.originalProject.findUnique({

    where: { id: projectId },

    include: { members: true, pitches: true },

  });



  if (!project) {

    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }), userId: null, access: null };

  }



  const isAdmin = role === "ADMIN";

  const member = project.members.find((m) => m.userId === userId);

  const isOwner =

    project.pitches.some((p) => p.creatorId === userId) ||

    member?.role?.toLowerCase().includes("owner") === true;



  const isCreatorMember =

    isAdmin || !!member || project.pitches.some((p) => p.creatorId === userId);



  if (!isCreatorMember) {

    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), userId: null, access: null };

  }



  const mode = resolveReviewCollaborationMode({

    isAdmin,

    isOwner,

    memberRole: member?.role ?? null,

  });



  const access: ReviewAccessResult = {

    userId,

    isAdmin,

    memberRole: member?.role ?? null,

    isOwner,

    permissions: buildReviewPermissions({ mode, isAdmin }),

  };



  return { error: null as NextResponse | null, userId, access };

}



export async function ensureReviewProjectAccessForExecutive(

  projectId: string,

  reviewRequestId?: string | null,

) {

  const gate = await ensureReviewProjectAccess(projectId);

  if (gate.error || !gate.access) return gate;



  if (gate.access.isAdmin && reviewRequestId) {

    const mode = resolveReviewCollaborationMode({

      isAdmin: true,

      isOwner: gate.access.isOwner,

      memberRole: gate.access.memberRole,

      executiveReviewActive: true,

    });

    return {

      ...gate,

      access: {

        ...gate.access,

        permissions: buildReviewPermissions({ mode, isAdmin: true }),

      },

    };

  }



  return gate;

}


