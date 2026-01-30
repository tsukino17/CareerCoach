'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import {
  ArrowLeft,
  Sparkles,
  Target,
  Star,
  Activity,
  Check,
  CheckCircle2,
  ChevronRight,
  Loader2,
  X,
  Wallet,
  Building2,
  Zap,
  HeartHandshake,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlanCard } from '@/components/plan-card';

const REPORT_STORAGE_KEY = 'career_report_v1';

interface RPGStat {
  name: string;
  value: number;
}

interface ReportData {
  archetype: string;
  skills: string[];
  rpg_stats?: RPGStat[];
  superpowers: (string | { name: string; description: string; potential_roles?: string[] })[];
  summary: string;
  target_roles?: string[]; // Added for selected roles
}

interface RoleAnalysis {
  responsibilities: string[];
  daily_routine: string;
  why_fit: string;
  salary_range: string;
  industries_companies: string[];
  core_competencies: string[];
  selection_advice: string;
}

interface RoleComparison {
  role1_analysis: {
    role_name: string;
    salary_range: string;
    match_score: number;
    pros: string[];
    cons: string[];
  };
  role2_analysis: {
    role_name: string;
    salary_range: string;
    match_score: number;
    pros: string[];
    cons: string[];
  };
  comparison_summary: string;
  recommendation: string;
}

function RadarChart({ stats }: { stats: RPGStat[] }) {
  if (!stats || stats.length === 0) return null;

  const size = 260;
  const center = size / 2;
  const radius = 100;
  const levels = 4;

  const clampValue = (v: number) => Math.max(0, Math.min(100, v));

  const angleForIndex = (index: number, total: number) =>
    (Math.PI * 2 * index) / total - Math.PI / 2;

  const buildPoint = (value: number, index: number, total: number) => {
    const angle = angleForIndex(index, total);
    const r = radius * (clampValue(value) / 100);
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return `${x},${y}`;
  };

  const points = stats
    .map((stat, index) => buildPoint(stat.value, index, stats.length))
    .join(' ');

  const levelPolygons = Array.from({ length: levels }).map((_, levelIndex) => {
    const levelRadius = radius * ((levelIndex + 1) / levels);
    const levelPoints = stats
      .map((_, index) => {
        const angle = angleForIndex(index, stats.length);
        const x = center + levelRadius * Math.cos(angle);
        const y = center + levelRadius * Math.sin(angle);
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <polygon
        key={levelIndex}
        points={levelPoints}
        fill="none"
        stroke="rgba(148, 163, 184, 0.4)"
        strokeWidth={0.5}
      />
    );
  });

  const axes = stats.map((_, index) => {
    const angle = angleForIndex(index, stats.length);
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    return (
      <line
        key={index}
        x1={center}
        y1={center}
        x2={x}
        y2={y}
        stroke="rgba(148, 163, 184, 0.5)"
        strokeWidth={0.5}
      />
    );
  });

  const labels = stats.map((stat, index) => {
    const angle = angleForIndex(index, stats.length);
    const labelRadius = radius + 18;
    const x = center + labelRadius * Math.cos(angle);
    const y = center + labelRadius * Math.sin(angle);

    return (
      <text
        key={stat.name}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-slate-500 text-[10px]"
      >
        {stat.name}
      </text>
    );
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto"
    >
      <g>
        {levelPolygons}
        {axes}
        <polygon
          points={points}
          fill="rgba(59, 130, 246, 0.25)"
          stroke="rgba(37, 99, 235, 0.9)"
          strokeWidth={1.5}
        />
        {stats.map((stat, index) => {
          const angle = angleForIndex(index, stats.length);
          const r = radius * (clampValue(stat.value) / 100);
          const x = center + r * Math.cos(angle);
          const y = center + r * Math.sin(angle);
          return (
            <circle
              key={stat.name}
              cx={x}
              cy={y}
              r={3}
              fill="rgba(37, 99, 235, 1)"
            />
          );
        })}
        {labels}
      </g>
    </svg>
  );
}

 function FormatSummary({ text }: { text: string }) {
  if (!text) return null;
  // Split by straight or curly quotes
  const parts = text.split(/['‘’]/);
  
  return (
     <p className="mt-6 text-sm leading-relaxed text-foreground/90 font-normal text-justify">
      {parts.map((part, index) => {
        // Odd indices are the quoted (emphasized) parts
        if (index % 2 === 1) {
          return (
            <span key={index} className="text-primary font-bold mx-0.5">
              {part}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </p>
  );
}

function JobListItem({ text, dotClass }: { text: React.ReactNode; dotClass?: string }) {
  return (
    <li className="flex items-start gap-3 text-sm text-foreground/80 leading-7">
      <span className={cn("w-1.5 h-1.5 rounded-full mt-2 shrink-0", dotClass || "bg-primary/40")} />
      <span>{text}</span>
    </li>
  );
}

interface RoleAnalysis {
  responsibilities: string[];
  daily_routine: string;
  why_fit: string;
  salary_range: string;
  industries_companies: string[];
  core_competencies: string[];
  selection_advice: string;
}

export default function ReportPage() {
  const router = useRouter();
  const [report, setReport] = useState<ReportData | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [analyzingRole, setAnalyzingRole] = useState<string | null>(null);
  const [roleAnalysis, setRoleAnalysis] = useState<RoleAnalysis | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [showRoleSheet, setShowRoleSheet] = useState(false);
  const [planData, setPlanData] = useState<any>(null);

  const [comparisonData, setComparisonData] = useState<RoleComparison | null>(null);
  const [showComparisonSheet, setShowComparisonSheet] = useState(false);

  useEffect(() => {
    const savedReport = localStorage.getItem(REPORT_STORAGE_KEY);
    if (savedReport) {
      try {
        setReport(JSON.parse(savedReport));
      } catch (e) {
        console.error('Failed to parse report:', e);
      }
    } else {
      router.push('/chat');
    }
  }, [router]);

  const toggleRoleSelection = (role: string) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(prev => prev.filter(r => r !== role));
    } else {
      if (selectedRoles.length >= 2) {
        // Optional: Show toast "Max 2 roles"
        return;
      }
      setSelectedRoles(prev => [...prev, role]);
    }
  };

  const analyzeRole = async (role: string, context: string) => {
    setAnalyzingRole(role);
    setShowRoleSheet(true);
    setRoleAnalysis(null);
    
    try {
      const response = await fetch('/api/analyze-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          archetype: report?.archetype,
          context
        })
      });

      if (!response.ok) throw new Error('Analysis failed');
      const data = await response.json();
      setRoleAnalysis(data);
    } catch (error) {
      console.error('Failed to analyze role:', error);
      // Optional: Show error state in sheet
    } finally {
      // Keep analyzingRole set so sheet knows what we're looking at
    }
  };

  const analyzeRoles = async () => {
    if (selectedRoles.length === 0) return;

    if (selectedRoles.length === 1) {
      // Analyze single role
      const role = selectedRoles[0];
      const context = typeof report?.superpowers?.[0] === 'string' ? 'User selected role' : (report?.superpowers?.[0] as any)?.name || 'User selected role';
      analyzeRole(role, context);
    } else {
      // Compare 2 roles
      setShowComparisonSheet(true);
      setComparisonData(null);
      setAnalyzingRole('comparison'); // Marker for loading state
      
      try {
        const response = await fetch('/api/compare-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roles: selectedRoles,
            archetype: report?.archetype,
            context: report?.superpowers
          })
        });

        if (!response.ok) throw new Error('Comparison failed');
        const data = await response.json();
        setComparisonData(data);
      } catch (error) {
        console.error('Failed to compare roles:', error);
      } finally {
        setAnalyzingRole(null);
      }
    }
  };

  if (!report) return null;

  return (
    <main className="min-h-screen text-foreground px-4 py-8 md:py-12 bg-gradient-to-br from-indigo-50/50 via-white to-emerald-50/50 relative">
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-24">
        {planData && (
          <PlanCard 
            data={planData} 
            onClose={() => setPlanData(null)} 
          />
        )}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-black/5 pb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/chat')}
              className="rounded-full hover:bg-black/5 text-muted-foreground transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                我的职业镜像报告
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Deep Mirror · 深度职业画像分析
              </p>
            </div>
          </div>
          <Badge className="hidden md:flex items-center gap-1.5 rounded-full px-4 py-1.5 bg-primary/5 text-primary border border-primary/10 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            Generated by AI
          </Badge>
        </div>

        <section className="grid md:grid-cols-12 gap-6 items-stretch">
          <Card className="md:col-span-8 glass-card border-white/60 bg-white/80 shadow-sm hover:shadow-md transition-all duration-500 flex flex-col">
            <CardHeader className="p-6 pb-3 border-b border-black/5">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-orange-600" />
                <h3 className="text-sm font-semibold text-foreground/80">职业原型</h3>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <h2 className="text-3xl sm:text-4xl font-bold text-primary tracking-tight">
                {report.archetype}
              </h2>
              <FormatSummary text={report.summary} />
            </CardContent>
          </Card>

          <Card className="md:col-span-4 glass-card border-white/60 bg-white/80 shadow-sm hover:shadow-md transition-all duration-500 flex flex-col">
            <CardHeader className="p-6 pb-3 flex flex-row items-center justify-between gap-2 border-b border-black/5">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-foreground/80">能力雷达</h3>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center py-8">
              {report.rpg_stats && report.rpg_stats.length > 0 ? (
                <div className="scale-110 transform-gpu">
                  <RadarChart stats={report.rpg_stats} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-4 space-y-2">
                  <Activity className="w-8 h-8 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">暂无足够数据生成图表</p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid md:grid-cols-12 gap-6">
          <Card className="md:col-span-8 glass-card border-white/60 bg-white/80 shadow-sm hover:shadow-md transition-all duration-500">
            <CardHeader className="p-6 pb-3 border-b border-black/5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <h3 className="text-base font-semibold text-foreground/80">隐藏天赋与适配场景</h3>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {(report.superpowers || []).map((power, index) => {
                if (typeof power === 'string') {
                  return (
                    <div
                      key={index}
                      className="group flex items-start gap-4 rounded-xl bg-gradient-to-br from-emerald-50/50 to-transparent border border-emerald-100/50 p-5 hover:border-emerald-200 transition-all duration-300"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-emerald-600 text-sm font-bold shadow-sm border border-emerald-100 group-hover:scale-110 transition-transform">
                        {index + 1}
                      </div>
                      <p className="text-base leading-7 text-foreground/80 pt-0.5">
                        {power}
                      </p>
                    </div>
                  );
                }
                
                return (
                  <div
                    key={index}
                    className="group flex flex-col gap-3 rounded-xl bg-gradient-to-br from-emerald-50/50 to-transparent border border-emerald-100/50 p-5 hover:border-emerald-200 transition-all duration-300"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 text-sm font-bold shadow-sm border border-emerald-100 group-hover:scale-110 transition-transform">
                        {index + 1}
                      </div>
                      <div className="space-y-2">
                         <span className="text-base font-semibold text-foreground/90">{power.name}</span>
                         <p className="leading-7 text-foreground/70 text-sm">
                           {power.description}
                         </p>
                      </div>
                    </div>
                    {power.potential_roles && power.potential_roles.length > 0 && (
                        <div className="ml-12 flex flex-wrap gap-2 pt-1">
                          {power.potential_roles.map((role, j) => {
                            const isSelected = selectedRoles.includes(role);
                            return (
                              <button
                                key={j}
                                onClick={() => toggleRoleSelection(role)}
                                className={cn(
                                  "inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-medium shadow-sm transition-all duration-200 hover:scale-105",
                                  isSelected 
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-200 ring-offset-1" 
                                    : "bg-white border-emerald-200/60 text-emerald-700/80 hover:bg-emerald-50 hover:text-emerald-800"
                                )}
                              >
                                {isSelected && <Check className="w-3 h-3 mr-1" />}
                                {role}
                                <span 
                                  className="ml-1.5 opacity-40 hover:opacity-100 p-0.5 rounded-full hover:bg-black/5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    analyzeRole(role, typeof power === 'string' ? power : power.description);
                                  }}
                                >
                                  <ChevronRight className="w-3 h-3" />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="md:col-span-4 glass-card border-white/60 bg-white/80 shadow-sm hover:shadow-md transition-all duration-500 h-fit">
            <CardHeader className="p-6 pb-3 border-b border-black/5">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-600" />
                <h3 className="text-sm font-semibold text-foreground/80">核心技能栈</h3>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-wrap gap-2.5">
                {(report.skills || []).map((skill, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 hover:text-slate-900 transition-colors text-sm font-normal"
                  >
                    {skill}
                  </Badge>
                ))}
              </div>
              <div className="mt-6 p-4 rounded-lg bg-cyan-50/50 border border-cyan-100 text-xs text-cyan-800/70 leading-relaxed">
                <p>这些技能构成了你的职业护城河，建议在未来的工作中持续打磨这些核心竞争力。</p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Sticky Action Bar */}
      {selectedRoles.length > 0 && (
        <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="glass-card bg-white/90 backdrop-blur-xl border border-white/50 shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-4 ring-1 ring-black/5">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">
                已选择 {selectedRoles.length} 个职业方向
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedRoles.map(role => (
                  <Badge 
                    key={role} 
                    variant="secondary" 
                    className="text-[10px] py-0.5 px-2 bg-primary/5 text-primary border-primary/10 flex items-center gap-1 shadow-sm"
                  >
                    {role}
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        analyzeRole(role, typeof report.superpowers?.[0] === 'string' ? 'User selected role' : (report.superpowers?.[0] as any)?.name || 'User selected role'); 
                      }}
                      className="ml-1 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                      title="查看深度解析"
                    >
                      <ChevronRight className="w-2.5 h-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
            <Button 
              onClick={analyzeRoles}
              disabled={analyzingRole === 'comparison'}
              className="rounded-xl shadow-lg shadow-primary/20 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary transition-all duration-300 h-auto py-2.5 px-4"
            >
              {analyzingRole === 'comparison' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  分析中...
                </>
              ) : (
                <div className="flex flex-col items-start">
                  <span className="flex items-center text-sm font-semibold">
                    <Sparkles className="w-3.5 h-3.5 mr-2" />
                    {selectedRoles.length === 1 ? '深度解析该职业' : '对比分析这两个职业'}
                  </span>
                </div>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Custom Sheet Overlay */}
      {showRoleSheet && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setShowRoleSheet(false)}
          />
          
          {/* Sheet Content */}
          <div className="relative w-full max-w-md h-full bg-white shadow-2xl animate-in slide-in-from-right duration-300 border-l border-black/5 flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-black/5">
              <div>
                <h2 className="text-lg font-bold text-foreground">职业深度解析</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {analyzingRole}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowRoleSheet(false)}
                className="rounded-full hover:bg-black/5"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {!roleAnalysis ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p>正在深度分析该职业...</p>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in duration-500 pb-10">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary font-semibold text-base">
                      <Target className="w-5 h-5" />
                      <h3>核心职责</h3>
                    </div>
                    <ul className="space-y-3">
                      {roleAnalysis.responsibilities.map((item, i) => (
                        <JobListItem key={i} text={item} />
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-5 rounded-xl border border-border/40 space-y-2">
                      <div className="flex items-center gap-2 text-foreground/70 font-medium text-xs uppercase tracking-wider">
                         <Wallet className="w-3.5 h-3.5" />
                         <span>薪资范围</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                         <span className="text-xs text-foreground/70 bg-secondary/50 px-2 py-1 rounded-md">{roleAnalysis.salary_range}</span>
                      </div>
                    </div>
                    <div className="p-5 rounded-xl border border-border/40 space-y-2">
                       <div className="flex items-center gap-2 text-foreground/70 font-medium text-xs uppercase tracking-wider">
                         <Building2 className="w-3.5 h-3.5" />
                         <span>典型行业</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {roleAnalysis.industries_companies?.slice(0, 3).map((ind, i) => (
                           <span key={i} className="text-xs text-foreground/70 bg-secondary/50 px-2 py-1 rounded-md">{ind}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-foreground font-semibold text-base">
                      <Zap className="w-5 h-5 text-yellow-500" />
                      <h3>核心能力要求</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {roleAnalysis.core_competencies?.map((skill, i) => (
                        <span key={i} className="text-xs font-medium px-3 py-1.5 rounded-full border border-border/60 bg-secondary/20 text-foreground/80">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-foreground font-semibold text-base">
                      <Clock className="w-5 h-5 text-blue-500" />
                      <h3>典型一天</h3>
                    </div>
                    <ul className="space-y-3">
                      {roleAnalysis.daily_routine
                        // Ensure each time block starts on a new line
                        .replace(/(上午[:：]|下午[:：]|晚上[:：])/g, '\n$1')
                        .split('\n')
                        .map((line, i) => {
                          let cleanLine = line.trim();
                          if (!cleanLine) return null;
                          
                          // Remove leading bullet points or numbers (e.g. "1. ", "- ", "• ")
                          cleanLine = cleanLine.replace(/^([0-9]+[\.\)]|[•\-\*])\s+/, '');
                          
                          // Handle "Header: Content" format to bold the header
                          const match = cleanLine.match(/^(.+?[：:])\s*(.*)/);
                          
                          if (match) {
                            const [_, header, content] = match;
                            // If header is short (likely "上午：", "下午："), bold it
                            if (header.length <= 10) {
                              return (
                                <JobListItem 
                                  key={i} 
                                  text={
                                    <>
                                      <span className="font-semibold text-foreground/90">{header}</span>
                                      {content}
                                    </>
                                  } 
                                  dotClass="bg-blue-500" 
                                />
                              );
                            }
                          }
                          
                          return <JobListItem key={i} text={cleanLine} dotClass="bg-blue-500" />;
                        })}
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-foreground font-semibold text-base">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <h3>为什么适合你</h3>
                    </div>
                    <p className="text-sm text-foreground/80 leading-7">
                      {roleAnalysis.why_fit}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-foreground font-semibold text-base">
                      <HeartHandshake className="w-5 h-5 text-pink-500" />
                      <h3>选择建议</h3>
                    </div>
                    <p className="text-sm text-foreground/80 leading-7">
                      {roleAnalysis.selection_advice}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-black/5 bg-gray-50/50">
              <Button 
                className="w-full" 
                onClick={() => {
                  if (analyzingRole) {
                    toggleRoleSelection(analyzingRole);
                    setShowRoleSheet(false);
                  }
                }}
              >
                {selectedRoles.includes(analyzingRole!) ? (
                  <>
                    <X className="w-4 h-4 mr-2" />
                    取消选择该职业
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    已加入分析列表
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Sheet */}
      {showComparisonSheet && (
        <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowComparisonSheet(false)} />
          <div className="relative w-full max-w-4xl bg-white h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-500">
            <div className="p-6 space-y-8">
              <div className="flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-10 py-2 border-b">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  职业对比分析
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setShowComparisonSheet(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {!comparisonData ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="text-muted-foreground animate-pulse">正在进行深度对比分析...</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Summary */}
                  <div className="p-5 rounded-xl bg-slate-50/50 border border-slate-100/80">
                    <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2 text-sm">
                      <Sparkles className="w-4 h-4 text-blue-500" />
                      对比总结
                    </h3>
                    <p className="text-sm leading-relaxed text-foreground/80 text-justify">{comparisonData.comparison_summary}</p>
                  </div>

                  {/* Side by Side */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[comparisonData.role1_analysis, comparisonData.role2_analysis].map((role, idx) => (
                      <Card key={idx} className="border border-border/40 shadow-sm overflow-hidden">
                        <CardHeader className="pb-4 bg-slate-50/30 border-b border-slate-100">
                          <CardTitle className="text-base font-bold text-foreground/90">{role.role_name}</CardTitle>
                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 border border-blue-100/50 text-xs font-medium">
                              匹配度 {role.match_score}%
                            </span>
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-50 text-slate-600 border border-slate-100/50 text-xs font-medium">
                              {role.salary_range}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6 text-sm">
                          <div className="space-y-3">
                            <div className="font-medium text-foreground/80 flex items-center gap-2 text-xs uppercase tracking-wider">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500/80" /> 
                              优势 (Pros)
                            </div>
                            <ul className="space-y-2">
                              {role.pros.map((p, i) => (
                                <li key={i} className="flex items-start gap-2 text-muted-foreground text-xs leading-relaxed">
                                  <span className="w-1 h-1 rounded-full bg-emerald-400/40 mt-1.5 shrink-0" />
                                  <span>{p}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="space-y-3">
                            <div className="font-medium text-foreground/80 flex items-center gap-2 text-xs uppercase tracking-wider">
                              <Activity className="w-4 h-4 text-orange-500/80" /> 
                              挑战 (Cons)
                            </div>
                            <ul className="space-y-2">
                              {role.cons.map((c, i) => (
                                <li key={i} className="flex items-start gap-2 text-muted-foreground text-xs leading-relaxed">
                                  <span className="w-1 h-1 rounded-full bg-orange-400/40 mt-1.5 shrink-0" />
                                  <span>{c}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Recommendation */}
                  <div className="p-5 rounded-xl bg-slate-50 border border-slate-100">
                    <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Target className="w-4 h-4 text-primary" />
                      建议与选择
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{comparisonData.recommendation}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
