import Link from "next/link";
import Image from "next/image";

const sections = [
  {
    title: "Who we are",
    paragraphs: [
      "STORYTIME STUDIOS (Pty) Ltd (CIPC registration number 2026/269060/07) operates Story Time (story-time.online), a South African digital entertainment and production platform that connects audiences with story-based content and gives creators tools to publish, distribute, and monetize their work.",
      "We build secure, scalable infrastructure for streaming, creator workflows, marketplace collaboration, and compliant payment processing under South African law.",
    ],
  },
  {
    title: "What Story Time offers",
    paragraphs: [
      "Viewers can browse and watch free and premium storytelling experiences, manage age-aware profiles, and subscribe to unlock catalogue access.",
      "Creators and production stakeholders can upload projects, manage metadata and ratings, collaborate through marketplace tools (including equipment, locations, crew, casting, and catering), and participate in monetization subject to platform terms.",
    ],
  },
  {
    title: "Creator monetization",
    paragraphs: [
      "Creators may earn through paid access, subscriptions to exclusive content, and platform-supported revenue models where available.",
      "STORYTIME STUDIOS (Pty) Ltd may retain a disclosed service fee or commission for facilitating transactions. Earnings are subject to payout timelines, verification requirements, and applicable deductions as set out in product flows and legal terms.",
    ],
  },
  {
    title: "Payments and pricing transparency",
    paragraphs: [
      "Prices are shown before checkout. Subscription cycles, recurring charges, and one-time fees are disclosed prior to payment. We do not add hidden fees without consent.",
      "Web payments are processed through licensed gateways such as PayFast. Story Time does not intentionally store full card PAN or CVV. Processor terms and card-network rules also apply to each transaction.",
    ],
  },
  {
    title: "Refunds, disputes, and support",
    paragraphs: [
      "Refund eligibility is governed by our Refund Policy and applicable consumer law, including the Consumer Protection Act where relevant. We ask users to contact support before initiating chargebacks so we can investigate quickly.",
      "Customer support: +27 61 657 2691 | support@story-time.online. We aim to respond within a reasonable timeframe consistent with our service standards.",
    ],
  },
  {
    title: "Privacy, Apple readiness, and account control",
    paragraphs: [
      "Our Privacy Policy explains what we collect, why we use it, and how you can exercise POPIA rights. Signed-in users can export their data and permanently delete their account from in-product Privacy & account control settings, aligned with Apple App Store Guideline 5.1.1(v).",
      "Where Sign in with Apple or other OAuth providers are enabled, authentication data is handled under our Privacy Policy and the provider’s terms.",
    ],
  },
  {
    title: "Onboarding and consent",
    paragraphs: [
      "Users create an account, review and accept the Terms of Service and Privacy Policy, review pricing where applicable, and then complete secure checkout for paid features.",
      "No paid activation proceeds without disclosure of the commercial terms that apply to the selected plan or purchase.",
    ],
  },
  {
    title: "Compliance posture",
    paragraphs: [
      "Story Time is operated with regard to POPIA, ECTA, the CPA, PAIA, the Cybercrimes Act, applicable intellectual-property law, and payment-partner requirements.",
      "We maintain transparent billing practices, content moderation standards, security controls, and enforcement of acceptable use to protect audiences, creators, and partners.",
    ],
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,170,82,0.14),transparent_28%),linear-gradient(180deg,#000000_0%,#000000_40%,#000000_100%)]" />
      <div className="fixed inset-x-0 top-0 -z-10 h-72 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />

      <header className="sticky top-0 z-20 border-b border-white/8 bg-slate-950/70 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-[0.14em] text-slate-200 transition hover:text-white">
            <Image src="/logo.png" alt="Story Time" width={24} height={24} className="rounded-md" />
            <span>STORY <span className="storytime-brand-text">TIME</span></span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/legal/terms" className="text-slate-400 transition hover:text-slate-200">
              Legal
            </Link>
            <Link href="/" className="text-slate-500 transition hover:text-slate-300">
              Back to home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 md:py-12">
        <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-6 shadow-panel backdrop-blur-xl md:p-8">
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-300">
              About Story Time
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-white md:text-4xl">
              About STORYTIME STUDIOS (Pty) Ltd
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              How Story Time operates, how creators and audiences engage with free and
              paid services, and how privacy, payment, and support commitments are
              applied across the platform.
            </p>
            <p className="text-xs text-slate-500">Last updated: July 2026</p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {sections.map((item) => (
            <div
              key={item.title}
              className="rounded-3xl border border-white/8 bg-slate-950/55 p-6 shadow-panel backdrop-blur-xl"
            >
              <h2 className="mb-3 text-xl font-semibold text-white">{item.title}</h2>
              <div className="space-y-3 text-sm leading-7 text-slate-300">
                {item.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="mt-6 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm leading-7 text-slate-400">
          <p>
            STORYTIME STUDIOS (Pty) Ltd (CIPC registration number 2026/269060/07)
            maintains a unified legal suite covering Terms of Service, Privacy Policy,
            Payment Policy, Refund Policy, Subscription Terms, Content Policy, Cookie
            Policy, Acceptable Use Policy, PAIA Manual, Security Policy, Copyright
            Notice, Disclaimer, and Regulatory Framework disclosures.
          </p>
          <p className="mt-3">
            Contact: support@story-time.online | +27 61 657 2691
          </p>
        </section>
      </main>
    </div>
  );
}
