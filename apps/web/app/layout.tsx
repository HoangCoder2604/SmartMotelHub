import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
};

export const metadata: Metadata = {
  title: {
    default: "SmartMotel Hub | Tìm phòng trọ thông minh",
    template: "%s | SmartMotel Hub",
  },
  description: "Tìm phòng trọ phù hợp, đặt lịch xem, quản lý hợp đồng và thanh toán thuận tiện trên SmartMotel Hub.",
  applicationName: "SmartMotel Hub",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon.svg",
  },
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
