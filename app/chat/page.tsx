'use client';

import { useChat } from 'ai/react';
import { useRef, useEffect, useState } from 'react';
import { Send, FileText, Loader2, Trash2, Calendar, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PlanCard } from '@/components/plan-card';
import { MessageRenderer } from '@/components/message-renderer';
import { useRouter } from 'next/navigation';

const STORAGE_KEY = 'career_chat_history_v1';
const PLAN_STORAGE_KEY = 'career_plan_v1';
const REPORT_STORAGE_KEY = 'career_report_v1';

function GenerationLoading({ currentStep }: { currentStep: string }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // We expect the process to take about 10-15 seconds based on the steps
    const duration = 12000; 
    const interval = 100;
    const steps = duration / interval;
    const increment = 98 / steps; // Target 98%

    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 98) return prev;
        return prev + increment;
      });
    }, interval);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-md animate-in fade-in duration-500">
      <div className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 rounded-full border-[6px] border-slate-100"></div>
        <div className="absolute inset-0 rounded-full border-[6px] border-primary border-t-transparent animate-spin duration-[2s]"></div>
        <Sparkles className="absolute inset-0 m-auto w-10 h-10 text-primary animate-pulse" />
      </div>
      
      <div className="w-full max-w-sm space-y-4 px-8 text-center">
        <h3 className="text-xl font-bold text-foreground/80 tracking-tight animate-pulse">
          {currentStep || '正在生成报告...'}
        </h3>
        
        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
          <div 
            className="h-full bg-gradient-to-r from-blue-400 to-primary transition-all duration-200 ease-out rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-xs text-muted-foreground font-medium px-1">
            <span>AI 分析中</span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [planData, setPlanData] = useState(null);
  const router = useRouter();
  
  const { messages, input, handleInputChange, handleSubmit, isLoading, error, setMessages } = useChat({
    api: '/api/chat',
    body: {
      planContext: planData
    },
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: "你好。我是这里的倾听者，也是你的职业镜像。我想通过对话，帮你发现你可能忽略的职业优势。今天你的职业状态感觉如何？",
      }
    ],
    onError: (err) => {
        console.error('Chat error:', err);
    }
  });
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showReportButton, setShowReportButton] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [showPlan, setShowPlan] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load history and plan on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedPlan = localStorage.getItem(PLAN_STORAGE_KEY);
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) {
          setMessages(parsed);
        }
      } catch (e) {
        console.error('Failed to parse chat history', e);
      }
    }
    
    if (savedPlan) {
      try {
        setPlanData(JSON.parse(savedPlan));
      } catch (e) {
        console.error('Failed to parse plan data', e);
      }
    }
    
    setIsLoaded(true);
  }, [setMessages]);

  // Save history on update
  useEffect(() => {
    if (isLoaded && messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages, isLoaded]);

  // Save plan on update
  useEffect(() => {
    if (isLoaded && planData) {
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(planData));
    }
  }, [planData, isLoaded]);

  const clearHistory = () => {
    if (confirm('确定要清空所有对话记录和计划吗？这无法撤销。')) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PLAN_STORAGE_KEY);
      window.location.reload();
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Logic: Enable report button early (e.g. 3 turns) so user can try it out when they feel ready
    // Originally was 10, now relaxed to 3 to be more flexible
    if (messages.length >= 3) {
      setShowReportButton(true);
    }
  }, [messages]);

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    
    // Simulate progress steps for better UX
    const steps = [
      '正在回顾我们的深度对话...',
      '正在分析你的职业原型...',
      '正在挖掘你的隐藏天赋...',
      '正在绘制你的职业画像...',
      '正在生成最终报告...'
    ];
    let stepIndex = 0;
    setLoadingStep(steps[0]);
    
    const intervalId = setInterval(() => {
      stepIndex++;
      if (stepIndex < steps.length) {
        setLoadingStep(steps[stepIndex]);
      }
    }, 2500); // Change step every 2.5s

    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        body: JSON.stringify({ messages }),
      });
      
      clearInterval(intervalId);
      setLoadingStep('准备就绪！');
      
      const data = await response.json();
      try {
        window.localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.error('Failed to persist report', e);
      }
      router.push('/report');
      // Note: We keep isGeneratingReport true to show the overlay during transition
    } catch (error) {
      clearInterval(intervalId);
      console.error('Failed to generate report:', error);
      setIsGeneratingReport(false);
      // Optional: Show toast or error UI
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] max-w-md md:max-w-3xl lg:max-w-4xl mx-auto shadow-2xl overflow-hidden relative glass-card transition-all duration-500 ease-in-out">
      {/* Healing Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-float opacity-60 pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-5%] w-48 h-48 bg-secondary/30 rounded-full blur-3xl animate-breathe opacity-60 pointer-events-none" style={{ animationDelay: '2s' }} />
      
      {isGeneratingReport && <GenerationLoading currentStep={loadingStep} />}

      {showPlan && planData && (
        <PlanCard
          data={planData}
          onClose={() => setShowPlan(false)}
        />
      )}
      
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/20 bg-white/40 backdrop-blur-md z-10 sticky top-0">
        <div className="flex flex-col">
            <h1 className="text-lg font-medium tracking-tight text-foreground/80">深度镜像 (Deep Mirror)</h1>
            <span className="text-[10px] text-muted-foreground tracking-widest uppercase opacity-70">v3.1.0 Deep Path</span>
        </div>
        <div className="flex items-center gap-2">
            <Button
                variant="ghost"
                size="icon"
                onClick={clearHistory}
                title="清空记录"
                className="text-muted-foreground hover:text-red-500 hover:bg-white/50 rounded-full transition-colors"
            >
                <Trash2 className="w-4 h-4" />
            </Button>
            
            {planData && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-primary border-primary/20 hover:bg-primary/10 rounded-full bg-white/50 backdrop-blur-sm shadow-sm"
                onClick={() => setShowPlan(true)}
              >
                <Calendar className="w-4 h-4" />
                计划
              </Button>
            )}

            {showReportButton && (
            <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 animate-in fade-in zoom-in duration-500 rounded-full bg-white/50 backdrop-blur-sm border-primary/20 text-primary shadow-sm hover:bg-white/80"
                onClick={handleGenerateReport}
                disabled={isGeneratingReport}
            >
                {isGeneratingReport ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <FileText className="w-4 h-4" />
                )}
                {isGeneratingReport ? (loadingStep || '分析中...') : '生成职业报告'}
            </Button>
            )}
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
        {error && (
            <div className="w-full p-4 mb-4 text-sm text-red-500 bg-red-50/80 backdrop-blur rounded-2xl border border-red-100 shadow-sm" role="alert">
                <span className="font-medium">出错啦：</span> {error.message}
            </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
              m.role === 'user' ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "flex max-w-[85%] flex-col gap-2 px-5 py-4 text-sm shadow-sm transition-all hover:shadow-md",
                m.role === 'user'
                  ? "bg-gradient-to-br from-primary to-[#ffbca0] text-white rounded-2xl rounded-br-sm"
                  : "glass text-foreground/90 rounded-2xl rounded-bl-sm border-white/40"
              )}
            >
              <div className="leading-relaxed">
                <MessageRenderer content={m.content} role={m.role as any} />
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start w-full animate-pulse">
                <div className="glass text-foreground/80 rounded-2xl rounded-bl-sm px-5 py-4 text-sm shadow-sm flex items-center gap-2 border-white/40">
                    <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"></span>
                </div>
            </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 md:px-8 md:pb-8 bg-transparent">
        <form onSubmit={handleSubmit} className="flex gap-2 items-center relative glass rounded-full p-1.5 shadow-lg border-white/60">
          <input
            className="flex-1 bg-transparent text-foreground rounded-full px-5 py-3 text-sm focus:outline-none placeholder:text-muted-foreground/60"
            value={input}
            onChange={handleInputChange}
            placeholder="与内心对话..."
            autoFocus
          />
          <Button 
            type="submit" 
            size="icon" 
            className="rounded-full w-10 h-10 shrink-0 bg-primary hover:bg-primary/90 text-white shadow-md transition-transform hover:scale-105"
            disabled={isLoading || !input.trim()}
          >
            <Send className="w-4 h-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
