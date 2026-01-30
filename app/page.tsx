import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-[20%] left-[20%] w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float opacity-70 pointer-events-none" />
      <div className="absolute bottom-[20%] right-[20%] w-64 h-64 bg-secondary/30 rounded-full blur-3xl animate-breathe opacity-70 pointer-events-none" style={{ animationDelay: '1s' }} />

      <div className="max-w-2xl space-y-8 glass-card p-12 rounded-[2rem] relative z-10 animate-in fade-in zoom-in duration-700">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl text-foreground/90">
          发现你隐藏的<br/>
          <span className="text-primary">职业资产</span>
        </h1>
        <p className="text-xl text-muted-foreground/80 font-light">
          15 分钟。无需填表。仅仅是一次深度对话。
        </p>
        <div className="flex justify-center pt-4">
          <Link href="/chat">
            <Button size="lg" className="px-10 py-6 text-lg rounded-full shadow-lg bg-primary hover:bg-primary/90 text-white transition-transform hover:scale-105">
              开始深度探索
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
