import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { getAppBaseUrl } from "@/lib/app-url";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const siteBase = getAppBaseUrl() || "https://story-time.online";
const siteDescription =
  "Stream movies, series, shows, and podcasts from independent creators";

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

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Story Time Universe",
  alternateName: "Story Time",
  url: siteBase,
  logo: `${siteBase}/logo.png`,
  image: `${siteBase}/logo.png`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${outfit.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
