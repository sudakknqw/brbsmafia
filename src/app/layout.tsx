import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import Script from "next/script";
import { TelegramSetup } from "@/components/telegram/TelegramSetup";
import "./globals.css";

const onest = Onest({ variable: "--font-onest", subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "800"] });

// Превью ссылки в Telegram и Discord: картинка — app/opengraph-image.png (надпись BRABUS).
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://brbsmafia.vercel.app"),
  title: "brbs mafia",
  description: "Когда все свободны и во что играем",
  openGraph: {
    title: "brbs mafia",
    description: "Когда все свободны и во что играем",
    siteName: "brbs mafia",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#050507",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${onest.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full font-sans">
        {/* Мини-приложение Telegram: даёт данные о вошедшем, кнопку «Назад», вибрацию. */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <TelegramSetup />
        {children}
      </body>
    </html>
  );
}
