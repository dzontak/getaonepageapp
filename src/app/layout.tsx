import type { Metadata } from "next";
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
  title: "Zontak | AI-First Creative Company — One-Page App Websites",
  description:
    "Zontak builds fast, mobile-first one-page app websites for $100/year. Full service: build, deploy, and maintain. AI-first creative company.",
  keywords: [
    "one page app",
    "website builder",
    "AI website",
    "single page app",
    "affordable website",
    "Zontak",
  ],
  openGraph: {
    title: "Zontak | One-Page App Websites — $100/year",
    description:
      "Fast, mobile-first one-page app websites. Full service: build, deploy, and maintain.",
    url: "https://getaonepage.app",
    siteName: "Zontak",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
