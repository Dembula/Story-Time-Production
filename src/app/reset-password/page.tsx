import { redirect } from "next/navigation";

export default async function ResetPasswordLegacyEntry({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ? `?token=${encodeURIComponent(params.token)}` : "";
  redirect(`/auth/reset-password${token}`);
}
