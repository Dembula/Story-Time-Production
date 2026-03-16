import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function CateringMessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/auth/signin");
  if ((session.user as { role?: string }).role !== "CATERING_COMPANY") redirect("/catering-company/dashboard");

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-semibold text-white mb-4">Messages</h1>
      <p className="text-slate-400 mb-6">Conversations with creators about catering bookings appear here after they have completed payment.</p>
      <div className="rounded-2xl bg-slate-800/30 border border-slate-700/50 p-12 text-center text-slate-500">
        <p>Message threads will appear when creators message you about a paid booking.</p>
        <Link href="/catering-company/bookings" className="inline-block mt-4 text-orange-500 hover:text-orange-400 font-medium">View bookings</Link>
      </div>
    </div>
  );
}
