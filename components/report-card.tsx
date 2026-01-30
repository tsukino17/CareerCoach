import React from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card"
  import { Badge } from "@/components/ui/badge"
  import { X } from "lucide-react"
  import { Button } from "@/components/ui/button"
  
  interface ReportData {
  archetype: string;
  skills?: string[];
  rpg_stats?: { name: string; value: number }[];
  superpowers?: (string | { name: string; description: string; potential_roles?: string[] })[];
  summary: string;
}

  interface ReportCardProps {
  data: ReportData;
  onClose: () => void;
  onGeneratePlan?: () => void;
  isGeneratingPlan?: boolean;
  planError?: string | null;
}

  export function ReportCard({ data, onClose, onGeneratePlan, isGeneratingPlan, planError }: ReportCardProps) {
  const skills = data.skills ?? [];
  const superpowers = data.superpowers ?? [];
  const rpgStats = data.rpg_stats ?? [];
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-300">
      <Card className="w-full max-w-lg glass-card border-white/50 rounded-[2rem] shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300 flex flex-col">
        <CardHeader className="relative pb-2 flex-shrink-0">
           <Button 
               variant="ghost" 
               size="icon" 
               className="absolute right-4 top-4 h-8 w-8 rounded-full bg-white/50 hover:bg-white/80 z-10 transition-colors"
               onClick={onClose}
           >
               <X className="h-4 w-4" />
           </Button>
           
           <div className="flex flex-col items-center gap-4 text-center mt-6">
            <div className="space-y-3 px-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1 border border-primary/10">
                <span className="text-[10px] text-primary/80 font-semibold tracking-wide uppercase">职业原型</span>
              </div>
              <CardTitle className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/70 tracking-tight">
                {data.archetype}
              </CardTitle>
               <CardDescription className="text-sm mt-2 font-normal text-foreground/80 leading-relaxed max-w-sm mx-auto">
                {data.summary}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
            {rpgStats.length > 0 && (
              <div className="bg-white/40 rounded-2xl p-5 border border-white/50 shadow-sm">
                <h4 className="text-[10px] font-bold text-muted-foreground/70 mb-4 uppercase tracking-widest">角色属性 Attributes</h4>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {rpgStats.map((stat, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-foreground/80">{stat.name}</span>
                        <span className="text-muted-foreground font-mono">{stat.value}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary/80 transition-all duration-1000 ease-out rounded-full" 
                          style={{ width: `${stat.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-[10px] font-bold text-muted-foreground/70 mb-3 uppercase tracking-widest pl-1">核心技能 Core Skills</h4>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, i) => (
                  <Badge key={i} variant="secondary" className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 hover:text-slate-900 transition-colors shadow-sm">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-[10px] font-bold text-muted-foreground/70 mb-3 uppercase tracking-widest pl-1">隐藏天赋 Superpowers</h4>
              <ul className="space-y-3">
                {superpowers.map((power, i) => {
                  if (typeof power === 'string') {
                    return (
                      <li key={i} className="flex items-start gap-3 text-sm p-4 rounded-xl bg-gradient-to-br from-emerald-50/30 to-transparent border border-emerald-100/50 hover:border-emerald-200 transition-colors">
                        <span className="text-emerald-500 font-bold text-xs mt-0.5 border border-emerald-200 rounded-md w-5 h-5 flex items-center justify-center bg-white shadow-sm shrink-0">{i + 1}</span>
                        <span className="text-foreground/80 leading-relaxed">{power}</span>
                      </li>
                    );
                  }
                  // Handle object structure
                  return (
                    <li key={i} className="flex flex-col gap-2 text-sm p-4 rounded-xl bg-gradient-to-br from-emerald-50/30 to-transparent border border-emerald-100/50 hover:border-emerald-200 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className="text-emerald-500 font-bold text-xs mt-0.5 border border-emerald-200 rounded-md w-5 h-5 flex items-center justify-center bg-white shadow-sm shrink-0">{i + 1}</span>
                        <div className="space-y-1">
                          <span className="font-semibold text-foreground/90">{power.name}</span>
                          <p className="text-xs text-muted-foreground leading-relaxed">{power.description}</p>
                        </div>
                      </div>
                      {power.potential_roles && power.potential_roles.length > 0 && (
                        <div className="ml-8 flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-emerald-100/50">
                          {power.potential_roles.map((role, j) => (
                            <span key={j} className="text-[10px] px-2 py-0.5 bg-white text-emerald-700/80 rounded-md border border-emerald-100 font-medium shadow-sm">
                              {role}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            {onGeneratePlan && (
              <div className="pt-6 border-t border-border/40 space-y-3 pb-2">
                <Button 
                  onClick={onGeneratePlan} 
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                  disabled={!!isGeneratingPlan}
                >
                  {isGeneratingPlan ? (
                    <>
                      <span className="animate-spin mr-2">✦</span> 正在生成转型行动计划...
                    </>
                  ) : (
                    <>
                      ✨ 生成我的转型行动计划 <span className="opacity-70 ml-1 text-xs font-normal">(Action Plan)</span>
                    </>
                  )}
                </Button>
                {planError && (
                  <p className="text-xs text-red-500 text-center bg-red-50 py-2 rounded-lg">
                    {planError}
                  </p>
                )}
              </div>
            )}
          </CardContent>
      </Card>
    </div>
  )
}
