"use client";

import { useParams, useSearchParams } from "next/navigation";
import { normalizePasswordResetToken } from "@/lib/password-reset-token";
import { ResetPasswordForm } from "./reset-password-form";

export function ResetPasswordPageClient({
  initialToken = "",
  initialPortal = "viewer",
}: {
  initialToken?: string;
  initialPortal?: string;
}) {
  const params = useParams();
  const searchParams = useSearchParams();

  const pathToken = typeof params?.token === "string" ? params.token : "";
  const queryToken = searchParams.get("token") ?? "";
  const token = normalizePasswordResetToken(pathToken || queryToken || initialToken);
  const portal = searchParams.get("portal") ?? initialPortal ?? "viewer";

  return <ResetPasswordForm token={token} portal={portal} />;
}
