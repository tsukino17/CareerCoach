'use client';

import { Compass, LockKeyhole, Map, Sparkles } from 'lucide-react';
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
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            <Map className="h-3.5 w-3.5" />
            现实路径地图
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">{preview.headline}</h2>
            <p className="max-w-xl text-sm leading-7 text-slate-600 md:text-base">{preview.introduction}</p>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200/80 bg-white/80 p-4 backdrop-blur">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles className="h-4 w-4 text-sky-500" />
            下一步会帮你看清
          </div>
          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
            <div>适合重点考虑的职业方向</div>
            <div>同一岗位在不同行业的真实差异</div>
            <div>在真正投递前该先准备什么</div>
          </div>
        </div>
      </div>

      {primaryCluster ? (
        <div className="mt-6 space-y-4">
          <article className="rounded-[1.5rem] border border-sky-200/80 bg-white/90 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                  <Compass className="h-3.5 w-3.5" />
                  当前优先验证的方向假设
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 md:text-2xl">{primaryCluster.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500 md:text-base">{primaryCluster.tagline}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {primaryCluster.strengths.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <p className="text-sm leading-7 text-slate-700 md:text-[15px]">{primaryCluster.fit_reason}</p>
              </div>
            </div>
          </article>

          {secondaryClusters.length > 0 ? (
            <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/80 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <div className="text-sm font-semibold text-slate-900">也可以对照观察的备选假设</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {secondaryClusters.map((cluster) => (
                  <article
                    key={cluster.id}
                    className="rounded-[1.25rem] border border-slate-200/80 bg-slate-50/80 p-4"
                  >
                    <div className="text-sm font-semibold text-slate-900">{cluster.name}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{cluster.tagline}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{cluster.fit_reason}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-4 rounded-[1.5rem] border border-slate-700/40 bg-[#1f2937] px-5 py-5 text-slate-50 shadow-[0_18px_50px_rgba(15,23,42,0.18)] md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-100">
            <LockKeyhole className="h-4 w-4 text-amber-200" />
            查看路径预览
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-300">
            登录后可把当前对话、职业报告和这份路径预览一起保存成你的长期职业档案。
          </p>
        </div>
        <Button onClick={onOpen} className="rounded-full bg-white px-6 text-slate-900 shadow-lg shadow-slate-950/10 hover:bg-slate-100">
          查看我的路径预览
        </Button>
      </div>
    </section>
  );
}
