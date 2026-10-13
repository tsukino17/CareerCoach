'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Star, Download, FileText, X } from 'lucide-react';
import { getStarredUserIds, toggleStarredUser } from '@/lib/starred-users';

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

type CoachNoteJson = {
  summary?: string;
  user_state?: string;
  key_topics?: string[];
  coaching_strategies?: string[];
  what_worked?: string | null;
  what_didnt_work?: string | null;
  follow_ups?: string[];
  sentiment?: string;
  report_integration?: string | null;
};

type CoachNoteRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  coach_type: string;
  note_json: CoachNoteJson;
  report_summary: unknown;
  created_at: string;
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return iso;
  }
}

function exportUserConversations(userId: string, conversations: RawConversation[]) {
  const sorted = [...conversations].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const totalMessages = sorted.reduce((sum, c) => sum + c.message_count, 0);
  const lines: string[] = [
    `用户ID：${userId}`,
    `对话总数：${sorted.length} 场`,
    `消息总数：${totalMessages} 条`,
    `导出时间：${new Date().toLocaleString('zh-CN', { hour12: false })}`,
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

export default function AdminRawConversationsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [userId, setUserId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minMessages, setMinMessages] = useState('');
  const [maxMessages, setMaxMessages] = useState('');
  const [rows, setRows] = useState<RawConversation[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [starredUsers, setStarredUsers] = useState<Set<string>>(new Set());
  const [reportData, setReportData] = useState<unknown | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  // 教练笔记缓存：undefined=未加载，null=已查无笔记，对象=笔记内容
  const [coachNotes, setCoachNotes] = useState<Record<string, CoachNoteRow | null | undefined>>({});
  const [coachNoteLoading, setCoachNoteLoading] = useState<Set<string>>(new Set());

  useEffect(() => {
    setStarredUsers(getStarredUserIds());
  }, []);

  async function loadCoachNote(conversationId: string) {
    if (coachNotes[conversationId] !== undefined) return;
    setCoachNoteLoading((prev) => new Set(prev).add(conversationId));
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      const res = await fetch(`/api/coach/notes?conversation_id=${encodeURIComponent(conversationId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      const note = Array.isArray(json.notes) && json.notes.length > 0 ? (json.notes[0] as CoachNoteRow) : null;
      setCoachNotes((prev) => ({ ...prev, [conversationId]: note }));
    } catch {
      setCoachNotes((prev) => ({ ...prev, [conversationId]: null }));
    } finally {
      setCoachNoteLoading((prev) => {
        const next = new Set(prev);
        next.delete(conversationId);
        return next;
      });
    }
  }

  async function viewReport(targetUserId: string) {
    setReportLoading(true);
    setReportData(null);
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      const res = await fetch(`/api/admin/user-reports?user_id=${encodeURIComponent(targetUserId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (json.reports && json.reports.length > 0) {
        setReportData(json.reports[0]);
      } else {
        setReportData({ noReport: true });
      }
    } catch {
      setReportData({ error: '加载报告失败' });
    } finally {
      setReportLoading(false);
    }
  }

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '40');
    if (keyword.trim()) params.set('keyword', keyword.trim());
    if (userId.trim()) params.set('user_id', userId.trim());
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    if (minMessages) params.set('min_messages', minMessages);
    if (maxMessages) params.set('max_messages', maxMessages);
    return params.toString();
  }, [keyword, userId, startDate, endDate, minMessages, maxMessages]);

  async function load() {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      const res = await fetch(`/api/admin/raw-conversations?${query}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `加载失败（${res.status}）`);
      setRows(Array.isArray(json.conversations) ? json.conversations : []);
      setWarning(typeof json.warning === 'string' ? json.warning : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [query]);

  function toggleStarUser(userId: string) {
    toggleStarredUser(userId);
    setStarredUsers(getStarredUserIds());
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="关键词"
            className="w-32 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400"
          />
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="user_id"
            className="w-32 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400"
          />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400"
          />
          <span className="text-xs text-slate-400">至</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400"
          />
          <span className="text-xs text-slate-400">消息数</span>
          <input
            type="number"
            value={minMessages}
            onChange={(e) => setMinMessages(e.target.value)}
            placeholder="最小"
            className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400"
          />
          <span className="text-xs text-slate-400">~</span>
          <input
            type="number"
            value={maxMessages}
            onChange={(e) => setMaxMessages(e.target.value)}
            placeholder="最大"
            className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400"
          />
          <button
            type="button"
            onClick={() => { setKeyword(''); setUserId(''); setStartDate(''); setEndDate(''); setMinMessages(''); setMaxMessages(''); }}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            清空
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            刷新
          </button>
          {userId.trim() && rows.length > 0 ? (
            <button
              type="button"
              onClick={() => exportUserConversations(userId.trim(), rows)}
              className="flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100"
            >
              <Download className="h-3.5 w-3.5" />
              导出此用户对话
            </button>
          ) : null}
          {userId.trim() ? (
            <button
              type="button"
              onClick={() => viewReport(userId.trim())}
              disabled={reportLoading}
              className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5" />
              {reportLoading ? '加载中...' : '查看报告'}
            </button>
          ) : null}
          <span className="ml-auto text-xs text-slate-500">共 {rows.length} 条匹配</span>
        </div>
      </section>

      {/* 报告弹窗 */}
      {reportData ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setReportData(null)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">用户职业报告</h2>
              <button type="button" onClick={() => setReportData(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            {reportData && typeof reportData === 'object' && 'noReport' in reportData ? (
              <p className="py-8 text-center text-sm text-slate-500">该用户尚未生成职业报告。</p>
            ) : reportData && typeof reportData === 'object' && 'error' in reportData ? (
              <p className="py-8 text-center text-sm text-red-500">{(reportData as { error: string }).error}</p>
            ) : (
              <ReportView data={reportData as { report?: Record<string, unknown>; summary?: unknown; created_at?: string }} />
            )}
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          加载中...
        </div>
      ) : null}
      {warning ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">{warning}</div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          暂无匹配数据。
        </div>
      ) : null}

      <div className="space-y-3">
        {rows.map((row) => {
          const isExpanded = expanded === row.id;
          const isUserStarred = starredUsers.has(row.user_id);
          return (
            <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = isExpanded ? null : row.id;
                    setExpanded(next);
                    if (next) void loadCoachNote(next);
                  }}
                  className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-slate-900">
                      <span className="mr-1 text-slate-400">{isExpanded ? '▾' : '▸'}</span>
                      {row.title || '未命名对话'}
                    </h3>
                    <div className="mt-1 text-xs text-slate-500">
                      user_id: {row.user_id.slice(0, 12)}... · 消息数: {row.message_count}
                    </div>
                  </div>
                  <span className="text-xs text-slate-500">{new Date(row.created_at).toLocaleString('zh-CN')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleStarUser(row.user_id)}
                  className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-500"
                  title={isUserStarred ? '取消收藏该用户' : '收藏该用户的所有对话'}
                >
                  <Star className={`h-4 w-4 ${isUserStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
                </button>
              </div>
              {isExpanded ? (
                <div className="mt-4 space-y-3">
                  {row.messages.length === 0 ? (
                    <p className="text-sm text-slate-500">无消息（可能因关键词过滤被筛掉）。</p>
                  ) : (
                    row.messages.map((m) => {
                      const isUser = m.role === 'user';
                      return (
                        <div
                          key={m.id}
                          className={`flex ${isUser ? 'justify-start' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                              isUser
                                ? 'bg-sky-50 border border-sky-100'
                                : 'bg-violet-50 border border-violet-100'
                            }`}
                          >
                            <div className="mb-1 flex items-center gap-2">
                              <span
                                className={`text-xs font-medium ${
                                  isUser ? 'text-sky-600' : 'text-violet-600'
                                }`}
                              >
                                {isUser ? '用户' : '教练'}
                              </span>
                              <span className="text-xs text-slate-400">
                                {formatTime(m.created_at)}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
                              {m.content}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <CoachNoteView
                    note={coachNotes[row.id]}
                    loading={coachNoteLoading.has(row.id)}
                  />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ReportView({ data }: { data: { report?: Record<string, unknown>; summary?: unknown; created_at?: string } }) {
  const report = data.report;
  if (!report || typeof report !== 'object') {
    return <p className="py-8 text-center text-sm text-slate-500">报告数据为空。</p>;
  }

  const archetype = typeof report.archetype === 'string' ? report.archetype : '';
  const skills = Array.isArray(report.skills) ? report.skills.filter((s): s is string => typeof s === 'string') : [];
  const rpgStats = Array.isArray(report.rpg_stats) ? report.rpg_stats.filter((s): s is { name: string; value: number } => typeof s === 'object' && s !== null) : [];
  const superpowers = Array.isArray(report.superpowers) ? report.superpowers.filter((s): s is { name: string; description: string; potential_roles?: string[] } => typeof s === 'object' && s !== null) : [];
  const summaryText = typeof report.summary === 'string' ? report.summary : '';
  const targetRoles = Array.isArray(report.target_roles) ? report.target_roles.filter((s): s is string => typeof s === 'string') : [];

  return (
    <div className="space-y-4">
      {data.created_at ? (
        <p className="text-xs text-slate-400">报告生成时间：{new Date(data.created_at).toLocaleString('zh-CN')}</p>
      ) : null}

      {archetype ? (
        <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 p-4">
          <p className="text-xs font-medium text-indigo-500">职业原型</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{archetype}</p>
        </div>
      ) : null}

      {summaryText ? (
        <div>
          <p className="text-xs font-medium text-slate-500">心理总结</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">{summaryText}</p>
        </div>
      ) : null}

      {skills.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-slate-500">核心技能</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {skills.map((s, i) => (
              <span key={i} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700">{s}</span>
            ))}
          </div>
        </div>
      ) : null}

      {targetRoles.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-slate-500">推荐职业方向</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {targetRoles.map((r, i) => (
              <span key={i} className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-700">{r}</span>
            ))}
          </div>
        </div>
      ) : null}

      {rpgStats.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-slate-500">RPG 属性</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {rpgStats.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-slate-600">{s.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, Math.max(1, s.value))}%` }} />
                </div>
                <span className="text-xs font-medium text-slate-700">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {superpowers.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-slate-500">核心优势</p>
          <div className="mt-2 space-y-2">
            {superpowers.map((sp, i) => (
              <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-800">{sp.name}</p>
                {sp.description ? <p className="mt-1 text-xs leading-5 text-slate-600">{sp.description}</p> : null}
                {sp.potential_roles && sp.potential_roles.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {sp.potential_roles.map((r, j) => (
                      <span key={j} className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">{r}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'bg-emerald-100 text-emerald-700',
  neutral: 'bg-slate-100 text-slate-600',
  ambivalent: 'bg-amber-100 text-amber-700',
  negative: 'bg-rose-100 text-rose-700',
};

function CoachNoteView({ note, loading }: { note: CoachNoteRow | null | undefined; loading: boolean }) {
  if (loading) {
    return (
      <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 text-xs text-slate-500">
        正在加载教练笔记…
      </div>
    );
  }
  if (note === undefined) return null;
  if (note === null) {
    return (
      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
        该对话暂无教练笔记（对话消息数 &lt; 10、用户仍在 3 小时内活跃、或笔记生成未触发）。
      </div>
    );
  }
  const nj = note.note_json || {};
  return (
    <div className="mt-3 rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-violet-50/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-medium text-white">
            {note.coach_type === 'action' ? '行动教练' : '天赋教练'}笔记
          </span>
          {nj.sentiment ? (
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${SENTIMENT_COLOR[nj.sentiment] || SENTIMENT_COLOR.neutral}`}>
              情绪：{nj.sentiment}
            </span>
          ) : null}
        </div>
        {note.created_at ? (
          <span className="text-[10px] text-slate-400">生成于 {new Date(note.created_at).toLocaleString('zh-CN')}</span>
        ) : null}
      </div>

      {nj.summary ? (
        <p className="mt-2 text-sm leading-6 text-slate-800">{nj.summary}</p>
      ) : null}

      {nj.user_state ? (
        <p className="mt-1 text-xs text-slate-600">用户状态：{nj.user_state}</p>
      ) : null}

      {Array.isArray(nj.key_topics) && nj.key_topics.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {nj.key_topics.map((t, i) => (
            <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">{t}</span>
          ))}
        </div>
      ) : null}

      {Array.isArray(nj.coaching_strategies) && nj.coaching_strategies.length > 0 ? (
        <div className="mt-2">
          <p className="text-[10px] font-semibold text-slate-500">教练策略</p>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
            {nj.coaching_strategies.map((s, i) => <li key={i}>· {s}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {nj.what_worked ? (
          <div className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs text-slate-700">
            <span className="font-medium text-emerald-700">有效：</span>{nj.what_worked}
          </div>
        ) : null}
        {nj.what_didnt_work ? (
          <div className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-slate-700">
            <span className="font-medium text-rose-700">无效：</span>{nj.what_didnt_work}
          </div>
        ) : null}
      </div>

      {Array.isArray(nj.follow_ups) && nj.follow_ups.length > 0 ? (
        <div className="mt-2">
          <p className="text-[10px] font-semibold text-slate-500">下次跟进</p>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
            {nj.follow_ups.map((f, i) => <li key={i}>→ {f}</li>)}
          </ul>
        </div>
      ) : null}

      {nj.report_integration ? (
        <div className="mt-2 rounded-lg bg-violet-50 px-2.5 py-1.5 text-xs text-slate-700">
          <span className="font-medium text-violet-700">报告衔接：</span>{nj.report_integration}
        </div>
      ) : null}
    </div>
  );
}
