import type { Metadata } from "next";
import { FONTS, fontHref } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "RIT Certificate Generator",
  description: "Generate and email e-certificates from Canva templates",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={fontHref("Inter:wght@400;500;600;700")} crossOrigin="anonymous" />
        {FONTS.map((f) => (
          <link key={f.family} rel="stylesheet" href={fontHref(f.spec)} crossOrigin="anonymous" />
        ))}
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
