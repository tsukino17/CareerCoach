import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import AnalyticsPageViewTracker from "@/components/analytics-page-view-tracker";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: "天赋回声 | Echo Talent",
  description: "听见你的天赋回声，发现你隐藏的职业优势。",
};

export const viewport = {
  width: "device-width",
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
        className={cn(
          "antialiased min-h-screen bg-background text-foreground"
        )}
        suppressHydrationWarning
      >
        <AnalyticsPageViewTracker />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
