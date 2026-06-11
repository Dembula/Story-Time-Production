import { redirect } from "next/navigation";
import { safeCallbackPath } from "@/lib/auth-callback-path";
import {
  defaultCreatorRoleForPath,
  resolvePortalSignInRedirect,
} from "@/lib/auth-sign-in-path";
import { CreatorSignInClient } from "./creator-sign-in-client";

export default async function CreatorSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackPath = safeCallbackPath(params.callbackUrl);
  const portalRedirect = resolvePortalSignInRedirect("/auth/creator/signin", callbackPath);
  if (portalRedirect) redirect(portalRedirect);

  return (
    <CreatorSignInClient
      callbackPath={callbackPath}
      defaultRole={defaultCreatorRoleForPath(callbackPath)}
    />
  );
}
