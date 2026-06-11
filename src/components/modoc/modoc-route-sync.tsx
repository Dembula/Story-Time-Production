"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useModocOptional } from "./use-modoc";
import { derivePageContext, getModocRoleProfile } from "@/lib/modoc/role-config";
import { canShowCreatorVa } from "@/lib/modoc/creator-va";

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
    const profile = getModocRoleProfile(creatorVaActive ? role : undefined);

    let clientContext = `User is on ${pathname}.`;
    if (pageContext.tool) {
      clientContext += ` Active tool: ${pageContext.tool.replace(/-/g, " ")}.`;
    }
    if (pageContext.projectId) {
      clientContext += ` Project ID: ${pageContext.projectId}.`;
    }
    if (creatorVaActive) {
      clientContext +=
        " Creator Virtual Assistant is active — only discuss and act within this creator's own projects and creator workspace.";
    }

    modoc.setRequestContext({
      scope: creatorVaActive ? "creator" : profile.scope,
      clientContext,
      pageContext,
    });
  }, [pathname, role, sessionStatus, modoc]);

  return null;
}
