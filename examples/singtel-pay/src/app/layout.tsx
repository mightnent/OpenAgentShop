import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Singtel Bill Payment",
  description: "Pay your Singtel mobile bills quickly and securely",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
