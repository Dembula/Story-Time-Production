import { Suspense } from "react";
import { normalizePasswordResetToken } from "@/lib/password-reset-token";
import { ResetPasswordPageClient } from "./reset-password-page-client";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; portal?: string }>;
}) {
  const params = await searchParams;
  const token = normalizePasswordResetToken(params.token);

  return (
    <Suspense fallback={null}>
      <ResetPasswordPageClient
        initialToken={token}
        initialPortal={params.portal ?? "viewer"}
      />
    </Suspense>
  );
}
