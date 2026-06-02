import { Suspense } from "react";
import { ResetPasswordPageClient } from "../reset-password-page-client";

export default async function ResetPasswordWithTokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ portal?: string }>;
}) {
  const { token: rawToken } = await params;
  const { portal } = await searchParams;

  let token = rawToken;
  try {
    token = decodeURIComponent(rawToken);
  } catch {
    // use raw segment when not encoded
  }

  return (
    <Suspense fallback={null}>
      <ResetPasswordPageClient initialToken={token} initialPortal={portal ?? "viewer"} />
    </Suspense>
  );
}
