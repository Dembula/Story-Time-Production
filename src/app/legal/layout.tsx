import Link from "next/link";

const legalLinks = [
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/refund-policy", label: "Refunds" },
  { href: "/legal/subscription-terms", label: "Subscriptions" },
  { href: "/legal/content-policy", label: "Content Policy" },
  { href: "/legal/copyright", label: "Copyright" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/acceptable-use", label: "Acceptable Use" },
];

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,170,82,0.14),transparent_28%),linear-gradient(180deg,#05070d_0%,#090d18_40%,#0b1020_100%)]" />
      <div className="fixed inset-x-0 top-0 -z-10 h-72 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />

      <header className="sticky top-0 z-20 border-b border-white/8 bg-slate-950/70 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <Link href="/" className="font-semibold tracking-[0.14em] text-slate-200 transition hover:text-white">
            STORY <span className="storytime-brand-text">TIME</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/about" className="text-slate-400 transition hover:text-slate-200">
              About us
            </Link>
            <Link href="/" className="text-slate-500 transition hover:text-slate-300">
              Back to home
            </Link>
          </div>
        </div>

        <nav className="mx-auto mt-4 flex max-w-5xl flex-wrap gap-2">
          {legalLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 md:py-12">
        <div className="rounded-[32px] border border-white/8 bg-slate-900/35 p-4 shadow-panel backdrop-blur-xl md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
