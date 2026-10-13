'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Download, RefreshCw, AlertTriangle } from 'lucide-react';

type UserProfile = {
  age: string | null;
  gender: string | null;
  city: string | null;
  occupation: string | null;
  workDuration: string | null;
  gapDuration: string | null;
  workStatus: string | null;
  bottleneck: string | null;
  expectation: string | null;
  conversationDirection: string | null;
  reliefOrHope: string | null;
  solution: string | null;
  summary: string;
};

type UserEntry = {
  userId: string;
  conversationCount: number;
  totalMessages: number;
  status: 'profiled' | 'possibly_incomplete';
  profile: UserProfile | null;
  conversations: Array<{
    id: string;
    title: string | null;
    created_at: string;
    message_count: number;
  }>;
};

type RawMessage = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
};

type RawConversation = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
  messages: RawMessage[];
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

async function exportUserConversations(userId: string) {
  const { data: authData } = await supabase.auth.getSession();
  const token = authData.session?.access_token;
  const res = await fetch(`/api/admin/raw-conversations?user_id=${encodeURIComponent(userId)}&limit=100`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const json = await res.json();
  const conversations: RawConversation[] = json.conversations || [];

  const sorted = [...conversations].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const totalMessages = sorted.reduce((sum, c) => sum + c.message_count, 0);
  const lines: string[] = [
    `用户ID：${userId}`,
    `对话总数：${sorted.length} 场`,
    `消息总数：${totalMessages} 条`,
    `导出时间：${formatTime(new Date().toISOString())}`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
  ];

  sorted.forEach((conv, idx) => {
    lines.push(`【对话 ${idx + 1}】标题：${conv.title || '未命名对话'}`);
    lines.push(`创建时间：${formatTime(conv.created_at)}`);
    lines.push(`消息数：${conv.message_count}`);
    lines.push('─────────────────────────────────────────');
    conv.messages.forEach((m) => {
      const speaker = m.role === 'user' ? '用户' : m.role === 'assistant' ? '教练' : m.role;
      lines.push(`[${speaker}] ${formatTime(m.created_at)}`);
      lines.push(m.content);
      lines.push('');
    });
    lines.push('');
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `用户对话_${userId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const TAG_FIELDS: Array<{ key: keyof UserProfile; label: string; color: string }> = [
  { key: 'age', label: '年龄', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'gender', label: '性别', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  { key: 'city', label: '城市', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'occupation', label: '原职业', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'workDuration', label: '工作时长', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { key: 'gapDuration', label: 'gap时长', color: 'bg-rose-50 text-rose-700 border-rose-200' },
];

const DETAIL_FIELDS: Array<{ key: keyof UserProfile; label: string }> = [
  { key: 'workStatus', label: '工作状态' },
  { key: 'bottleneck', label: '核心瓶颈' },
  { key: 'expectation', label: '个人期望' },
  { key: 'conversationDirection', label: '对话走向' },
  { key: 'reliefOrHope', label: '是否缓解/有希望' },
  { key: 'solution', label: '解决方案/行动方向' },
];

export default function AdminUserProfilesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<UserEntry[]>([]);
  const [threshold, setThreshold] = useState(10);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      const res = await fetch('/api/admin/user-profiles', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `加载失败（${res.status}）`);
      setEntries(Array.isArray(json.entries) ? json.entries : []);
      setThreshold(typeof json.threshold === 'number' ? json.threshold : 10);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const profiledCount = entries.filter((e) => e.status === 'profiled').length;
  const incompleteCount = entries.filter((e) => e.status === 'possibly_incomplete').length;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">用户画像侧写</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              共 {entries.length} 位用户 · {profiledCount} 位已生成画像 · {incompleteCount} 位对话不足 {threshold} 条
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </button>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          正在生成用户画像，对话数较多的用户需要调用 LLM 分析，请稍候...
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : null}

      {!loading && !error && entries.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          暂无用户数据。
        </div>
      ) : null}

      <div className="space-y-3">
        {entries.map((entry) => {
          const isExpanded = expanded === entry.userId;
          const profile = entry.profile;
          return (
            <article key={entry.userId} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {entry.userId.slice(0, 12)}...
                    </h3>
                    {entry.status === 'possibly_incomplete' ? (
                      <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        对话较短（{entry.totalMessages}条），可能存在系统问题
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {entry.conversationCount} 场对话 · {entry.totalMessages} 条消息
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => exportUserConversations(entry.userId)}
                    className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100"
                  >
                    <Download className="h-3.5 w-3.5" />
                    导出对话
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : entry.userId)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {isExpanded ? '收起' : '展开'}
                  </button>
                </div>
              </div>

              {profile ? (
                <div className="mt-4 space-y-3">
                  {/* 标签行 */}
                  <div className="flex flex-wrap gap-1.5">
                    {TAG_FIELDS.map((tag) => {
                      const value = profile[tag.key];
                      if (!value) return null;
                      return (
                        <span
                          key={tag.key}
                          className={`rounded-full border px-2.5 py-0.5 text-xs ${tag.color}`}
                        >
                          {tag.label}：{value}
                        </span>
                      );
                    })}
                  </div>

                  {/* 详情字段 */}
                  <div className="space-y-2">
                    {DETAIL_FIELDS.map((field) => {
                      const value = profile[field.key];
                      if (!value) return null;
                      return (
                        <div key={field.key} className="flex gap-2 text-sm">
                          <span className="shrink-0 font-medium text-slate-500">{field.label}：</span>
                          <span className="text-slate-800">{value}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* 一句话总结 */}
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-medium text-slate-500">总结：</span>
                    {profile.summary}
                  </div>

                  {/* 展开的对话列表 */}
                  {isExpanded ? (
                    <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                      <p className="text-xs font-medium text-slate-500">对话列表：</p>
                      {entry.conversations.map((conv) => (
                        <div key={conv.id} className="flex items-center gap-2 text-xs text-slate-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                          <span className="truncate flex-1">{conv.title || '未命名对话'}</span>
                          <span className="shrink-0 text-slate-400">
                            {new Date(conv.created_at).toLocaleDateString('zh-CN')} · {conv.message_count}条
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-400">
                  该用户对话消息不足 {threshold} 条，未生成 LLM 画像。可能是对话中断或遇到系统报错。
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
