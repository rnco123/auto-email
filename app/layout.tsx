import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Patient Email Automation",
  description: "Inbound patient email logs and automation status",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
