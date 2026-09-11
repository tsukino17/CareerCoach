import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import AnalyticsPageViewTracker from "@/components/analytics-page-view-tracker";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export const metadata: Metadata = {
  title: {
    default: "天赋回声 | Echo Talent",
    template: "%s | Echo Talent",
  },
  description:
    "听见你的天赋回声，发现你隐藏的职业优势。AI 驱动的职业规划与转型助手，帮你找到最适合的职业方向，看见过去经历里可迁移的能力。",
  keywords: [
    "职业规划",
    "AI 职业咨询",
    "职业转型",
    "天赋发现",
    "职业发展",
    "能力迁移",
    "职业测评",
    "Echo Talent",
    "天赋回声",
  ],
  authors: [{ name: "Echo Talent" }],
  creator: "Echo Talent",
  metadataBase: new URL("https://echotalent.fun"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "天赋回声 | Echo Talent",
    description:
      "AI 驱动的职业规划与转型助手，帮你发现隐藏的职业优势与可迁移能力。",
    url: "https://echotalent.fun",
    siteName: "天赋回声 | Echo Talent",
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "天赋回声 | Echo Talent",
    description: "听见你的天赋回声，发现你隐藏的职业优势。",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
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
        className={cn("antialiased min-h-screen bg-background text-foreground")}
        suppressHydrationWarning
      >
        <AnalyticsPageViewTracker />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  name: "天赋回声 | Echo Talent",
                  alternateName: "Echo Talent",
                  url: "https://echotalent.fun",
                  description:
                    "AI 驱动的职业规划与转型助手，帮你发现隐藏的职业优势与可迁移能力。",
                  inLanguage: "zh-CN",
                },
                {
                  "@type": "WebApplication",
                  name: "天赋回声 | Echo Talent",
                  url: "https://echotalent.fun",
                  applicationCategory: "LifestyleApplication",
                  operatingSystem: "Any",
                  description:
                    "AI 职业规划与转型助手：职业测评、能力迁移分析、职业方向探索。",
                  offers: {
                    "@type": "Offer",
                    price: "0",
                    priceCurrency: "CNY",
                  },
                },
              ],
            }),
          }}
        />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
