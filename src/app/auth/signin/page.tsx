import { redirect } from "next/navigation";
import { safeCallbackPath } from "@/lib/auth-callback-path";
import { resolvePortalSignInRedirect } from "@/lib/auth-sign-in-path";
import { SignInClient } from "./sign-in-client";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeCallbackPath(params.callbackUrl);
  const portalRedirect = resolvePortalSignInRedirect("/auth/signin", callbackUrl);
  if (portalRedirect) redirect(portalRedirect);

  return <SignInClient callbackUrl={callbackUrl} />;
}
