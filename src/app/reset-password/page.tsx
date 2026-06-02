import { redirect } from "next/navigation";
import { normalizePasswordResetToken } from "@/lib/password-reset-token";

export default async function ResetPasswordLegacyEntry({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; portal?: string }>;
}) {
  const params = await searchParams;
  const token = normalizePasswordResetToken(params.token);
  if (token) {
    const portal = params.portal ? `&portal=${encodeURIComponent(params.portal)}` : "";
    redirect(`/auth/reset-password?token=${encodeURIComponent(token)}${portal}`);
  }
  redirect("/auth/forgot-password");
}
