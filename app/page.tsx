"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const isAuthRedirect = ["code", "token_hash", "token", "access_token", "error", "error_code"].some(
      (key) => searchParams.has(key) || hashParams.has(key),
    );

    if (isAuthRedirect) {
      router.replace(`/auth/callback${window.location.search}${window.location.hash}`);
    }
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-[20%] left-[20%] w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float opacity-70 pointer-events-none" />
      <div className="absolute bottom-[20%] right-[20%] w-64 h-64 bg-secondary/30 rounded-full blur-3xl animate-breathe opacity-70 pointer-events-none" style={{ animationDelay: '1s' }} />

      <div className="max-w-2xl space-y-8 glass-card p-12 rounded-[2rem] relative z-10 animate-in fade-in zoom-in duration-700">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl text-foreground/90">
          听见你的<br/>
          <span className="text-primary">天赋回声</span>
        </h1>
        <p className="text-lg text-muted-foreground/80 font-light max-w-md mx-auto">
          通过轻松的对话，让 AI 帮你剥离迷雾，精准定位你的职业天赋与热爱
        </p>
        <div className="flex justify-center pt-4">
          <Link href="/chat">
            <Button size="lg" className="px-10 py-6 text-lg rounded-full shadow-lg bg-primary hover:bg-primary/90 text-white transition-transform hover:scale-105">
              开启探索之旅
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
