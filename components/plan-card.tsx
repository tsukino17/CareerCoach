import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { X, Calendar, CheckCircle2, BookOpen, Users, Brain } from "lucide-react"

interface Task {
  day: string;
  action: string;
  type: 'learning' | 'action' | 'connection' | 'reflection';
}

interface Phase {
  week: string;
  theme: string;
  tasks: Task[];
}

interface PlanData {
  goal: string;
  duration: string;
  phases: Phase[];
}

interface PlanCardProps {
  data: PlanData;
  onClose: () => void;
}

export function PlanCard({ data, onClose }: PlanCardProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case 'learning': return <BookOpen className="h-4 w-4 text-blue-500" />;
      case 'connection': return <Users className="h-4 w-4 text-green-500" />;
      case 'reflection': return <Brain className="h-4 w-4 text-purple-500" />;
      default: return <CheckCircle2 className="h-4 w-4 text-orange-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md p-6 animate-in fade-in duration-300">
      <Card className="w-full max-w-2xl animate-in zoom-in-95 duration-300 glass-card border-white/50 shadow-2xl rounded-[2rem] max-h-[90vh] overflow-y-auto">
        <CardHeader className="relative pb-2 border-b border-white/20">
          <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-4 top-4 h-8 w-8 rounded-full bg-white/50 hover:bg-white/80 z-10 transition-colors"
              onClick={onClose}
          >
              <X className="h-4 w-4" />
          </Button>
          
          <div className="flex flex-col items-start space-y-2">
            <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 rounded-full px-3">
                    {data.duration} 冲刺计划
                </Badge>
            </div>
            <CardTitle className="text-2xl font-bold text-foreground/90">{data.goal}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-8 pt-6">
            <div className="relative border-l-2 border-white/30 ml-3 space-y-8">
                {data.phases.map((phase, i) => (
                    <div key={i} className="relative pl-8">
                        {/* Timeline Dot */}
                        <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-white bg-primary shadow-sm" />
                        
                        <div className="mb-4">
                            <h3 className="text-lg font-semibold text-primary">{phase.week}</h3>
                            <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">{phase.theme}</p>
                        </div>

                        <div className="space-y-3">
                            {phase.tasks.map((task, j) => (
                                <div key={j} className="group flex items-start gap-3 p-4 rounded-2xl border border-white/40 bg-white/40 hover:bg-white/60 transition-all hover:shadow-sm">
                                    <div className="mt-0.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                        {getIcon(task.type)}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-xs font-mono text-muted-foreground bg-white/50 px-2 py-0.5 rounded-md w-fit">
                                            {task.day}
                                        </div>
                                        <p className="text-sm text-foreground/90 leading-relaxed">
                                            {task.action}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 text-center">
                <p className="text-sm text-muted-foreground">
                    📅 提示：你可以随时在对话中告诉我你的进度，我会根据计划调整建议。
                </p>
            </div>
        </CardContent>
      </Card>
    </div>
  )
}
