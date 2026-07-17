'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Mail } from 'lucide-react';

type DailyVisit = { date: string; count: number; visitors: number };
type DailyRegistration = { date: string; count: number };
type FunnelStep = { step: string; starts: number; drops: number; dropRate: number };
type CloudWord = { text: string; value: number };
type PageStat = {
  page: string;
  views: number;
  visitors: number;
  avgDurationLabel: string;
  avgScrollDepth: number;
};
type RecentVisitor = {
  at: string | null;
  page: string;
  visitor: string;
  userAgent: string;
};
type RankStat = { name: string; count: number };
type RangePreset = 'today' | '7d' | '30d' | 'custom';
type InputSample = { at: string | null; category: string; preview: string; chars: number };
type DailyMetric = {
  date: string;
  pv: number;
  uv: number;
  registrations: number;
  authenticatedVisitors: number;
  avgEngagementMs: number;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  conversations: number;
  activeChatUsers: number;
  userTextChars: number;
  assistantTextChars: number;
  totalTextChars: number;
};
type MetricKey =
  | 'pv'
  | 'uv'
  | 'registrations'
  | 'authenticatedVisitors'
  | 'avgEngagementMs'
  | 'totalMessages'
  | 'userMessages'
  | 'conversations'
  | 'activeChatUsers'
  | 'userTextChars'
  | 'totalTextChars';

type InsightsResponse = {
  ok: boolean;
  range: {
    preset: string;
    startDate: string;
    endDate: string;
  };
  siteScope?: 'production' | 'all';
  dailyVisits: DailyVisit[];
  dailyRegistrations: DailyRegistration[];
  dailyMetrics?: DailyMetric[];
  pageStats: PageStat[];
  recentVisitors: RecentVisitor[];
  sourceStats: RankStat[];
  cityStats: RankStat[];
  featureStats: RankStat[];
  eventStats: RankStat[];
  funnel: FunnelStep[];
  keywordCloud: CloudWord[];
  inputInsights?: {
    categories: RankStat[];
    samples: InputSample[];
    averages: {
      userMessageChars: number;
      messagesPerConversation: number;
      userMessagesPerActiveUser: number;
    };
  };
  conversationStats: {
    totalMessages: number;
    userMessageCount: number;
    assistantMessageCount: number;
    userTextChars: number;
    assistantTextChars: number;
    totalTextChars: number;
    conversations: number;
    activeChatUsers: number;
    avgUserMessageChars: number;
  };
  setupWarnings?: string[];
  totals: {
    events: number;
    messages: number;
    registrations: number;
    uniqueVisitors: number;
    authenticatedVisitors: number;
    avgEngagementLabel: string;
  };
};

async function getSessionWithTimeout(timeoutMs = 3500) {
  return Promise.race([
    supabase.auth.getSession(),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('session_timeout')), timeoutMs);
    }),
  ]);
}

function getAdminErrorMessage(message: string) {
  if (/missing authorization|admin login required|authorization header|invalid user token|forbidden/i.test(message)) {
    return '请先登录管理员账号。';
  }
  return message || '加载失败';
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [email, setEmail] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [localSecret, setLocalSecret] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [showLocalLogin, setShowLocalLogin] = useState(false);
  const [preset, setPreset] = useState<RangePreset>('today');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeMetric, setActiveMetric] = useState<MetricKey>('pv');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data: authData } = await getSessionWithTimeout();
        const token = authData.session?.access_token;
        const params = new URLSearchParams({ preset });
        if (preset === 'custom') {
          if (startDate) params.set('start', startDate);
          if (endDate) params.set('end', endDate);
        }
        const res = await fetch(`/api/admin/insights?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `加载失败（${res.status}）`);
        }
        const json = (await res.json()) as InsightsResponse;
        setData(json);
        setError(null);
      } catch (e) {
        const rawMessage = e instanceof Error && e.message === 'session_timeout'
          ? '请先登录管理员账号。'
          : e instanceof Error ? e.message : '加载失败';
        setData(null);
        setError(getAdminErrorMessage(rawMessage));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [preset, startDate, endDate]);

  async function sendAdminLoginLink(event: React.FormEvent) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage(null);
    setAuthError(null);
    try {
      const response = await fetch('/api/auth/admin-login-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `发送登录链接失败（${response.status}）`);
      }
      const body = await response.json().catch(() => ({}));
      if (body.mode === 'local_admin_session') {
        setError(null);
        setAuthMessage(body.message || '本地管理员预览会话已启用，正在刷新后台。');
        window.setTimeout(() => window.location.reload(), 600);
        return;
      }
      setError(null);
      setAuthMessage('登录链接已发送，请去管理员邮箱点击登录。');
    } catch (err) {
      const message = err instanceof Error ? err.message : '发送登录链接失败，请稍后再试。';
      setAuthError(/failed to fetch/i.test(message) ? '登录接口暂时无法连接，请确认本地服务正在运行。' : message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function enableLocalAdmin(event: React.FormEvent) {
    event.preventDefault();
    setLocalLoading(true);
    setAuthError(null);
    setAuthMessage(null);
    try {
      const response = await fetch('/api/auth/local-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: localSecret }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `启用失败（${response.status}）`);
      setError(null);
      setAuthMessage(body.message || '本机管理员权限已启用，正在刷新后台。');
      window.setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '启用本机管理员权限失败。');
    } finally {
      setLocalLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-bold text-slate-900">管理员数据看板</h1>
          <p className="mt-2 text-sm text-slate-500">官网 echotalent.fun 的访问、来源、功能使用、对话数据和留存质量</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/admin/raw-conversations" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
              查看原始对话数据
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <RangeButton active={preset === 'today'} onClick={() => setPreset('today')}>今日</RangeButton>
            <RangeButton active={preset === '7d'} onClick={() => setPreset('7d')}>近 7 天</RangeButton>
            <RangeButton active={preset === '30d'} onClick={() => setPreset('30d')}>近 30 天</RangeButton>
            <RangeButton active={preset === 'custom'} onClick={() => setPreset('custom')}>自选日期</RangeButton>
            {preset === 'custom' ? (
              <>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </>
            ) : null}
            {data?.range ? (
              <span className="text-sm text-slate-500">
                {data.range.startDate} 至 {data.range.endDate}
              </span>
            ) : null}
          </div>
        </section>

        {loading ? <p className="text-slate-500">正在加载数据...</p> : null}
        {data?.setupWarnings?.length ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {data.setupWarnings.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </section>
        ) : null}
        {error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-red-600">{error}</p>
            <form onSubmit={sendAdminLoginLink} className="mt-4 grid gap-3 sm:max-w-md">
              <label htmlFor="admin-email" className="text-sm font-medium text-slate-700">管理员邮箱</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="admin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-red-100 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                  placeholder="admin@example.com"
                  disabled={authLoading}
                />
                <button
                  type="submit"
                  disabled={authLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/30 hover:bg-primary/90 disabled:opacity-60"
                >
                  <Mail className="h-4 w-4" />
                  {authLoading ? '发送中...' : '发送登录链接'}
                </button>
              </div>
              {authMessage ? <p className="text-sm text-emerald-700">{authMessage}</p> : null}
              {authError ? <p className="text-sm text-red-600">{authError}</p> : null}
            </form>
            <div className="mt-4 border-t border-red-100 pt-4">
              <button
                type="button"
                onClick={() => setShowLocalLogin((value) => !value)}
                className="text-sm font-medium text-slate-600 underline underline-offset-4 hover:text-slate-900"
              >
                邮箱不可用？使用本机管理员密钥
              </button>
              {showLocalLogin ? (
                <form onSubmit={enableLocalAdmin} className="mt-3 grid gap-3 sm:max-w-md">
                  <label htmlFor="local-admin-secret" className="text-sm font-medium text-slate-700">本机管理员密钥</label>
                  <input
                    id="local-admin-secret"
                    type="password"
                    value={localSecret}
                    onChange={(event) => setLocalSecret(event.target.value)}
                    className="rounded-xl border border-red-100 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary"
                    placeholder="输入 .env.local 里的 LOCAL_ADMIN_SECRET"
                    disabled={localLoading}
                  />
                  <button
                    type="submit"
                    disabled={localLoading}
                    className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/30 hover:bg-primary/90 disabled:opacity-60"
                  >
                    {localLoading ? '验证中...' : '启用本机管理员权限'}
                  </button>
                </form>
              ) : null}
            </div>
          </section>
        ) : null}

        {data ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">运营指标趋势</h2>
                  <p className="mt-1 text-sm text-slate-500">按当前日期范围切换查看访问、注册、停留和对话数据</p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {data.range.startDate} 至 {data.range.endDate}
                </span>
              </div>
              <MetricTrendChart
                range={data.range}
                metrics={data.dailyMetrics || []}
                totals={data.totals}
                conversationStats={data.conversationStats}
                activeMetric={activeMetric}
                onMetricChange={setActiveMetric}
              />
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <RankCard title="访问来源" items={data.sourceStats} empty="暂无来源数据" />
              <RankCard title="访问城市" items={data.cityStats} empty="暂无城市数据" />
              <RankCard title="功能使用" items={data.featureStats} empty="暂无功能数据" />
            </section>

            <InputInsightsPanel insights={data.inputInsights} fallbackAvg={data.conversationStats.avgUserMessageChars} />

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900">页面使用情况</h2>
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
                <div className="grid grid-cols-5 gap-3 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                  <span>页面</span>
                  <span>PV</span>
                  <span>UV</span>
                  <span>平均停留</span>
                  <span>平均滚动</span>
                </div>
                {data.pageStats.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-slate-500">暂无页面数据。</p>
                ) : (
                  data.pageStats.map((item) => (
                    <div key={item.page} className="grid grid-cols-5 gap-3 border-t border-slate-100 px-3 py-2 text-sm">
                      <span className="truncate font-medium text-slate-800">{item.page}</span>
                      <span className="text-slate-600">{item.views}</span>
                      <span className="text-slate-600">{item.visitors}</span>
                      <span className="text-slate-600">{item.avgDurationLabel}</span>
                      <span className="text-slate-600">{item.avgScrollDepth}%</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900">步骤流失（埋点漏斗）</h2>
              <div className="mt-4 grid gap-2">
                {data.funnel.length === 0 ? (
                  <p className="text-sm text-slate-500">暂无漏斗数据。接下来可在关键步骤上报 `flow_step` 事件。</p>
                ) : (
                  data.funnel.map((item) => (
                    <div key={item.step} className="grid grid-cols-4 gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="font-medium text-slate-800">{item.step}</span>
                      <span className="text-slate-600">进入 {item.starts}</span>
                      <span className="text-slate-600">流失 {item.drops}</span>
                      <span className="text-rose-600">流失率 {item.dropRate}%</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900">用户对话关键词词云</h2>
              <p className="mt-1 text-sm text-slate-500">仅基于脱敏后的用户消息分词统计，不展示原始句子。</p>
              <WordCloud words={data.keywordCloud} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-slate-900">最近访问</h2>
              <div className="mt-4 grid gap-2">
                {data.recentVisitors.length === 0 ? (
                  <p className="text-sm text-slate-500">暂无最近访问。</p>
                ) : (
                  data.recentVisitors.map((item, index) => (
                    <div key={`${item.at}-${index}`} className="grid gap-1 rounded-lg bg-slate-50 px-3 py-2 text-sm md:grid-cols-4 md:gap-3">
                      <span className="text-slate-500">{item.at ? new Date(item.at).toLocaleString('zh-CN') : '-'}</span>
                      <span className="font-medium text-slate-800">{item.visitor}</span>
                      <span className="truncate text-slate-600">{item.page}</span>
                      <span className="truncate text-slate-400">{item.userAgent}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function RangeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-sm font-medium ${
        active
          ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
          : 'border border-primary/25 bg-primary/10 text-slate-700 hover:bg-primary/15'
      }`}
    >
      {children}
    </button>
  );
}

function RankCard({ title, items, empty }: { title: string; items: RankStat[]; empty: string }) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-4 grid gap-3">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">{empty}</p>
        ) : (
          items.slice(0, 8).map((item) => (
            <div key={item.name} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium text-slate-700">{item.name}</span>
                <span className="text-slate-500">{item.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-sky-500"
                  style={{ width: `${Math.max(8, Math.round((item.count / max) * 100))}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function InputInsightsPanel({
  insights,
  fallbackAvg,
}: {
  insights: InsightsResponse['inputInsights'];
  fallbackAvg: number;
}) {
  const categories = insights?.categories || [];
  const samples = insights?.samples || [];
  const averages = insights?.averages || {
    userMessageChars: fallbackAvg,
    messagesPerConversation: 0,
    userMessagesPerActiveUser: 0,
  };
  const maxCategory = Math.max(...categories.map((item) => item.count), 1);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">用户输入洞察</h2>
          <p className="mt-1 text-sm text-slate-500">关注用户在问什么、困在哪里，以及输入深度是否足够形成产品洞察</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-1">均字数 {averages.userMessageChars}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">每轮消息 {averages.messagesPerConversation}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">人均提问 {averages.userMessagesPerActiveUser}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-800">用户问题分类</h3>
          <div className="mt-4 grid gap-3">
            {categories.length === 0 ? (
              <p className="text-sm text-slate-500">暂无用户输入可分类。</p>
            ) : (
              categories.map((item) => (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-slate-700">{item.name}</span>
                    <span className="text-slate-500">{item.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(8, Math.round((item.count / maxCategory) * 100))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-800">脱敏输入样本</h3>
          <div className="mt-4 grid gap-2">
            {samples.length === 0 ? (
              <p className="text-sm text-slate-500">暂无用户输入样本。真实用户开始对话后，这里会显示脱敏后的代表性问题。</p>
            ) : (
              samples.slice(0, 8).map((item, index) => (
                <div key={`${item.at}-${index}`} className="rounded-lg bg-white px-3 py-2 text-sm">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{item.category}</span>
                    <span className="text-xs text-slate-400">{item.chars} 字</span>
                  </div>
                  <p className="line-clamp-2 text-slate-700">{item.preview}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function buildDateSeries(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [new Date().toISOString().slice(0, 10)];
  }

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && dates.length < 120) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

const METRIC_OPTIONS: Array<{
  key: MetricKey;
  label: string;
  unit?: string;
  accent: string;
  value: (metric: DailyMetric) => number;
  total: (data: Pick<InsightsResponse, 'totals' | 'conversationStats'>, series: DailyMetric[]) => number;
  format?: (value: number) => string;
}> = [
  {
    key: 'pv',
    label: '访问量 PV',
    accent: '#f97362',
    value: (metric) => metric.pv,
    total: (_, series) => series.reduce((sum, item) => sum + item.pv, 0),
  },
  {
    key: 'uv',
    label: '触达人数 UV',
    accent: '#0ea5e9',
    value: (metric) => metric.uv,
    total: (data) => data.totals.uniqueVisitors,
  },
  {
    key: 'registrations',
    label: '注册人数',
    accent: '#10b981',
    value: (metric) => metric.registrations,
    total: (data) => data.totals.registrations,
  },
  {
    key: 'authenticatedVisitors',
    label: '登录用户',
    accent: '#8b5cf6',
    value: (metric) => metric.authenticatedVisitors,
    total: (data) => data.totals.authenticatedVisitors,
  },
  {
    key: 'avgEngagementMs',
    label: '平均停留',
    unit: '秒',
    accent: '#f59e0b',
    value: (metric) => Math.round(metric.avgEngagementMs / 1000),
    total: (data) => durationLabelToSeconds(data.totals.avgEngagementLabel),
    format: (value) => `${value}秒`,
  },
  {
    key: 'totalMessages',
    label: '消息样本',
    accent: '#14b8a6',
    value: (metric) => metric.totalMessages,
    total: (data) => data.totals.messages,
  },
  {
    key: 'userMessages',
    label: '用户消息',
    accent: '#6366f1',
    value: (metric) => metric.userMessages,
    total: (data) => data.conversationStats.userMessageCount,
  },
  {
    key: 'conversations',
    label: '对话轮次',
    accent: '#ec4899',
    value: (metric) => metric.conversations,
    total: (data) => data.conversationStats.conversations,
  },
  {
    key: 'activeChatUsers',
    label: '对话人数',
    accent: '#22c55e',
    value: (metric) => metric.activeChatUsers,
    total: (data) => data.conversationStats.activeChatUsers,
  },
  {
    key: 'userTextChars',
    label: '用户文字量',
    accent: '#ef4444',
    value: (metric) => metric.userTextChars,
    total: (data) => data.conversationStats.userTextChars,
  },
  {
    key: 'totalTextChars',
    label: '总文字量',
    accent: '#64748b',
    value: (metric) => metric.totalTextChars,
    total: (data) => data.conversationStats.totalTextChars,
  },
];

function durationLabelToSeconds(label: string) {
  const minuteMatch = label.match(/(\d+)分(?:(\d+)秒)?|(\d+)分钟/);
  if (minuteMatch) {
    const minutes = Number(minuteMatch[1] || minuteMatch[3] || 0);
    const seconds = Number(minuteMatch[2] || 0);
    return minutes * 60 + seconds;
  }
  const secondMatch = label.match(/(\d+)秒/);
  return secondMatch ? Number(secondMatch[1]) : 0;
}

function formatMetricValue(value: number, formatter?: (value: number) => string) {
  if (formatter) return formatter(value);
  return String(Math.round(value));
}

function MetricTrendChart({
  range,
  metrics,
  totals,
  conversationStats,
  activeMetric,
  onMetricChange,
}: {
  range: InsightsResponse['range'];
  metrics: DailyMetric[];
  totals: InsightsResponse['totals'];
  conversationStats: InsightsResponse['conversationStats'];
  activeMetric: MetricKey;
  onMetricChange: (metric: MetricKey) => void;
}) {
  const metricOption = METRIC_OPTIONS.find((item) => item.key === activeMetric) || METRIC_OPTIONS[0];
  const metricMap = new Map(metrics.map((item) => [item.date, item]));
  const dates = buildDateSeries(range.startDate, range.endDate);
  const series = dates.map((date) => metricMap.get(date) || {
    date,
    pv: 0,
    uv: 0,
    registrations: 0,
    authenticatedVisitors: 0,
    avgEngagementMs: 0,
    totalMessages: 0,
    userMessages: 0,
    assistantMessages: 0,
    conversations: 0,
    activeChatUsers: 0,
    userTextChars: 0,
    assistantTextChars: 0,
    totalTextChars: 0,
  });
  const values = series.map(metricOption.value);
  const total = metricOption.total({ totals, conversationStats }, series);
  const average = values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  const peak = Math.max(...values, 0);
  const width = 720;
  const height = 240;
  const padding = 32;
  const maxValue = Math.max(...values, 1);

  const point = (index: number, value: number) => {
    const x = series.length <= 1
      ? width / 2
      : padding + (index / (series.length - 1)) * (width - padding * 2);
    const y = height - padding - (value / maxValue) * (height - padding * 2);
    return { x, y };
  };

  const line = () =>
    values.map((value, index) => {
      const p = point(index, value);
      return `${p.x},${p.y}`;
    }).join(' ');
  const labelStep = Math.max(1, Math.ceil(series.length / 8));
  const hasAnyData = values.some((value) => value > 0);

  return (
    <div className="mt-5">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {METRIC_OPTIONS.map((metric) => (
          <button
            key={metric.key}
            type="button"
            onClick={() => onMetricChange(metric.key)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              activeMetric === metric.key
                ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/25'
                : 'border-slate-200 bg-white text-slate-600 hover:border-primary/40 hover:bg-primary/5'
            }`}
          >
            {metric.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">当前指标</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatMetricValue(total, metricOption.format)}
          </p>
          <p className="mt-1 text-sm text-slate-500">{metricOption.label}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">日均</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatMetricValue(average, metricOption.format)}
          </p>
          <p className="mt-1 text-sm text-slate-500">按所选日期范围计算</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">单日峰值</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatMetricValue(peak, metricOption.format)}
          </p>
          <p className="mt-1 text-sm text-slate-500">最高一天</p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
            const y = padding + tick * (height - padding * 2);
            return (
              <g key={tick}>
                <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                <text x={8} y={y + 4} fontSize="11" fill="#64748b">
                  {formatMetricValue(maxValue * (1 - tick), metricOption.format)}
                </text>
              </g>
            );
          })}
          <polyline fill="none" stroke={metricOption.accent} strokeWidth="3" points={line()} />
          {series.map((item, index) => {
            const value = values[index] || 0;
            const p = point(index, value);
            const showLabel = index === 0 || index === series.length - 1 || index % labelStep === 0;
            return (
              <g key={item.date}>
                <circle cx={p.x} cy={p.y} r="3" fill={metricOption.accent} />
                {showLabel ? (
                  <text
                    x={p.x}
                    y={height - 8}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#64748b"
                  >
                    {item.date.slice(5)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      {!hasAnyData ? (
        <p className="mt-2 text-xs text-slate-500">当前日期范围暂无 {metricOption.label} 数据，折线图以 0 基线显示。</p>
      ) : null}
    </div>
  );
}

function WordCloud({ words }: { words: CloudWord[] }) {
  const max = Math.max(...words.map((word) => word.value), 1);
  const palette = ['text-sky-700', 'text-emerald-700', 'text-violet-700', 'text-rose-700', 'text-amber-700', 'text-slate-700'];

  if (words.length === 0) {
    return <p className="mt-4 text-sm text-slate-500">暂无关键词数据。</p>;
  }

  return (
    <div className="mt-4 flex min-h-48 flex-wrap items-center justify-center gap-x-5 gap-y-3 rounded-xl border border-slate-100 bg-slate-50 p-5">
      {words.slice(0, 60).map((word, index) => {
        const size = 12 + Math.round((word.value / max) * 22);
        return (
          <span
            key={word.text}
            className={`font-semibold leading-none ${palette[index % palette.length]}`}
            style={{ fontSize: `${size}px` }}
            title={`${word.text}: ${word.value}`}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
}
