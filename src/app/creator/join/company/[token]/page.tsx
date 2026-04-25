import { JoinCompanyInviteClient } from "./join-company-invite-client";

export default async function JoinCompanyInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="min-h-screen bg-background px-6 py-16 text-slate-100">
      <JoinCompanyInviteClient token={token} />
    </div>
  );
}
