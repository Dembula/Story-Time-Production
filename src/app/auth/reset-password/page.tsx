import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; portal?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";
  const portal = params.portal ?? "viewer";
  return <ResetPasswordForm token={token} portal={portal} />;
}
