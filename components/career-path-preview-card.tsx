'use client';

import { ArrowRight, Compass, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PathMapPreview } from '@/lib/career-path';

export function CareerPathPreviewCard({
  preview,
  onOpen,
}: {
  preview: PathMapPreview;
  onOpen?: () => void;
}) {
  const primaryCluster = preview.direction_clusters[0];
  const secondaryClusters = preview.direction_clusters.slice(1, 3);

  return (
    <section className="mt-12 rounded-[2rem] border border-slate-200/80 bg-gradient-to-br from-[#fffaf2] via-white to-[#f4f8ff] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] md:p-8">
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
          <Map className="h-3.5 w-3.5" />
          下一步 · 现实路径探索
        </div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">先从更值得关注的方向开始</h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
          这些是结合当前信息给出的优先建议，不代表排除其他职业可能性。
        </p>
      </div>

      {primaryCluster ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
          <article className="rounded-[1.5rem] border border-sky-200/80 bg-white/90 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] md:p-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              <Compass className="h-3.5 w-3.5" />
              优先推荐
            </div>
            <h3 className="mt-3 text-xl font-bold text-slate-900 md:text-2xl">{primaryCluster.name}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">{primaryCluster.tagline}</p>
            <p className="mt-4 text-sm leading-7 text-slate-700 md:text-[15px]">{primaryCluster.fit_reason}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {primaryCluster.sample_roles.slice(0, 3).map((role) => (
                <span key={role} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{role}</span>
              ))}
            </div>
          </article>

          {secondaryClusters.length > 0 ? (
            <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/75 p-5">
              <div className="text-sm font-semibold text-slate-900">也值得继续了解</div>
              <div className="mt-3 space-y-3">
                {secondaryClusters.map((cluster) => (
                  <article key={cluster.id} className="rounded-xl border border-slate-200/70 bg-slate-50/75 p-3">
                    <div className="text-sm font-semibold text-slate-900">{cluster.name}</div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{cluster.tagline}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-4 rounded-[1.5rem] border border-slate-700/40 bg-[#1f2937] px-5 py-5 text-slate-50 shadow-[0_18px_50px_rgba(15,23,42,0.18)] md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-sky-100">接下来，在现实路径地图里继续梳理</div>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            和教练聊清想法，记录重要发现，再由你决定下一步。
          </p>
        </div>
        <Button onClick={onOpen} className="rounded-full bg-white px-6 text-slate-900 shadow-lg shadow-slate-950/10 hover:bg-slate-100">
          进入现实路径 <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
