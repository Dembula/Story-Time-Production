import Link from "next/link";
import { StoryTimeMark } from "@/components/brand/story-time-mark";

const legalLinks = [
  { href: "/legal/regulatory-framework", label: "Regulatory Framework" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/payment-policy", label: "Payments" },
  { href: "/legal/refund-policy", label: "Refunds" },
  { href: "/legal/subscription-terms", label: "Subscriptions" },
  { href: "/legal/content-policy", label: "Content Policy" },
  { href: "/legal/content-standards", label: "Content Standards" },
  { href: "/legal/copyright", label: "Copyright" },
  { href: "/legal/cookies", label: "Cookies" },
  { href: "/legal/acceptable-use", label: "Acceptable Use" },
  { href: "/legal/paia-manual", label: "PAIA Manual" },
  { href: "/legal/security-policy", label: "Security Policy" },
  { href: "/legal/disclaimer", label: "Disclaimer" },
];

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white">
      <header className="sticky top-0 z-20 border-b border-white/8 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <Link href="/" className="shrink-0" aria-label="Story Time home">
            <StoryTimeMark size={32} />
          </Link>
          <div className="flex min-w-0 items-center gap-3 text-xs sm:gap-4 sm:text-sm">
            <Link href="/about" className="shrink-0 text-slate-400 transition hover:text-slate-200">
              About
            </Link>
            <Link href="/" className="shrink-0 text-slate-500 transition hover:text-slate-300">
              Home
            </Link>
          </div>
        </div>

        <nav
          className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:px-6 sm:pb-4 [&::-webkit-scrollbar]:hidden"
          aria-label="Legal documents"
        >
          {legalLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white sm:px-3 sm:text-xs"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl px-3 py-5 sm:px-6 sm:py-10 md:py-12">
        {children}
      </main>
    </div>
  );
}
