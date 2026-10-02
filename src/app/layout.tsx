import type { Metadata } from "next";
import {
  Atkinson_Hyperlegible_Mono,
  Atkinson_Hyperlegible_Next,
} from "next/font/google";
import "./globals.css";

// Drawn for low-vision legibility: distinct numerals for a first-thing-in-
// the-morning read on a phone.
const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
});

const atkinsonMono = Atkinson_Hyperlegible_Mono({
  variable: "--font-atkinson-mono",
  subsets: ["latin"],
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
        className={`${atkinson.variable} ${atkinsonMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
