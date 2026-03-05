
import { useEffect, useState } from 'react';
import { MessageSquare, Trash2, Calendar, FileText, LogOut, User, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { AuthDialog } from '@/components/auth-dialog';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';

import { useRouter } from 'next/navigation';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

interface UserCenterDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
}

export function UserCenterDialog({ 
  isOpen, 
  onClose,
  currentConversationId, 
  onSelectConversation, 
  onNewChat
}: UserCenterDialogProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'reports' | 'plan'>('history');
  const [showAuth, setShowAuth] = useState(false);
  const [localReport, setLocalReport] = useState<any>(null);

  useEffect(() => {
    // Check for local report
    const savedReport = localStorage.getItem('career_report_v1');
    if (savedReport) {
        try {
            setLocalReport(JSON.parse(savedReport));
        } catch (e) {
            console.error('Failed to parse local report', e);
        }
    }
  }, [isOpen]);

  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
        // Fetch when opened
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
            if (user) fetchConversations();
            else setLoading(false);
        });
    }
  }, [isOpen]);

  async function fetchConversations() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setConversations(data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteConversation(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm('确定要删除这段对话吗？')) return;

    try {
      await supabase.from('conversations').delete().eq('id', id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversationId === id) {
        onNewChat();
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setConversations([]);
    onNewChat();
    onClose();
  };

  const handleSelect = (id: string) => {
    onSelectConversation(id);
    onClose();
  };

  const handleNew = () => {
    onNewChat();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-xl border-white/20 shadow-2xl">
        <DialogTitle className="sr-only">用户中心</DialogTitle>
        <div className="flex h-full">
            {/* Left Sidebar of Dialog: User Info & Tabs */}
            <div className="w-64 bg-secondary/10 border-r border-white/10 p-6 flex flex-col gap-6">
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border-2 border-white/20 shadow-inner">
                        <User className="w-10 h-10 text-primary/60" />
                    </div>
                    <div>
                        <h3 className="font-medium truncate max-w-[200px] text-foreground/90">
                            {user?.email?.split('@')[0] || '访客'}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            {user ? '已登录' : '未登录'}
                        </p>
                        {!user && (
                            <Button 
                                variant="link" 
                                size="sm" 
                                className="h-auto p-0 text-primary mt-1"
                                onClick={() => setShowAuth(true)}
                            >
                                点击登录/注册
                            </Button>
                        )}
                    </div>
                </div>

                <div className="space-y-1 flex-1">
                    <Button 
                        variant={activeTab === 'history' ? "secondary" : "ghost"} 
                        className="w-full justify-start gap-3"
                        onClick={() => setActiveTab('history')}
                    >
                        <MessageSquare className="w-4 h-4" />
                        历史对话
                    </Button>
                    <Button 
                        variant={activeTab === 'reports' ? "secondary" : "ghost"} 
                        className="w-full justify-start gap-3"
                        onClick={() => setActiveTab('reports')}
                    >
                        <FileText className="w-4 h-4" />
                        我的报告
                        <Badge variant="outline" className="ml-auto text-[10px] h-5 px-1.5">New</Badge>
                    </Button>
                    <Button 
                        variant={activeTab === 'plan' ? "secondary" : "ghost"} 
                        className="w-full justify-start gap-3"
                        onClick={() => setActiveTab('plan')}
                    >
                        <Calendar className="w-4 h-4" />
                        行动计划
                    </Button>
                </div>

                {user && (
                    <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-red-500 hover:bg-red-50" onClick={handleSignOut}>
                        <LogOut className="w-4 h-4" />
                        退出登录
                    </Button>
                )}
            </div>

            {/* Right Content Area */}
            <div className="flex-1 flex flex-col min-w-0 bg-white/50">
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-foreground/80">
                        {activeTab === 'history' && '历史对话'}
                        {activeTab === 'reports' && '职业报告'}
                        {activeTab === 'plan' && '行动计划'}
                    </h2>
                    {activeTab === 'history' && (
                        <Button size="sm" onClick={handleNew} className="gap-2 bg-primary/90 hover:bg-primary text-white shadow-sm rounded-full">
                            <Plus className="w-4 h-4" />
                            新对话
                        </Button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'history' && (
                        <div className="space-y-3">
                            {loading ? (
                                <div className="text-center py-10 text-muted-foreground text-sm">加载中...</div>
                            ) : conversations.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground/60 flex flex-col items-center gap-3">
                                    <MessageSquare className="w-10 h-10 opacity-20" />
                                    <p>暂无历史对话</p>
                                </div>
                            ) : (
                                <div className="grid gap-3 grid-cols-1">
                                    {conversations.map(conv => (
                                        <div 
                                            key={conv.id}
                                            onClick={() => handleSelect(conv.id)}
                                            className={cn(
                                                "group flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md",
                                                currentConversationId === conv.id 
                                                    ? "bg-primary/5 border-primary/20 shadow-sm" 
                                                    : "bg-white border-transparent hover:border-border"
                                            )}
                                        >
                                            <div className="flex items-center gap-4 overflow-hidden">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                                    currentConversationId === conv.id ? "bg-primary/10 text-primary" : "bg-secondary/10 text-muted-foreground"
                                                )}>
                                                    <MessageSquare className="w-5 h-5" />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className={cn(
                                                        "font-medium truncate text-sm",
                                                        currentConversationId === conv.id ? "text-primary" : "text-foreground/80"
                                                    )}>
                                                        {conv.title || '新对话'}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {new Date(conv.created_at).toLocaleDateString()} {new Date(conv.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                    </span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                                                onClick={(e) => deleteConversation(e, conv.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {activeTab === 'reports' && (
                         <div className="text-center py-20 text-muted-foreground/60 flex flex-col items-center gap-4">
                            <FileText className="w-12 h-12 opacity-20" />
                            {localReport ? (
                                <>
                                    <p>发现一份本地保存的报告</p>
                                    <div className="flex gap-2">
                                        <Button variant="default" size="sm" onClick={() => {
                                            router.push('/report');
                                            onClose();
                                        }}>
                                            查看当前报告
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        注意：目前报告仅保存在本地设备上。
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p>这里将存放你的职业分析报告</p>
                                    <Button variant="outline" size="sm" onClick={onClose}>去生成报告</Button>
                                </>
                            )}
                         </div>
                    )}

                    {activeTab === 'plan' && (
                         <div className="text-center py-20 text-muted-foreground/60 flex flex-col items-center gap-4">
                            <Calendar className="w-12 h-12 opacity-20" />
                            <p>这里将存放你的行动计划</p>
                         </div>
                    )}
                </div>
            </div>
        </div>
      </DialogContent>

      <AuthDialog 
        isOpen={showAuth} 
        onClose={() => setShowAuth(false)}
        onAuthSuccess={() => {
            setShowAuth(false);
            supabase.auth.getUser().then(({ data: { user } }) => {
                setUser(user);
                if (user) fetchConversations();
            });
        }}
      />
    </Dialog>
  );
}
