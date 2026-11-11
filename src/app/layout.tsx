import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { getCanonicalPublicBaseUrl } from "@/lib/app-url";
import { buildOrganizationJsonLd, jsonLdScriptContent } from "@/lib/seo/content-json-ld";

const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  variable: "--font-sans",
  display: "swap",
});

const outfit = localFont({
  src: "./fonts/outfit-latin.woff2",
  variable: "--font-display",
  display: "swap",
});

const siteBase = getCanonicalPublicBaseUrl().replace(/\/$/, "") || "https://story-time.online";
const siteDescription =
  "Stream movies, series, shows, and podcasts from independent African filmmakers on Story Time Universe";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteBase),
  title: {
    default: "Story Time Universe",
    template: "%s · Story Time Universe",
  },
  description: siteDescription,
  applicationName: "Story Time Universe",
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png", sizes: "512x512" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "512x512" }],
    shortcut: ["/logo.png"],
  },
  openGraph: {
    type: "website",
    locale: "en_ZA",
    url: siteBase,
    siteName: "Story Time Universe",
    title: "Story Time Universe",
    description: siteDescription,
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Story Time Universe logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Story Time Universe",
    description: siteDescription,
    images: ["/logo.png"],
  },
};

const organizationJsonLd = buildOrganizationJsonLd();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/*
          iOS Safari data detectors rewrite phone/date-like strings (e.g. CIPC 2026/269060/07)
          into <a> tags before React hydrates → Minified React error #418 (text mismatch).
        */}
        <meta
          name="format-detection"
          content="telephone=no, date=no, email=no, address=no"
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${outfit.variable} min-h-dvh bg-background font-sans text-foreground antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScriptContent(organizationJsonLd) }}
        />
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
