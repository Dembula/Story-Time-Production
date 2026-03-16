import Link from "next/link";

export function LandingCta() {
  return (
    <section className="py-20 px-6 bg-slate-900/30 border-t border-slate-800/40">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white tracking-tight">Are you a creator?</h2>
        <p className="text-slate-400 mb-10 text-lg">
          Upload your films, series, podcasts, or music. Track your stats, grow your audience, and earn from every view.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/auth/creator/signup" className="px-8 py-3.5 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition shadow-lg shadow-orange-500/20">
            Creator Sign Up
          </Link>
          <Link href="/auth/creator/signin" className="px-8 py-3.5 rounded-xl border border-slate-600 text-white font-semibold hover:bg-slate-800/50 transition">
            Creator Sign In
          </Link>
        </div>
      </div>
    </section>
  );
}
