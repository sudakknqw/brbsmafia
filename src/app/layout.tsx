import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import "./globals.css";

const onest = Onest({ variable: "--font-onest", subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "800"] });

export const metadata: Metadata = {
  title: "brbs mafia",
  description: "Когда все свободны и во что играем",
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
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
