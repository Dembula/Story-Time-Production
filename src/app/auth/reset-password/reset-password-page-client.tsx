"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  extractPasswordResetTokenFromUrl,
  normalizePasswordResetToken,
} from "@/lib/password-reset-token";
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
  const [token, setToken] = useState(initialToken);

  const pathToken = typeof params?.token === "string" ? params.token : "";
  const queryToken = searchParams.get("token") ?? searchParams.get("reset_token") ?? "";
  const portal = searchParams.get("portal") ?? initialPortal ?? "viewer";

  useEffect(() => {
    const fromUrl =
      extractPasswordResetTokenFromUrl(window.location.href) ||
      normalizePasswordResetToken(pathToken || queryToken || initialToken);
    if (fromUrl) setToken(fromUrl);
  }, [pathToken, queryToken, initialToken]);

  return <ResetPasswordForm token={token} portal={portal} />;
}
