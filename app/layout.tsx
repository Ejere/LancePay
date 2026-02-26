import type { Metadata } from "next";
import { Inter, Space_Grotesk, Space_Mono } from "next/font/google";
import { Providers } from "./providers";
import { Toaster } from "sonner";
import { DevModeBanner } from "@/components/DevModeBanner";
import { getNonce } from "@/lib/csp-nonce";
import "./globals.css";

// Optimize fonts with next/font/google and swap display strategy
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lancepay.com";
const defaultOgImage = `${siteUrl}/og-image.jpg`;

export const metadata: Metadata = {
  title: "Lancepay - Get Paid in Minutes, Not Days",
  description:
    "The fastest way for Nigerian freelancers to receive international payments. Instant settlements, multi-sig escrow protection, and built-in dispute resolution.",
  keywords: [
    "freelance payments",
    "international transfers",
    "Nigeria",
    "Stellar blockchain",
    "escrow",
    "fast payments",
  ],
  authors: [{ name: "Lancepay Team" }],
  creator: "Lancepay",
  publisher: "Lancepay",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "Lancepay - Get Paid in Minutes, Not Days",
    description:
      "The fastest way for Nigerian freelancers to receive international payments. Instant settlements, multi-sig escrow protection, and built-in dispute resolution.",
    siteName: "Lancepay",
    locale: "en_NG",
    images: [
      {
        url: defaultOgImage,
        width: 1200,
        height: 630,
        alt: "Lancepay - Fast International Payments for Nigerian Freelancers",
        type: "image/jpeg",
      },
      {
        url: `${siteUrl}/og-image-square.jpg`,
        width: 800,
        height: 800,
        alt: "Lancepay Logo",
        type: "image/jpeg",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@lancepay",
    creator: "@lancepay",
    title: "Lancepay - Get Paid in Minutes, Not Days",
    description:
      "The fastest way for Nigerian freelancers to receive international payments.",
    images: [defaultOgImage],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lancepay",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "finance",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = await getNonce();
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable} ${spaceMono.variable}`}
    >
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
        <Toaster position="top-right" richColors />
        <DevModeBanner nonce={nonce} />
      </body>
    </html>
  );
}
