import Link from "next/link";
import Image from "next/image";

export function LandingFooter() {
  return (
    <footer className="border-t border-white/8 py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="Story Time" width={28} height={28} className="rounded-lg shadow-glow" />
            <div className="flex flex-col">
              <span className="font-semibold tracking-[0.14em] text-slate-200">STORY <span className="storytime-brand-text">TIME</span></span>
              <span className="text-[10px] tracking-wide text-slate-500">STORYTIME STUDIOS (Pty) Ltd</span>
            </div>
          </Link>
          <div className="flex flex-wrap gap-6 text-sm text-slate-400">
            <Link href="/auth/signin" className="hover:text-white">Sign In</Link>
            <Link href="/auth/creator/signin" className="hover:text-white">Creator Portal</Link>
            <Link href="/auth/admin" className="hover:text-white">Admin</Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-white/8 pt-6 text-xs text-slate-500">
          <Link href="/about" className="rounded-full border border-orange-400/40 bg-orange-500/20 px-3 py-1.5 text-orange-200 transition hover:border-orange-300 hover:bg-orange-500/30 hover:text-orange-100">About Us</Link>
          <Link href="/legal/terms" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 transition hover:border-white/20 hover:text-slate-200">Terms of Service</Link>
          <Link href="/legal/regulatory-framework" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 transition hover:border-white/20 hover:text-slate-200">Regulatory Framework</Link>
          <Link href="/legal/privacy" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 transition hover:border-white/20 hover:text-slate-200">Privacy Policy</Link>
          <Link href="/legal/payment-policy" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 transition hover:border-white/20 hover:text-slate-200">Payment Policy</Link>
          <Link href="/legal/refund-policy" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 transition hover:border-white/20 hover:text-slate-200">Refund Policy</Link>
          <Link href="/legal/subscription-terms" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 transition hover:border-white/20 hover:text-slate-200">Subscription Terms</Link>
          <Link href="/legal/content-policy" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 transition hover:border-white/20 hover:text-slate-200">Content Policy</Link>
          <Link href="/legal/cookies" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 transition hover:border-white/20 hover:text-slate-200">Cookie Policy</Link>
          <Link href="/legal/acceptable-use" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 transition hover:border-white/20 hover:text-slate-200">Acceptable Use</Link>
          <Link href="/legal/paia-manual" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 transition hover:border-white/20 hover:text-slate-200">PAIA Manual</Link>
          <Link href="/legal/security-policy" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 transition hover:border-white/20 hover:text-slate-200">Security Policy</Link>
          <Link href="/legal/disclaimer" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 transition hover:border-white/20 hover:text-slate-200">Disclaimer</Link>
          <Link href="/legal/copyright" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 transition hover:border-white/20 hover:text-slate-200">Copyright</Link>
        </div>
        <p className="mt-4 text-xs text-slate-600">&copy; {new Date().getFullYear()} Story Time. All rights reserved. (by STORYTIME STUDIOS (Pty) Ltd)</p>
      </div>
    </footer>
  );
}
