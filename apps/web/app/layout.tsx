import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "MandatePay — bounded payroll delegation you can watch",
  description:
    "A CFO signs one bounded mandate; an autonomous agent runs payroll under it — never seeing real account numbers, never exceeding the mandate, every move on an attested ledger.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/*
        Web fonts via <link> (React 19 hoists these to <head>). We deliberately do
        NOT use next/font: it fetches the font files at BUILD time, which fails in
        the egress-blocked offline container. <link> resolves in the user's browser.
        Display: Satoshi (Fontshare) · Body: Plus Jakarta Sans (Google) — both per
        the Terminal 3 brand system.
      */}
      <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,400,300&display=swap"
        precedence="high"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        precedence="high"
      />
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
