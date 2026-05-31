import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Love Keyboard | AI reply coach for dating texts",
  description:
    "Stuck on what to text back? Paste any chat or DM screenshot and get 3 natural replies — playful, warm, or confident. Sound like you, only smoother.",
  openGraph: {
    title: "Love Keyboard | AI reply coach for dating texts",
    description:
      "Paste a chat screenshot. Get 3 natural replies in your tone. No manipulative tactics, just less awkward messages.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Love Keyboard | AI reply coach for dating texts",
    description:
      "Get 3 reply ideas for tricky texts and DMs. Playful, warm, or confident — pick what sounds like you.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-LK0PLACEHOLDER"
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            gtag('config', 'G-LK0PLACEHOLDER');
          `}
        </Script>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
