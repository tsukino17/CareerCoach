'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Trash2, Calendar, FileText, LogOut, User, ChevronLeft, Loader2, Download, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { AuthDialog } from '@/components/auth-dialog';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

export default function UserCenterPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'reports' | 'plan'>('history');
  const [showAuth, setShowAuth] = useState(false);
  const [localReport, setLocalReport] = useState<any>(null);
  
  const router = useRouter();

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
    
    // Check auth status
    supabase.auth.getUser().then(({ data: { user } }) => {
        setUser(user);
        if (user) fetchConversations();
        else setLoading(false);
    });
  }, []);

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
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  }

  async function exportConversation(e: React.MouseEvent, conversation: Conversation) {
    e.stopPropagation();
    if (!user) {
        setShowAuth(true);
        return;
    }

    try {
        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversation.id)
            .order('created_at', { ascending: true });

        if (error) throw error;

        const exportText = messages.map(m => 
            `${m.role === 'user' ? '我' : 'AI'}: ${m.content}`
        ).join('\n\n');

        const blob = new Blob([exportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${conversation.title || '对话记录'}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting conversation:', error);
        alert('导出失败，请重试');
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setConversations([]);
    router.push('/chat'); // Redirect to chat after logout? Or stay? Maybe stay to show login.
  };

  const handleDeleteAccount = async () => {
    if (!confirm('警告：此操作不可恢复！\n确定要永久注销账号并删除所有数据吗？')) return;
    
    // Prompt for confirmation again to be safe
    const email = prompt('请输入您的邮箱地址以确认删除：');
    if (email !== user?.email) {
        alert('邮箱不匹配，操作已取消');
        return;
    }

    setLoading(true);
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch('/api/auth/delete-account', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to delete account');
        }

        // Sign out locally
        await supabase.auth.signOut();
        alert('账号已注销');
        router.push('/chat');
    } catch (err: any) {
        console.error('Delete account error:', err);
        alert('注销失败: ' + err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleSelectConversation = (id: string) => {
    router.push(`/chat?id=${id}`);
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleBack} className="-ml-2">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-lg font-semibold">个人中心</h1>
        </div>
        {user && (
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-red-500">
                <LogOut className="w-4 h-4 mr-1" />
                退出
            </Button>
        )}
      </header>

      <div className="flex-1 flex flex-col md:flex-row max-w-5xl mx-auto w-full p-4 gap-6">
        
        {/* User Profile Card */}
        <div className="w-full md:w-72 flex flex-col gap-6">
            <div className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center text-center shadow-sm">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border-4 border-background shadow-inner mb-4">
                    <User className="w-12 h-12 text-primary/60" />
                </div>
                <h3 className="font-medium text-lg truncate max-w-[200px]">
                    {user?.email?.split('@')[0] || '访客'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                    {user ? '已登录 EchoTalent Cloud' : '未登录'}
                </p>
                {user ? (
                    <>
                        <Button 
                            variant="outline"
                            className="mt-4 w-full text-muted-foreground hover:text-red-500 hover:bg-red-50 border-dashed" 
                            onClick={handleSignOut}
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            退出登录
                        </Button>
                        {/* <button
                            className="text-xs text-muted-foreground/50 hover:text-red-500 mt-3 underline"
                            onClick={handleDeleteAccount}
                        >
                            注销账号
                        </button> */}
                    </>
                ) : (
                    <Button 
                        className="mt-4 w-full" 
                        onClick={() => setShowAuth(true)}
                    >
                        立即登录/注册
                    </Button>
                )}
            </div>

            {/* Navigation Tabs (Desktop: Vertical list, Mobile: Horizontal scroll or Grid) */}
            <div className="bg-card border border-border rounded-2xl p-2 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible">
                <Button 
                    variant={activeTab === 'history' ? "secondary" : "ghost"} 
                    className="justify-start gap-3 flex-1 md:flex-none whitespace-nowrap"
                    onClick={() => setActiveTab('history')}
                >
                    <MessageSquare className="w-4 h-4" />
                    历史对话
                </Button>
                <Button 
                    variant={activeTab === 'reports' ? "secondary" : "ghost"} 
                    className="justify-start gap-3 flex-1 md:flex-none whitespace-nowrap"
                    onClick={() => setActiveTab('reports')}
                >
                    <FileText className="w-4 h-4" />
                    我的报告
                    <Badge variant="outline" className="ml-auto text-[10px] h-5 px-1.5 hidden md:flex">New</Badge>
                </Button>
                <Button 
                    variant={activeTab === 'plan' ? "secondary" : "ghost"} 
                    className="justify-start gap-3 flex-1 md:flex-none whitespace-nowrap"
                    onClick={() => setActiveTab('plan')}
                >
                    <Calendar className="w-4 h-4" />
                    行动计划
                </Button>
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-card border border-border rounded-2xl p-6 min-h-[500px] shadow-sm">
            <h2 className="text-xl font-semibold mb-6 hidden md:block">
                {activeTab === 'history' && '历史对话'}
                {activeTab === 'reports' && '职业报告'}
                {activeTab === 'plan' && '行动计划'}
            </h2>

            {activeTab === 'history' && (
                <div className="space-y-3">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-medium text-muted-foreground">你的对话记录</h3>
                        <Button size="sm" variant="outline" className="h-8 gap-2" onClick={() => router.push('/chat?new=true')}>
                            <Plus className="w-3.5 h-3.5" />
                            发起新对话
                        </Button>
                    </div>
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground/60 flex flex-col items-center gap-3">
                            <MessageSquare className="w-12 h-12 opacity-20" />
                            <p>暂无历史对话</p>
                        </div>
                    ) : (
                        <div className="grid gap-3 grid-cols-1">
                            {conversations.map(conv => (
                                <div 
                                    key={conv.id}
                                    onClick={() => handleSelectConversation(conv.id)}
                                    className="group flex items-center justify-between p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer"
                                >
                                    <div className="flex items-center gap-4 overflow-hidden">
                                        <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center shrink-0 text-primary/70">
                                            <MessageSquare className="w-5 h-5" />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-medium truncate text-sm text-foreground">
                                                {conv.title || '新对话'}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(conv.created_at).toLocaleDateString()} {new Date(conv.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-muted-foreground hover:text-primary hover:bg-primary/5"
                                            onClick={(e) => exportConversation(e, conv)}
                                            title="导出记录"
                                        >
                                            <Download className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-muted-foreground hover:text-red-500 hover:bg-red-50"
                                            onClick={(e) => deleteConversation(e, conv.id)}
                                            title="删除对话"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            {activeTab === 'reports' && (
                    <div className="text-center py-20 text-muted-foreground/60 flex flex-col items-center gap-4">
                    <FileText className="w-16 h-16 opacity-10" />
                    {localReport ? (
                        <>
                            <h3 className="text-lg font-medium text-foreground">发现一份本地报告</h3>
                            <p className="max-w-xs mx-auto">你之前生成的职业分析报告保存在此设备上。</p>
                            <Button className="mt-2" onClick={() => router.push('/report')}>
                                查看完整报告
                            </Button>
                            <p className="text-xs text-muted-foreground mt-4">
                                提示：登录后生成的报告将永久云端同步。
                            </p>
                        </>
                    ) : (
                        <>
                            <p>暂无报告记录</p>
                            <Button variant="outline" onClick={() => router.push('/chat')}>去生成报告</Button>
                        </>
                    )}
                    </div>
            )}

            {activeTab === 'plan' && (
                    <div className="text-center py-20 text-muted-foreground/60 flex flex-col items-center gap-4">
                    <Calendar className="w-16 h-16 opacity-10" />
                    <p>你的职业行动计划将显示在这里</p>
                    <Button variant="outline" onClick={() => router.push('/chat')}>回到对话</Button>
                    </div>
            )}
        </div>
      </div>

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
    </div>
  );
}