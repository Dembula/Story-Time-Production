import Link from "next/link";
import Image from "next/image";

export function LandingFooter() {
  return (
    <footer className="py-12 px-6 border-t border-slate-800/60">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Story Time" width={24} height={24} className="rounded" />
            <span className="font-semibold text-slate-300">STORY TIME</span>
          </Link>
          <div className="flex flex-wrap gap-6 text-sm text-slate-500">
            <Link href="/auth/signin" className="hover:text-slate-300 transition">Sign In</Link>
            <Link href="/auth/creator/signin" className="hover:text-slate-300 transition">Creator Portal</Link>
            <Link href="/auth/admin" className="hover:text-slate-300 transition">Admin</Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500 border-t border-slate-800/60 pt-6">
          <Link href="/legal/terms" className="hover:text-slate-300 transition">Terms of Service</Link>
          <Link href="/legal/privacy" className="hover:text-slate-300 transition">Privacy Policy</Link>
          <Link href="/legal/cookies" className="hover:text-slate-300 transition">Cookie Policy</Link>
          <Link href="/legal/acceptable-use" className="hover:text-slate-300 transition">Acceptable Use</Link>
          <Link href="/legal/subscription-terms" className="hover:text-slate-300 transition">Subscription Terms</Link>
          <Link href="/legal/content-standards" className="hover:text-slate-300 transition">Content Standards</Link>
          <Link href="/legal/copyright" className="hover:text-slate-300 transition">Copyright</Link>
        </div>
        <p className="text-xs text-slate-600 mt-4">&copy; {new Date().getFullYear()} Story Time. All rights reserved.</p>
      </div>
    </footer>
  );
}
