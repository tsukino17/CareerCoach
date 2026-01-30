import type { Metadata } from "next";
import { Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const notoSansSC = Noto_Sans_SC({ 
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-noto-sans",
});

export const metadata: Metadata = {
  title: "深度镜像 | The Deep Mirror",
  description: "发现你隐藏的职业资产。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={cn(notoSansSC.className, "antialiased min-h-screen bg-background text-foreground")} suppressHydrationWarning>{children}</body>
    </html>
  );
}
