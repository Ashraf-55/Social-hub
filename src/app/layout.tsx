import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Social Hub — Unified Inbox",
  description: "Unified social media automation & customer messaging platform"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
