import Link from "next/link";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0c1222] text-white">
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-semibold text-slate-300 hover:text-white transition">
            STORY TIME
          </Link>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-300 transition">
            Back to home
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12 prose prose-invert prose-slate max-w-none">
        {children}
      </main>
    </div>
  );
}
