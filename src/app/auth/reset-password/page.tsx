import { Suspense } from "react";
import { redirect } from "next/navigation";
import { normalizePasswordResetToken } from "@/lib/password-reset-token";
import { ResetPasswordPageClient } from "./reset-password-page-client";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; portal?: string }>;
}) {
  const params = await searchParams;
  const token = normalizePasswordResetToken(params.token);
  if (token) {
    const portal = params.portal ? `?portal=${encodeURIComponent(params.portal)}` : "";
    redirect(`/auth/reset-password/${encodeURIComponent(token)}${portal}`);
  }

  return (
    <Suspense fallback={null}>
      <ResetPasswordPageClient
        initialToken={params.token ?? ""}
        initialPortal={params.portal ?? "viewer"}
      />
    </Suspense>
  );
}
