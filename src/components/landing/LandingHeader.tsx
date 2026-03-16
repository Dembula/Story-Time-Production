import Link from "next/link";
import Image from "next/image";

export function LandingHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800/80 backdrop-blur-xl bg-[#0c1222]/95">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Story Time" width={36} height={36} className="rounded-lg" />
          <span className="text-lg font-semibold tracking-tight">STORY TIME</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/auth/signin" className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition rounded-lg hover:bg-slate-800/50">
            Sign In
          </Link>
          <Link href="/auth/signup" className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition rounded-lg hover:bg-slate-800/50">
            Sign Up
          </Link>
          <span className="w-px h-5 bg-slate-700 mx-1" />
          <Link href="/auth/creator/signin" className="px-4 py-2 text-sm font-medium text-orange-400 hover:text-orange-300 transition rounded-lg hover:bg-orange-500/10">
            Creator Sign In
          </Link>
          <Link href="/auth/creator/signup" className="px-5 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition">
            Creator Sign Up
          </Link>
        </nav>
      </div>
    </header>
  );
}
