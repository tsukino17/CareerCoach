'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GraduationCap, RefreshCw, Send, Loader2, MessageSquare, Lightbulb, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Reflection = {
  period_summary: string;
  patterns: {
    common_topics: string[];
    common_struggles: string[];
    effective_strategies: string[];
    ineffective_strategies: string[];
  };
  coach_observations: string[];
  suggested_prompt_changes: Array<{
    reason: string;
    current: string;
    suggested: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  overall_assessment: string;
};

type ReflectionRow = {
  id: string;
  reflection_json: Reflection | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
};

type StudioMessage = {
  id: string;
  role: 'admin' | 'coach' | 'system';
  content: string;
  meta: unknown;
  created_at: string;
};

type StudioResponse = {
  ok: boolean;
  reflection: ReflectionRow | null;
  studioMessages: StudioMessage[];
  recentNotesCount: number;
  recentConversationsCount: number;
  cached: boolean;
  error?: string;
};

const PRIORITY_STYLE: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

async function authHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
  } catch {
    return {};
  }
}

export default function CoachStudioPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StudioResponse | null>(null);

  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch('/api/admin/coach-studio', {
        headers: { ...(await authHeader()) },
      });
      const json = (await res.json()) as StudioResponse;
      if (!res.ok) throw new Error(json.error || `加载失败（${res.status}）`);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [data?.studioMessages]);

  const refreshReflection = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/coach-studio?refresh=1', {
        headers: { ...(await authHeader()) },
      });
      const json = (await res.json()) as StudioResponse;
      if (!res.ok) throw new Error(json.error || `刷新失败（${res.status}）`);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : '刷新失败');
    } finally {
      setRefreshing(false);
    }
  }, []);

  const sendMessage = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || sending) return;
    setSending(true);
    setChatError(null);

    // 乐观地把管理员消息加到 UI
    const optimisticAdmin: StudioMessage = {
      id: `local-admin-${Date.now()}`,
      role: 'admin',
      content: text,
      meta: null,
      created_at: new Date().toISOString(),
    };
    if (data) {
      setData({
        ...data,
        studioMessages: [...data.studioMessages, optimisticAdmin],
      });
    }
    setChatInput('');

    try {
      const res = await fetch('/api/admin/coach-studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ message: text }),
      });
      const json = (await res.json()) as { ok: boolean; reply?: string; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || `发送失败（${res.status}）`);
      }
      const coachReply = json.reply || '（教练未给出回复）';
      const optimisticCoach: StudioMessage = {
        id: `local-coach-${Date.now()}`,
        role: 'coach',
        content: coachReply,
        meta: null,
        created_at: new Date().toISOString(),
      };
      if (data) {
        setData({
          ...data,
          studioMessages: [...data.studioMessages, optimisticCoach],
        });
      }
    } catch (e) {
      setChatError(e instanceof Error ? e.message : '发送失败');
    } finally {
      setSending(false);
    }
  }, [chatInput, sending, data]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-500">
        <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" />
        正在加载督导工作室...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <AlertCircle className="h-4 w-4" />
          加载失败
        </div>
        <p className="mb-4 text-red-500">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
        >
          重试
        </button>
      </div>
    );
  }

  const reflection = data?.reflection?.reflection_json || null;
  const studioMessages = data?.studioMessages || [];
  const isCached = data?.cached === true;

  return (
    <div className="space-y-5">
      {/* 顶部说明 + 刷新 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900">教练督导工作室</h1>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                教练作为 agent 周期性扫描所有对话与笔记生成反思报告，管理员可在此与教练讨论如何改进 coaching，教练会提议 system prompt 修改供管理员批准。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refreshReflection()}
            disabled={refreshing}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? '正在生成反思...' : '重新生成反思'}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5">
            最近 {data?.recentNotesCount ?? 0} 条教练笔记
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5">
            最近 {data?.recentConversationsCount ?? 0} 场对话
          </span>
          {isCached ? (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-emerald-700">命中缓存</span>
          ) : (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-amber-700">本次新生成</span>
          )}
          {data?.reflection?.created_at ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5">
              报告时间：{formatTime(data.reflection.created_at)}
            </span>
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* 左侧：反思报告 */}
        <section className="lg:col-span-3 space-y-4">
          <ReflectionCard reflection={reflection} periodStart={data?.reflection?.period_start} periodEnd={data?.reflection?.period_end} />
        </section>

        {/* 右侧：督导对话 */}
        <section className="lg:col-span-2">
          <StudioChat
            messages={studioMessages}
            input={chatInput}
            setInput={setChatInput}
            onSend={sendMessage}
            sending={sending}
            error={chatError}
            endRef={chatEndRef}
          />
        </section>
      </div>
    </div>
  );
}

function ReflectionCard({
  reflection,
  periodStart,
  periodEnd,
}: {
  reflection: Reflection | null;
  periodStart?: string | null;
  periodEnd?: string | null;
}) {
  if (!reflection) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <Lightbulb className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm font-medium text-slate-700">暂无反思报告</p>
        <p className="mt-1 text-xs text-slate-500">
          需要有足够的对话和教练笔记后，教练才能生成第一份反思。点击右上角"重新生成反思"可以强制触发。
        </p>
      </div>
    );
  }

  const patterns = reflection.patterns || { common_topics: [], common_struggles: [], effective_strategies: [], ineffective_strategies: [] };

  return (
    <div className="space-y-4">
      {/* 整体总结 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">本期反思总结</h2>
          {periodStart && periodEnd ? (
            <span className="text-xs text-slate-400">
              {formatTime(periodStart)} — {formatTime(periodEnd)}
            </span>
          ) : null}
        </div>
        <p className="text-sm leading-6 text-slate-700">{reflection.period_summary}</p>
        <div className="mt-3 rounded-lg bg-indigo-50/60 p-3">
          <p className="text-xs font-medium text-indigo-600">整体评价</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">{reflection.overall_assessment}</p>
        </div>
      </div>

      {/* 模式分析 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">模式分析</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <PatternGroup title="高频话题" items={patterns.common_topics} color="blue" />
          <PatternGroup title="常见困境" items={patterns.common_struggles} color="amber" />
          <PatternGroup title="有效策略" items={patterns.effective_strategies} color="emerald" />
          <PatternGroup title="无效或卡住" items={patterns.ineffective_strategies} color="red" />
        </div>
      </div>

      {/* 教练观察 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">教练观察</h3>
        <ul className="space-y-2">
          {reflection.coach_observations.map((obs, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-6 text-slate-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
              {obs}
            </li>
          ))}
        </ul>
      </div>

      {/* 建议的 prompt 调整 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">教练建议的 Prompt 调整</h3>
        {reflection.suggested_prompt_changes.length === 0 ? (
          <p className="text-xs text-slate-500">暂无建议。</p>
        ) : (
          <div className="space-y-3">
            {reflection.suggested_prompt_changes.map((p, i) => (
              <div key={i} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[p.priority] || PRIORITY_STYLE.low}`}>
                    {p.priority}
                  </span>
                  <span className="text-xs text-slate-400">#{i + 1}</span>
                </div>
                <p className="mb-2 text-xs leading-5 text-slate-500">
                  <span className="text-slate-400">原因：</span>
                  {p.reason}
                </p>
                <div className="mb-1.5 text-xs leading-5">
                  <span className="text-slate-400">当前倾向：</span>
                  <span className="text-red-600">{p.current}</span>
                </div>
                <div className="text-xs leading-5">
                  <span className="text-slate-400">建议方向：</span>
                  <span className="text-emerald-700">{p.suggested}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PatternGroup({ title, items, color }: { title: string; items: string[]; color: 'blue' | 'amber' | 'emerald' | 'red' }) {
  const colorClass = {
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
  }[color];
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-slate-500">{title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">—</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((s, i) => (
            <span key={i} className={`rounded-full px-2 py-0.5 text-xs ${colorClass}`}>
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StudioChat({
  messages,
  input,
  setInput,
  onSend,
  sending,
  error,
  endRef,
}: {
  messages: StudioMessage[];
  input: string;
  setInput: (s: string) => void;
  onSend: () => void;
  sending: boolean;
  error: string | null;
  endRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex h-[600px] flex-col rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <MessageSquare className="h-4 w-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-slate-900">与教练对话</h3>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-xs leading-5 text-slate-400">
              还没有和教练对话过。<br />
              你可以从下方输入开始，比如："我看你最近几场对话都偏向尽快给方向，你自己怎么看？"
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isAdmin = m.role === 'admin';
            return (
              <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${
                    isAdmin
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  }`}
                >
                  <div className="mb-1 text-xs opacity-70">{isAdmin ? '督导' : '教练'}</div>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            );
          })
        )}
        {sending ? (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-slate-100 px-3.5 py-2.5 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      {error ? (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600">{error}</div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSend();
        }}
        className="flex items-end gap-2 border-t border-slate-100 p-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void onSend();
            }
          }}
          placeholder="和教练讨论..."
          rows={2}
          className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
