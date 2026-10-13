'use client';

import { useAdminData } from '@/components/admin/admin-shell';
import type { AiUsageAdminStats } from '@/lib/admin-types';

export default function AiUsagePage() {
  const { data } = useAdminData();
  if (!data) return null;
  const usage = data.aiUsage;

  if (!usage || usage.totalCalls === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <h2 className="text-lg font-semibold text-slate-900">AI Token 用量</h2>
        <p className="mt-2 text-sm text-slate-500">当前日期范围暂无 AI 调用数据。用户开始对话后，这里会展示 Token 消耗统计。</p>
      </section>
    );
  }

  const maxRouteTokens = Math.max(...usage.byRoute.map((r) => r.tokens), 1);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <UsageCard label="总 Token" value={usage.totalTokens} detail={`提示 ${usage.promptTokens.toLocaleString()} · 补全 ${usage.completionTokens.toLocaleString()}`} />
        <UsageCard label="调用次数" value={usage.totalCalls} detail={`均 ${usage.avgTokensPerCall.toLocaleString()} tokens/次`} />
        <UsageCard label="活跃用户" value={usage.uniqueUsers} detail="含登录与匿名" />
        <UsageCard label="人均 Token" value={usage.avgTokensPerUser} detail="按用户去重后均摊" />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <RouteUsagePanel usage={usage} maxRouteTokens={maxRouteTokens} />
        <UserUsagePanel usage={usage} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-slate-800">按模型分拆</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {usage.byModel.map((item) => (
            <span key={item.model} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
              {item.model} · {item.tokens.toLocaleString()} tokens · {item.calls} 次
            </span>
          ))}
        </div>
      </section>

      {usage.byDay.length > 0 ? <DailyUsagePanel usage={usage} /> : null}
    </div>
  );
}

function UsageCard({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function RouteUsagePanel({ usage, maxRouteTokens }: { usage: AiUsageAdminStats; maxRouteTokens: number }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-800">按路由分拆</h2>
      <div className="mt-3 grid gap-2">
        {usage.byRoute.map((item) => (
          <div key={item.route} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium text-slate-700">{item.route}</span>
              <span className="text-slate-500">{item.tokens.toLocaleString()} ({item.calls} 次)</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${Math.max(8, Math.round((item.tokens / maxRouteTokens) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function UserUsagePanel({ usage }: { usage: AiUsageAdminStats }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-800">按用户 Top 10</h2>
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">
        <div className="grid grid-cols-3 gap-2 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
          <span>用户</span><span>Token</span><span>次数</span>
        </div>
        {usage.byUser.length === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-500">暂无用户数据。</p>
        ) : (
          usage.byUser.map((item) => (
            <div key={item.userKey} className="grid grid-cols-3 gap-2 border-t border-slate-100 px-3 py-2 text-sm">
              <span className="truncate font-medium text-slate-800">{item.userKey}</span>
              <span className="text-slate-600">{item.tokens.toLocaleString()}</span>
              <span className="text-slate-600">{item.calls}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function DailyUsagePanel({ usage }: { usage: AiUsageAdminStats }) {
  const max = Math.max(...usage.byDay.map((d) => d.tokens), 1);
  const sorted = [...usage.byDay].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-slate-800">每日 Token 消耗</h2>
      <div className="mt-3 grid gap-2">
        {sorted.map((d) => (
          <div key={d.date} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700">{d.date}</span>
              <span className="text-slate-500">{d.tokens.toLocaleString()} tokens · {d.calls} 次</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-violet-500"
                style={{ width: `${Math.max(8, Math.round((d.tokens / max) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
