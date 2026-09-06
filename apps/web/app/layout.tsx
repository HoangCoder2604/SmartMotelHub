import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartMotel Hub",
  description: "SmartMotel Hub Phase 1 foundation",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
