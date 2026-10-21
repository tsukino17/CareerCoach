'use client';

import { useAdminData } from '@/components/admin/admin-shell';
import type { DailyMetric, InsightsResponse, MetricKey } from '@/lib/admin-types';
import type { RealityPathStats } from '@/lib/path-analytics';

export default function AdminOverviewPage() {
  const { data } = useAdminData();
  if (!data) return null;

  return (
    <div className="space-y-5">
      {data.setupWarnings?.length ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {data.setupWarnings.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </section>
      ) : null}

      <TotalsSummary data={data} />

      <RealityPathPanel stats={data.realityPath} />

      <MetricTrendChart
        range={data.range}
        metrics={data.dailyMetrics || []}
        activeMetric="pv"
      />

      <RetentionPanel retention={data.retention} />

      <section className="grid gap-4 md:grid-cols-3">
        <RankCard title="访问来源" items={data.sourceStats} empty="暂无来源数据" />
        <RankCard title="访问城市" items={data.cityStats} empty="暂无城市数据" />
        <RankCard title="功能使用" items={data.featureStats} empty="暂无功能数据" />
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
    </div>
  );
}

function TotalsSummary({ data }: { data: InsightsResponse }) {
  const cards = [
    { label: '访问量 PV', value: data.totals.events, detail: '事件总数' },
    { label: '访客数 UV', value: data.totals.uniqueVisitors, detail: `登录 ${data.totals.authenticatedVisitors} 人` },
    { label: '注册人数', value: data.totals.registrations, detail: '本时段新增' },
    { label: '消息样本', value: data.totals.messages, detail: `对话 ${data.conversationStats.conversations} 场` },
    { label: '平均停留', value: data.totals.avgEngagementLabel, detail: '按页面停留' },
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{card.label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{card.value}</p>
          <p className="mt-1 text-xs text-slate-500">{card.detail}</p>
        </div>
      ))}
    </section>
  );
}

function RealityPathPanel({ stats }: { stats?: RealityPathStats }) {
  if (!stats) return null;
  const steps = [
    { label: '打开路径页', value: stats.openedVisitors, unit: '人', hint: '去重访客' },
    { label: '设定主线', value: stats.mainlinesSelected, unit: '次', hint: stats.mainlineBlocked ? `另有 ${stats.mainlineBlocked} 次因未达门槛被拦` : '完成度达标后可选主线' },
    { label: '解锁 Step 2', value: stats.step2UnlockedVisitors, unit: '人', hint: '积木齐全 + 证据 ≥2' },
    { label: '解锁 Step 3', value: stats.step3UnlockedVisitors, unit: '人', hint: '需求对照 + 意愿确认' },
    { label: '确认微行动', value: stats.microActions, unit: '条', hint: '写入任务列表' },
  ];
  const maxValue = Math.max(...steps.map((item) => item.value), 1);
  const hasData = steps.some((item) => item.value > 0)
    || stats.chatConversations > 0
    || stats.evidence.total > 0
    || stats.requirements.total > 0
    || stats.readiness.count > 0
    || stats.shareCards > 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">现实路径教练</h2>
          <p className="mt-1 text-sm text-slate-500">从打开路径页到确认第一个微行动，各步骤的完成与流失</p>
        </div>
        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">路径三步</span>
      </div>

      {!hasData ? (
        <p className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">当前日期范围暂无现实路径数据。</p>
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step) => (
              <div key={step.label} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">{step.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {step.value}
                  <span className="ml-1 text-sm font-medium text-slate-500">{step.unit}</span>
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-sky-500"
                    style={{ width: `${Math.max(2, Math.round((step.value / maxValue) * 100))}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">{step.hint}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatGroup
              title="教练对话"
              rows={[
                ['对话场次', stats.chatConversations],
                ['用户消息', stats.chatUserMessages],
              ]}
            />
            <StatGroup
              title="能力证据卡"
              rows={[
                ['已证实', stats.evidence.confirmed],
                ['部分证实', stats.evidence.partial],
                ['用户否定', stats.evidence.rejected],
              ]}
            />
            <StatGroup
              title="需求对照"
              rows={[
                ['已对上', stats.requirements.checked],
                ['待确认', stats.requirements.pending],
                ['暂无线索', stats.requirements.gap],
              ]}
            />
            <StatGroup
              title="意愿与准备度"
              rows={[
                ['想做 / 观望 / 不想做', `${stats.willingness.want} / ${stats.willingness.unsure} / ${stats.willingness.no}`],
                ['准备度卡 / 平均分', `${stats.readiness.count} / ${stats.readiness.averageScore}`],
                ['生成分享卡', stats.shareCards],
              ]}
            />
          </div>
        </>
      )}
    </section>
  );
}

function StatGroup({ title, rows }: { title: string; rows: Array<[string, number | string]> }) {
  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <div className="mt-2 space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-500">{label}</span>
            <span className="font-semibold text-slate-900">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RetentionPanel({ retention }: { retention: InsightsResponse['retention'] }) {
  if (!retention) return null;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">回访与使用粘性</h2>
          <p className="mt-1 text-sm text-slate-500">区分重新打开网站、继续使用和重复获得价值</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">当前日期范围</span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <RetentionMetric label="回访用户" value={`${retention.repeatVisitors} 人`} detail={`占访客 ${retention.repeatVisitorRate}%`} />
        <RetentionMetric label="重复有效使用" value={`${retention.repeatMeaningfulUsers} 人`} detail={`占访客 ${retention.repeatMeaningfulRate}%`} />
        <RetentionMetric label="访客总数" value={`${retention.visitors} 人`} detail="按登录用户或匿名访客去重" />
      </div>
      <div className="mt-5">
        <p className="text-sm font-medium text-slate-700">按活跃天数分布</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {Object.entries(retention.activeDayBuckets).map(([label, count]) => (
            <div key={label} className="rounded-xl bg-slate-50 px-3 py-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{count}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RetentionMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function RankCard({ title, items, empty }: { title: string; items: Array<{ name: string; count: number }>; empty: string }) {
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
}> = [
  { key: 'pv', label: '访问量 PV', accent: '#f97362', value: (m) => m.pv },
  { key: 'uv', label: '触达人数 UV', accent: '#0ea5e9', value: (m) => m.uv },
  { key: 'registrations', label: '注册人数', accent: '#10b981', value: (m) => m.registrations },
  { key: 'totalMessages', label: '消息样本', accent: '#14b8a6', value: (m) => m.totalMessages },
  { key: 'conversations', label: '对话轮次', accent: '#ec4899', value: (m) => m.conversations },
  { key: 'activeChatUsers', label: '对话人数', accent: '#22c55e', value: (m) => m.activeChatUsers },
];

function MetricTrendChart({
  range,
  metrics,
  activeMetric,
}: {
  range: InsightsResponse['range'];
  metrics: DailyMetric[];
  activeMetric: MetricKey;
}) {
  const metricOption = METRIC_OPTIONS.find((item) => item.key === activeMetric) || METRIC_OPTIONS[0];
  const metricMap = new Map(metrics.map((item) => [item.date, item]));
  const dates = buildDateSeries(range.startDate, range.endDate);
  const series = dates.map((date) => metricMap.get(date) || {
    date, pv: 0, uv: 0, registrations: 0, authenticatedVisitors: 0, avgEngagementMs: 0,
    totalMessages: 0, userMessages: 0, assistantMessages: 0, conversations: 0,
    activeChatUsers: 0, userTextChars: 0, assistantTextChars: 0, totalTextChars: 0,
  });
  const values = series.map(metricOption.value);
  const total = values.reduce((sum, v) => sum + v, 0);
  const average = values.length > 0 ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0;
  const peak = Math.max(...values, 0);
  const width = 720;
  const height = 240;
  const padding = 32;
  const maxValue = Math.max(...values, 1);
  const point = (index: number, value: number) => {
    const x = series.length <= 1 ? width / 2 : padding + (index / (series.length - 1)) * (width - padding * 2);
    const y = height - padding - (value / maxValue) * (height - padding * 2);
    return { x, y };
  };
  const line = () => values.map((value, index) => {
    const p = point(index, value);
    return `${p.x},${p.y}`;
  }).join(' ');
  const labelStep = Math.max(1, Math.ceil(series.length / 8));
  const hasAnyData = values.some((v) => v > 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">运营指标趋势</h2>
          <p className="mt-1 text-sm text-slate-500">访问、注册、停留和对话数据</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {range.startDate} 至 {range.endDate}
        </span>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">当前指标合计</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{String(Math.round(total))}</p>
          <p className="mt-1 text-sm text-slate-500">{metricOption.label}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">日均</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{String(average)}</p>
          <p className="mt-1 text-sm text-slate-500">按所选日期范围计算</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">单日峰值</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{String(peak)}</p>
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
                  {Math.round(maxValue * (1 - tick))}
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
                  <text x={p.x} y={height - 8} textAnchor="middle" fontSize="10" fill="#64748b">
                    {item.date.slice(5)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      {!hasAnyData ? (
        <p className="mt-2 text-xs text-slate-500">当前日期范围暂无 {metricOption.label} 数据。</p>
      ) : null}
    </section>
  );
}
