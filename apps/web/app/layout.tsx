import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MandatePay — bounded payroll delegation you can watch",
  description:
    "A CFO signs one bounded mandate; an autonomous agent runs payroll under it — never seeing real account numbers, never exceeding the mandate, every move on an attested ledger.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
