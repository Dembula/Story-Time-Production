import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CompanyAccountControlClient } from "./company-account-control-client";

export default async function CompanyAccountControlPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string })?.role;
  const userId = (session?.user as { id?: string })?.id;
  if (!session || !userId || (role !== "CONTENT_CREATOR" && role !== "MUSIC_CREATOR")) {
    redirect("/auth/signin");
  }

  const owned = await prisma.studioCompany.count({ where: { ownerUserId: userId } });
  const backHref = role === "MUSIC_CREATOR" ? "/music-creator/dashboard" : "/creator/command-center";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-8">
      <div className="mb-2">
        <Link href={backHref} className="text-sm text-slate-400 hover:text-white">
          ← Back
        </Link>
      </div>
      <header className="storytime-plan-card p-5 md:p-6">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-orange-300/80">Studio</p>
        <h1 className="font-display text-2xl font-semibold text-white md:text-3xl">Account control</h1>
        <p className="mt-2 text-sm text-slate-400">
          Invite collaborators by email, choose which product areas they may use, and manage pending invitations.
        </p>
      </header>
      {owned === 0 ? (
        <div className="storytime-plan-card space-y-4 p-6 text-sm text-slate-400">
          <p className="text-slate-200">
            You do not have a <strong className="text-white">studio company</strong> you own yet, so there is no team
            to invite here.
          </p>
          <p>
            Register or complete onboarding as a <span className="text-slate-200">company</span> creator, or open{" "}
            <Link
              href={role === "MUSIC_CREATOR" ? "/music-creator/company" : "/creator/company"}
              className="text-orange-300 hover:underline"
            >
              Company admin
            </Link>{" "}
            if you already have a workspace.
          </p>
          <p className="text-xs text-slate-500">
            If you joined someone else&apos;s studio as a member, invites are managed by the owner — you will see team
            invites in your notification bell.
          </p>
        </div>
      ) : (
        <CompanyAccountControlClient />
      )}
    </div>
  );
}
