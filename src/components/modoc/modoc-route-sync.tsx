"use client";

import { useEffect } from "react";
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

/** Keeps MODOC request context in sync with the current route and user role. */
export function ModocRouteSync() {
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const modoc = useModocOptional();
  const role = (session?.user as { role?: string } | undefined)?.role;

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
  }, [pathname, role, sessionStatus, modoc]);

  return null;
}
