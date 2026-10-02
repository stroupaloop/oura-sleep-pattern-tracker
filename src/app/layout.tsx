import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";

// Drawn for low-vision legibility: distinct numerals for a first-thing-in-
// the-morning read on a phone.
// Next.js has no metrics to size-match a fallback for this face, so it is
// preloaded and falls back to the system sans while it arrives.
const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
  adjustFontFallback: false,
});


export const metadata: Metadata = {
  title: "Slothie's Bipolar Tracker",
  description:
    "Track personal sleep, activity, and wearable pattern trends using Oura Ring data for personal awareness.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${atkinson.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
