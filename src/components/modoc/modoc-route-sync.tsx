"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useModocOptional } from "./use-modoc";
import { derivePageContext, getModocRoleProfile } from "@/lib/modoc/role-config";
import { canShowCreatorVa } from "@/lib/modoc/creator-va";
import { canShowViewerModoc } from "@/lib/modoc/viewer-va";
import {
  describeClientSurface,
  detectModocClientSurface,
} from "@/lib/modoc/client-surface";
import {
  getActiveMeetSnapshot,
  subscribeActiveMeet,
} from "@/lib/meet/active-session";

/** Keeps MODOC request context in sync with the current route and user role. */
export function ModocRouteSync() {
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const modoc = useModocOptional();
  const meetSnap = useSyncExternalStore(
    subscribeActiveMeet,
    getActiveMeetSnapshot,
    getActiveMeetSnapshot,
  );
  const role = (session?.user as { role?: string } | undefined)?.role;
  const activeMeet = meetSnap.call;
  const meetMinimized = meetSnap.minimized;

  useEffect(() => {
    if (!modoc) return;

    const pageContext = derivePageContext(pathname);
    const creatorVaActive = canShowCreatorVa({ sessionStatus, role, pathname });
    const viewerModocActive = canShowViewerModoc({ sessionStatus, role, pathname });
    const profile = getModocRoleProfile(creatorVaActive || viewerModocActive ? role : undefined);
    const surface = detectModocClientSurface();

    let clientContext = `User is on ${pathname}. Client surface: ${surface} (${describeClientSurface(surface)}).`;
    if (pageContext.tool) {
      clientContext += ` Active tool: ${pageContext.tool.replace(/-/g, " ")}.`;
    }
    if (pageContext.projectId) {
      clientContext += ` Project ID: ${pageContext.projectId}.`;
    }
    if (pageContext.contentId) {
      clientContext += ` Viewing content ID: ${pageContext.contentId}.`;
    }
    if (activeMeet) {
      clientContext += ` The creator is currently in a live Story Time Meet titled "${activeMeet.title}" (code ${activeMeet.code}, meetingId ${activeMeet.meetingId})${
        meetMinimized ? " — Meet is minimized while they multitask in the creator dashboard" : ""
      }. Prefer Meet-aware help (notes, invites, waiting room, summaries) and do not assume they left the call.`;
      pageContext.area = "meet";
      pageContext.tool = "meet";
      pageContext.inMeet = "true";
      pageContext.meetingId = activeMeet.meetingId;
      pageContext.meetingCode = activeMeet.code;
      pageContext.meetingTitle = activeMeet.title;
      pageContext.meetMinimized = meetMinimized ? "true" : "false";
    }
    if (creatorVaActive) {
      clientContext +=
        " Creator Virtual Assistant is active — only discuss and act within this creator's own projects and creator workspace.";
      if (surface === "native_ios" || surface === "native_android") {
        clientContext +=
          " Native app: prefer update/status help; for full studio tools direct them to the Story Time web creator dashboard.";
      }
    } else if (viewerModocActive) {
      clientContext +=
        " Viewer MODOC is active — help discover titles, search scenes in the published catalogue, and recommend based on watch history. Only suggest published Story Time titles.";
    }

    modoc.setRequestContext({
      scope: creatorVaActive ? "creator" : profile.scope,
      clientContext,
      pageContext: {
        ...pageContext,
        clientSurface: surface,
      },
    });
  }, [pathname, role, sessionStatus, modoc, activeMeet, meetMinimized]);

  return null;
}
