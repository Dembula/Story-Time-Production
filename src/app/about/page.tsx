import Link from "next/link";
import Image from "next/image";

const sections = [
  {
    title: "Platform Overview",
    paragraphs: [
      "StoryTime (Pty) Ltd is a digital content platform that enables creators to publish, distribute, and monetize story-based content while providing users with access to premium and free content experiences.",
      "The platform facilitates interactions between content creators and users through secure, scalable, and legally compliant infrastructure.",
    ],
  },
  {
    title: "Service Description",
    paragraphs: [
      "StoryTime provides hosting and distribution of storytelling content, creator monetization tooling, access to free and paid user experiences, and secure payment processing through third-party providers.",
      "Users may browse, purchase, or subscribe to content, while creators may upload and monetize their work subject to platform terms and applicable law.",
    ],
  },
  {
    title: "Creator Monetization Model",
    paragraphs: [
      "Creators may generate revenue through one-time paid access, subscription-based access to exclusive content, and platform-supported revenue-sharing models.",
      "StoryTime may retain a service fee or commission for facilitating transactions, disclosed where applicable. Creator earnings are subject to platform terms, payout timelines, and applicable deductions.",
    ],
  },
  {
    title: "User Payment Obligations",
    paragraphs: [
      "Certain content requires payment prior to access. Pricing is displayed before any transaction is completed and may include subscriptions, one-time purchases, or other digital service charges.",
      "All payments are final unless otherwise stated in the Refund Policy. By transacting, users accept pricing, billing terms, and service-delivery conditions.",
    ],
  },
  {
    title: "Payment Processing Disclosure",
    paragraphs: [
      "All financial transactions on StoryTime are securely processed through Paystack.",
      "By making a payment, users accept the payment processor terms. Payment data is handled under industry-standard security controls, and StoryTime does not store sensitive card details.",
      "Processing times, transaction confirmations, and payment disputes are subject to the payment provider's operational policies.",
    ],
  },
  {
    title: "Pricing Transparency, Refunds, and Disputes",
    paragraphs: [
      "StoryTime is committed to clear pricing. All prices are displayed before payment, hidden fees are not charged without consent, subscription cycles are disclosed, and recurring charges are shown before users subscribe.",
      "Users should contact support before filing chargebacks. StoryTime may investigate disputes and take action, including account restrictions where abuse is detected. Refund eligibility is governed by the Refund and Cancellation Policy.",
    ],
  },
  {
    title: "Customer Support",
    paragraphs: [
      "StoryTime provides support for user inquiries, technical issues, and transaction-related matters.",
      "Contact Information: +27 61 657 2691 | Email: support@story-time.online",
      "Support requests are handled within a reasonable timeframe in line with internal service standards.",
    ],
  },
  {
    title: "User Onboarding and Consent Flow",
    paragraphs: [
      "StoryTime applies a structured onboarding process to ensure legal compliance and user awareness. Users create an account, review and accept Terms of Service and Privacy Policy, review pricing and plan options, and then proceed to secure payment where applicable.",
      "No account activation or transaction processing occurs without explicit consent to the applicable legal and commercial terms.",
    ],
  },
  {
    title: "Risk Mitigation and Compliance",
    paragraphs: [
      "StoryTime actively implements transparent billing practices, clear refund and dispute handling, secure payment integration, suspicious activity monitoring, and enforcement of acceptable use standards.",
      "These controls are designed to protect users, creators, and payment partners while supporting lawful platform operations.",
    ],
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,170,82,0.14),transparent_28%),linear-gradient(180deg,#05070d_0%,#090d18_40%,#0b1020_100%)]" />
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
              PLATFORM DISCLOSURE, MONETIZATION & USER FLOW
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
              Professional overview of how StoryTime (Pty) Ltd operates, how creators
              and users engage with paid services, and how legal, payment, and support
              commitments are applied across the platform.
            </p>
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
          StoryTime (Pty) Ltd maintains a unified legal and operations suite covering
          Terms of Service, Privacy Policy, Payment Policy, Refund and Cancellation
          Policy, Cookie Policy, Acceptable Use Policy, PAIA Manual, Security Policy,
          and Disclaimer disclosures for users, creators, partners, and compliance
          reviewers.
        </section>
      </main>
    </div>
  );
}
