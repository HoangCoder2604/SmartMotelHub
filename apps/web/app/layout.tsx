import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "SmartMotel Hub",
  description: "Nền tảng tìm kiếm và quản lý phòng trọ thông minh",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  let apiOrigin: string | null = null;
  try { apiOrigin = apiUrl ? new URL(apiUrl).origin : null; } catch { apiOrigin = null; }

  return (
    <html lang="vi">
      <head>{apiOrigin && <link rel="preconnect" href={apiOrigin} crossOrigin="anonymous" />}</head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
