import type { Metadata } from "next";
import { Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import ActionCoachEntryOverlay from "@/components/action-coach-entry-overlay";
import { Analytics } from "@vercel/analytics/next";

const notoSansSC = Noto_Sans_SC({ 
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-noto-sans",
});

export const metadata: Metadata = {
  title: "天赋回声 | Echo Talent",
  description: "听见你的天赋回声，发现你隐藏的职业优势。",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={cn(notoSansSC.className, "antialiased min-h-screen bg-background text-foreground")}
        suppressHydrationWarning
      >
        {children}
        <ActionCoachEntryOverlay />
        <Analytics />
      </body>
    </html>
  );
}
