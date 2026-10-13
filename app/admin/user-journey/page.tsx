'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdminData } from '@/components/admin/admin-shell';
import type { JourneyAggregates, UserJourney } from '@/lib/admin-types';

export default function UserJourneyPage() {
  const { data } = useAdminData();
  if (!data) return null;
  const aggregates = data.journeyAggregates;
  const journeys = data.userJourneys || [];

  return (
    <div className="space-y-5">
      {!aggregates ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          当前日期范围暂无行为旅程数据。真实用户开始访问后，这里会展示动线、跳转、停留和流失节点。
        </section>
      ) : (
        <>
          <LifecycleSummary aggregates={aggregates} />
          <StageFunnelPanel aggregates={aggregates} />
          <PageTransitionsPanel aggregates={aggregates} />
          <DwellDistributionPanel aggregates={aggregates} />
          <EntryExitPanel aggregates={aggregates} />
          <DropOffPanel aggregates={aggregates} />
          <TimeToFirstActionPanel aggregates={aggregates} />
        </>
      )}

      <ShallowUsersPanel />

      <UserJourneyTable journeys={journeys} />
    </div>
  );
}

type ShallowUsersAnalysis = {
  total_shallow_users: number;
  common_patterns: string[];
  drop_off_reasons: Array<{ reason: string; evidence: string; frequency: string }>;
  common_topics_before_drop: string[];
  entry_channels: Array<{ channel: string; count: number }>;
  coach_suggestion: string;
  summary: string;
};

function ShallowUsersPanel() {
  const [analysis, setAnalysis] = useState<ShallowUsersAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usersCount, setUsersCount] = useState(0);
  const [reason, setReason] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/shallow-users-analysis');
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || '加载失败');
      }
      const json = await res.json();
      setAnalysis(json.analysis || null);
      setUsersCount(json.shallowUsersCount || 0);
      setReason(json.reason || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const frequencyColor: Record<string, string> = {
    high: 'bg-rose-100 text-rose-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-slate-100 text-slate-600',
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">未深度体验用户原因分析</h2>
          <p className="mt-1 text-sm text-slate-500">
            对话消息 &lt; 10 条就离开的用户群像分析。AI 基于真实对话片段给出共性模式、流失原因和早期留存建议。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchData()}
          disabled={loading}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:border-indigo-400 disabled:opacity-50"
        >
          {loading ? '生成中…' : '重新分析'}
        </button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-rose-600">加载失败：{error}</p>
      ) : loading && !analysis ? (
        <p className="mt-4 text-sm text-slate-500">正在分析未深度体验用户…</p>
      ) : !analysis ? (
        <p className="mt-4 text-sm text-slate-500">{reason || '当前没有未深度体验用户（对话 < 10 条）。'}</p>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl bg-slate-50 px-4 py-2">
              <p className="text-xs text-slate-500">未深度体验用户数</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{analysis.total_shallow_users || usersCount}</p>
            </div>
            <div className="flex-1 rounded-xl bg-indigo-50 px-4 py-2">
              <p className="text-xs text-indigo-500">整体总结</p>
              <p className="mt-1 text-sm text-slate-800">{analysis.summary}</p>
            </div>
          </div>

          {analysis.common_patterns.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-slate-500">共性模式</p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {analysis.common_patterns.map((p, i) => (
                  <li key={i} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {analysis.drop_off_reasons.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-slate-500">流失原因</p>
              <div className="mt-2 grid gap-2">
                {analysis.drop_off_reasons.map((r, i) => (
                  <div key={i} className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-slate-800">{r.reason}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${frequencyColor[r.frequency] || frequencyColor.low}`}>
                        {r.frequency}
                      </span>
                    </div>
                    {r.evidence ? <p className="mt-1 text-xs text-slate-500">{r.evidence}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            {analysis.common_topics_before_drop.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-slate-500">离开前讨论话题</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {analysis.common_topics_before_drop.map((t, i) => (
                    <span key={i} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{t}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {analysis.entry_channels.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-slate-500">入口渠道</p>
                <div className="mt-2 grid gap-1.5">
                  {analysis.entry_channels.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{c.channel}</span>
                      <span className="text-slate-500">{c.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {analysis.coach_suggestion ? (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
              <p className="text-xs font-semibold text-indigo-700">给教练的留存建议</p>
              <p className="mt-1 text-sm text-slate-800">{analysis.coach_suggestion}</p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function LifecycleSummary({ aggregates }: { aggregates: JourneyAggregates }) {
  const cards = [
    { label: '新访客', value: aggregates.visitorLifecycle.newVisitors, detail: '本时段首次到访', color: 'text-sky-700' },
    { label: '回访用户', value: aggregates.visitorLifecycle.returningVisitors, detail: '多日活跃', color: 'text-emerald-700' },
    { label: '有效互动', value: aggregates.visitorLifecycle.engagedVisitors, detail: '发起对话或路径探索', color: 'text-violet-700' },
    { label: '转化用户', value: aggregates.visitorLifecycle.convertedVisitors, detail: '生成报告或完成行动', color: 'text-rose-700' },
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{card.label}</p>
          <p className={`mt-2 text-2xl font-bold ${card.color}`}>{card.value}</p>
          <p className="mt-1 text-xs text-slate-500">{card.detail}</p>
        </div>
      ))}
    </section>
  );
}

function StageFunnelPanel({ aggregates }: { aggregates: JourneyAggregates }) {
  const maxUsers = Math.max(...aggregates.stageFunnel.map((s) => s.users), 1);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">用户阶段漏斗</h2>
        <p className="mt-1 text-sm text-slate-500">从访问页面 → 发起对话 → 生成报告 → 进入现实路径 → 完成行动的逐级转化</p>
      </div>
      <div className="mt-5 grid gap-3">
        {aggregates.stageFunnel.map((stage, index) => {
          const prev = index > 0 ? aggregates.stageFunnel[index - 1] : null;
          const stepConv = prev && prev.users > 0 ? Number(((stage.users / prev.users) * 100).toFixed(1)) : null;
          return (
            <div key={stage.stage} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700">
                  <span className="mr-2 text-slate-400">{index + 1}.</span>{stage.stage}
                </span>
                <span className="text-slate-600">
                  {stage.users} 人 · 占总访客 {stage.rate}%
                  {stepConv !== null ? <span className="ml-2 text-slate-400">（本级转化 {stepConv}%）</span> : null}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500"
                  style={{ width: `${Math.max(4, Math.round((stage.users / maxUsers) * 100))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PageTransitionsPanel({ aggregates }: { aggregates: JourneyAggregates }) {
  const max = Math.max(...aggregates.pageTransitions.map((t) => t.count), 1);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">页面跳转路径</h2>
        <p className="mt-1 text-sm text-slate-500">用户在页面之间的实际跳转方向，Top 30。用于判断动线是否顺畅、是否有意外回流。</p>
      </div>
      {aggregates.pageTransitions.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">暂无跳转数据。</p>
      ) : (
        <div className="mt-4 grid gap-2">
          {aggregates.pageTransitions.map((t, index) => (
            <div key={`${t.from}-${t.to}-${index}`} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium text-slate-700">
                  <span className="text-slate-500">{t.from}</span>
                  <span className="mx-2 text-slate-400">→</span>
                  <span className="text-slate-900">{t.to}</span>
                </span>
                <span className="text-slate-600">{t.count} 次</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{ width: `${Math.max(8, Math.round((t.count / max) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DwellDistributionPanel({ aggregates }: { aggregates: JourneyAggregates }) {
  const max = Math.max(...aggregates.dwellDistribution.map((b) => b.count), 1);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">单页停留时长分布</h2>
        <p className="mt-1 text-sm text-slate-500">每次 page_engagement 上报的时长分桶。看用户在哪类页面停留最久。</p>
      </div>
      {aggregates.dwellDistribution.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">暂无停留数据。</p>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {aggregates.dwellDistribution.map((b) => (
            <div key={b.bucket} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{b.bucket}</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{b.count}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{ width: `${Math.max(8, Math.round((b.count / max) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EntryExitPanel({ aggregates }: { aggregates: JourneyAggregates }) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <PageRankList title="入口页（首次访问）" items={aggregates.entryPages} hint="用户第一次打开的页面" accent="bg-emerald-500" />
      <PageRankList title="出口页（最后停留）" items={aggregates.exitPages} hint="用户离开前停留的最后一个页面" accent="bg-rose-500" />
    </section>
  );
}

function PageRankList({
  title,
  items,
  hint,
  accent,
}: {
  title: string;
  items: Array<{ page: string; count: number; rate: number }>;
  hint: string;
  accent: string;
}) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">暂无数据。</p>
      ) : (
        <div className="mt-4 grid gap-2">
          {items.slice(0, 10).map((item) => (
            <div key={item.page} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium text-slate-700">{item.page}</span>
                <span className="text-slate-600">{item.count} · {item.rate}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${accent}`}
                  style={{ width: `${Math.max(8, Math.round((item.count / max) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DropOffPanel({ aggregates }: { aggregates: JourneyAggregates }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">流失节点（最后停留页）</h2>
        <p className="mt-1 text-sm text-slate-500">每个用户最后一次访问的页面。占比越高，说明越多人在此停止了活动，是动线优化的重点。</p>
      </div>
      {aggregates.dropOffPages.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">暂无流失数据。</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
          <div className="grid grid-cols-3 gap-3 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
            <span>流失页面</span><span>人数</span><span>流失率</span>
          </div>
          {aggregates.dropOffPages.map((item) => (
            <div key={item.page} className="grid grid-cols-3 gap-3 border-t border-slate-100 px-3 py-2 text-sm">
              <span className="truncate font-medium text-slate-800">{item.page}</span>
              <span className="text-slate-600">{item.count}</span>
              <span className="text-rose-600">{item.rate}%</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TimeToFirstActionPanel({ aggregates }: { aggregates: JourneyAggregates }) {
  const t = aggregates.timeToFirstAction;
  const max = Math.max(...t.buckets.map((b) => b.count), 1);
  const medianLabel = t.medianMs < 60000
    ? `${Math.round(t.medianMs / 1000)}秒`
    : t.medianMs < 3600000
      ? `${Math.round(t.medianMs / 60000)}分钟`
      : `${(t.medianMs / 3600000).toFixed(1)}小时`;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">首次行动耗时</h2>
          <p className="mt-1 text-sm text-slate-500">用户从首次访问到第一次发起对话/生成报告/进入路径/完成行动的时间</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">中位数（{t.sampleSize} 样本）</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{medianLabel}</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-5">
        {t.buckets.map((b) => (
          <div key={b.bucket} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{b.bucket}</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{b.count}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-violet-500"
                style={{ width: `${Math.max(8, Math.round((b.count / max) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function UserJourneyTable({ journeys }: { journeys: UserJourney[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'lastAt' | 'pageViews' | 'dwellMs' | 'chatTurns' | 'reportsGenerated'>('lastAt');
  const [stageFilter, setStageFilter] = useState<string>('all');

  const filtered = journeys.filter((j) => stageFilter === 'all' || j.stagesReached.includes(stageFilter));
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'lastAt') return String(b.lastAt || '').localeCompare(String(a.lastAt || ''));
    if (sortBy === 'pageViews') return b.pageViews - a.pageViews;
    if (sortBy === 'dwellMs') return b.dwellMs - a.dwellMs;
    if (sortBy === 'chatTurns') return b.chatTurns - a.chatTurns;
    if (sortBy === 'reportsGenerated') return b.reportsGenerated - a.reportsGenerated;
    return 0;
  });

  const stageFilters = [
    { key: 'all', label: '全部' },
    { key: 'visit', label: '仅访问' },
    { key: 'chat', label: '已对话' },
    { key: 'report', label: '已出报告' },
    { key: 'path', label: '进路径' },
    { key: 'action', label: '完成行动' },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">用户行为旅程明细</h2>
          <p className="mt-0.5 text-xs text-slate-500">按访客 ID 聚合，点击行展开查看关键行动时序</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400"
          >
            {stageFilters.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-indigo-400"
          >
            <option value="lastAt">最近活跃</option>
            <option value="pageViews">浏览量</option>
            <option value="dwellMs">停留时长</option>
            <option value="chatTurns">对话轮次</option>
            <option value="reportsGenerated">出报告数</option>
          </select>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">暂无行为旅程数据。</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
          <div className="min-w-[1200px] grid grid-cols-12 gap-3 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
            <span>用户</span>
            <span>阶段</span>
            <span>页面浏览</span>
            <span>停留</span>
            <span>入口</span>
            <span>出口/流失</span>
            <span>来源</span>
            <span>会话</span>
            <span>对话</span>
            <span>报告</span>
            <span>路径</span>
            <span>行动</span>
          </div>
          {sorted.slice(0, 50).map((item) => {
            const isExpanded = expanded === item.visitor;
            return (
              <div key={item.visitor}>
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : item.visitor)}
                  className="min-w-[1200px] grid w-full grid-cols-12 gap-3 border-t border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span className="truncate font-medium text-slate-800">
                    <span className="mr-1 text-slate-400">{isExpanded ? '▾' : '▸'}</span>
                    {item.visitor}
                  </span>
                  <span className="text-slate-600">
                    {item.stagesReached.map((s) => (
                      <span key={s} className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">{s}</span>
                    ))}
                  </span>
                  <span className="text-slate-700">{item.pageViews}</span>
                  <span className="text-slate-600">{formatMs(item.dwellMs)}</span>
                  <span className="truncate text-slate-600">{item.firstPage || '-'}</span>
                  <span className="truncate text-slate-600">{item.lastPage || '-'}</span>
                  <span className="truncate text-slate-500">{item.entrySource}</span>
                  <span className="text-slate-600">{item.sessions}</span>
                  <span className="text-slate-600">{item.chatTurns}</span>
                  <span className="text-slate-600">{item.reportsGenerated}</span>
                  <span className="text-slate-600">{item.pathMessages}</span>
                  <span className="text-slate-600">{item.actionsCompleted}</span>
                </button>
                {isExpanded ? (
                  <div className="border-t border-slate-100 bg-slate-50 px-3 py-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs font-medium text-slate-500">首次访问</p>
                        <p className="mt-1 text-sm text-slate-800">{item.firstAt ? new Date(item.firstAt).toLocaleString('zh-CN') : '-'}</p>
                        <p className="mt-2 text-xs font-medium text-slate-500">最近活跃</p>
                        <p className="mt-1 text-sm text-slate-800">{item.lastAt ? new Date(item.lastAt).toLocaleString('zh-CN') : '-'}</p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs font-medium text-slate-500">平均单页停留</p>
                        <p className="mt-1 text-sm text-slate-800">{formatMs(item.avgDwellMs)}</p>
                        <p className="mt-2 text-xs font-medium text-slate-500">首次行动耗时</p>
                        <p className="mt-1 text-sm text-slate-800">
                          {item.timeToFirstActionMs !== null ? formatMs(item.timeToFirstActionMs) : '尚未发起行动'}
                        </p>
                      </div>
                      <div className="rounded-xl bg-white p-3">
                        <p className="text-xs font-medium text-slate-500">报告查看</p>
                        <p className="mt-1 text-sm text-slate-800">{item.reportViews} 次 · 停留 {formatMs(item.reportEngagementMs)}</p>
                        <p className="mt-2 text-xs font-medium text-slate-500">分享/保存</p>
                        <p className="mt-1 text-sm text-slate-800">{item.shares}</p>
                        {item.timeFromChatToReportMs !== null ? (
                          <>
                            <p className="mt-2 text-xs font-medium text-slate-500">对话→报告耗时</p>
                            <p className="mt-1 text-sm text-slate-800">{formatMs(item.timeFromChatToReportMs)}</p>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 rounded-xl bg-white p-3">
                      <p className="text-xs font-medium text-slate-500">关键行动时序（{item.keyActions.length} 条）</p>
                      <div className="mt-2 grid gap-2">
                        {item.keyActions.length === 0 ? (
                          <p className="text-sm text-slate-500">无关键行动记录。</p>
                        ) : (
                          item.keyActions.map((action, idx) => (
                            <div key={idx} className="flex items-center gap-3 text-sm">
                              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">{action.type}</span>
                              <span className="text-slate-600">{action.at ? new Date(action.at).toLocaleString('zh-CN') : '-'}</span>
                              <span className="truncate text-slate-400">页面：{action.page || '-'}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function formatMs(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '0秒';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes}分${rest}秒` : `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const restMin = minutes % 60;
  return restMin ? `${hours}时${restMin}分` : `${hours}小时`;
}
