'use client';

import { useMemo, useState } from 'react';
import {
  CAREER_QUADRANT_META,
  DELIVERY_FORMAT_LABELS,
  LEGO_BLOCK_LABELS,
  LEGO_PENDING_NICHE,
  MARKET_DENSITY_META,
  QUADRANT_FIT_META,
  computeQuadrantFit,
  displayPathTitle,
  type CareerQuadrant,
  type LegoPath,
  type MarketDensity,
  type PathLegoProfile,
  type PathValueProfile,
  type QuadrantFit,
} from '@/lib/path-lego';
import { drawPathShareCard, type ShareCardQuadrant } from '@/lib/path-share-canvas';

const SHARE_SITE_URL = 'https://echotalent.fun/path';

const QUADRANT_ORDER: CareerQuadrant[] = ['embodied', 'expert', 'nomad', 'ai-leveraged'];
// 格子内排序：真实在招岗位在前，小众次之，教练碰撞的自创组合在后
const DENSITY_SORT_ORDER: Record<MarketDensity, number> = { common: 0, niche: 1, created: 2 };

function LegoBlock({
  index,
  blockKey,
  values,
  pending,
}: {
  index: number;
  blockKey: keyof typeof LEGO_BLOCK_LABELS;
  values: string[];
  pending?: boolean;
}) {
  const meta = LEGO_BLOCK_LABELS[blockKey];
  return (
    <div className="rounded-2xl border border-[#86B8FF]/22 bg-white/78 px-4 py-3">
      <div className="flex items-baseline gap-1.5">
        <span className="flex h-4 w-4 items-center justify-center self-center rounded-full bg-[#2A6FA3] text-[10px] font-bold text-white">
          {index}
        </span>
        <span className="text-sm font-bold leading-5 text-[#2A6FA3]">{meta.english}</span>
        <span className="text-[11px] font-medium text-[#7A97B5]">{meta.title}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span
            key={value}
            className={`text-sm font-semibold leading-6 ${pending ? 'text-amber-600' : 'text-[#2A6FA3]'}`}
          >
            {value}
          </span>
        ))}
      </div>
      <div className="mt-1 text-[10px] leading-4 text-[#A9BDD1]">{meta.hint}</div>
    </div>
  );
}

export function PathLegoPanel({
  profile,
  paths,
  valueProfile,
  shareName,
  shareArchetype,
  mainlinePathId,
  onSelectAsMainline,
}: {
  profile: PathLegoProfile | null;
  paths: LegoPath[];
  /** 用户价值画像（可选）：传入后象限显示个人适配标注 */
  valueProfile?: PathValueProfile | null;
  /** 分享卡标题中的对象名（测试画像名或用户昵称），可选 */
  shareName?: string;
  /** 分享卡上的职业原型，可选 */
  shareArchetype?: string;
  /** Step 2 已选定的主线路径 id，可选 */
  mainlinePathId?: string | null;
  /** 「设为主线」回调（Step 2 入口），不传则不显示按钮 */
  onSelectAsMainline?: (path: LegoPath) => void;
}) {
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [shareGenerating, setShareGenerating] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  // 全部路径（含受雇岗位）按象限落位，受雇岗位是象限里更现实的锚点
  const byQuadrant = useMemo(() => {
    const grouped: Partial<Record<CareerQuadrant, LegoPath[]>> = {};
    for (const path of paths) {
      if (!path.quadrant) continue;
      (grouped[path.quadrant] ||= []).push(path);
    }
    for (const key of Object.keys(grouped) as CareerQuadrant[]) {
      grouped[key]?.sort(
        (a, b) => DENSITY_SORT_ORDER[a.marketDensity] - DENSITY_SORT_ORDER[b.marketDensity]
      );
    }
    return grouped;
  }, [paths]);

  // 各象限的个人价值观适配标注（固定坐标系 + 个人投影）
  const quadrantFits = useMemo(() => {
    if (!valueProfile) return null;
    const fits = {} as Record<CareerQuadrant, { fit: QuadrantFit; reason: string }>;
    for (const quadrant of QUADRANT_ORDER) {
      fits[quadrant] = computeQuadrantFit(valueProfile, quadrant);
    }
    return fits;
  }, [valueProfile]);

  const selectedPath = paths.find((path) => path.id === selectedPathId) || null;
  const hasPaths = paths.length > 0;

  // 分享卡只在资料齐全时开放：三块积木全部确认 + 至少一条路径，
  // 避免出现「交付形态待确认」这类半成品仍被生成卡片对外分享
  const shareMissing = useMemo(() => {
    const missing: string[] = [];
    const superpowersReady = profile
      ? profile.superpowers.some((item) => item.trim() && item.trim() !== '待探索')
      : false;
    const deliveryReady = Boolean(profile && profile.deliveryFormat !== 'undecided');
    const nicheReady = Boolean(
      profile && profile.niches.some((theme) => theme.trim() && theme.trim() !== LEGO_PENDING_NICHE)
    );
    if (!superpowersReady) missing.push('积木①天赋能力');
    if (!deliveryReady) missing.push('积木②交付形态');
    if (!nicheReady) missing.push('积木③利基主题');
    if (!hasPaths) missing.push('路径清单');
    return missing;
  }, [profile, hasPaths]);
  const shareReady = shareMissing.length === 0;

  const handleGenerateShare = async () => {
    if (!profile || shareGenerating || !shareReady) return;
    setShareGenerating(true);
    setShareError(null);
    try {
      const { default: QRCode } = await import('qrcode');
      const qrDataUrl = await QRCode.toDataURL(SHARE_SITE_URL, {
        width: 480,
        margin: 1,
        color: { dark: '#1E4E79', light: '#FFFFFF' },
      });
      const quadrants: ShareCardQuadrant[] = QUADRANT_ORDER.map((quadrant) => ({
        key: quadrant,
        label: CAREER_QUADRANT_META[quadrant].label,
        paths: (byQuadrant[quadrant] || []).map((path) => ({
          symbol: MARKET_DENSITY_META[path.marketDensity].symbol,
          title: displayPathTitle(path.title),
        })),
      }));
      const niches = profile.niches.filter((theme) => theme !== LEGO_PENDING_NICHE);
      const canvas = await drawPathShareCard({
        superpowers: profile.superpowers.length ? profile.superpowers : ['待探索'],
        deliveryLabel:
          profile.deliveryFormat === 'undecided'
            ? '待确认 · 和教练聊聊'
            : DELIVERY_FORMAT_LABELS[profile.deliveryFormat],
        deliveryPending: profile.deliveryFormat === 'undecided',
        niches,
        nichePending: niches.length === 0,
        quadrants,
        name: shareName,
        archetype: shareArchetype,
        qrDataUrl,
        siteUrl: SHARE_SITE_URL,
      });
      setShareImageUrl(canvas.toDataURL('image/png'));
    } catch (error) {
      console.error('[path-share] generate failed', error);
      setShareError('分享卡片生成失败，请稍后再试。');
    } finally {
      setShareGenerating(false);
    }
  };

  const handleSaveShareImage = () => {
    if (!shareImageUrl) return;
    const link = document.createElement('a');
    link.href = shareImageUrl;
    link.download = `echotalent-path-${shareName || 'card'}.png`;
    link.click();
  };

  const handleNativeShare = async () => {
    if (!shareImageUrl) return;
    try {
      const blob = await (await fetch(shareImageUrl)).blob();
      const file = new File([blob], 'echotalent-path.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'EchoTalent · 我的路径积木' });
      } else {
        handleSaveShareImage();
      }
    } catch {
      // 用户取消系统分享不算错误
    }
  };

  if (!profile) return null;

  return (
    <section className="rounded-[1.6rem] border border-[#86B8FF]/26 bg-[linear-gradient(180deg,rgba(243,248,255,0.96)_0%,rgba(255,255,255,0.86)_100%)] p-5 shadow-[0_18px_50px_rgba(134,184,255,0.15)]">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#2A6FA3]">
        <span aria-hidden>🧩</span>
        我的路径积木
        <button
          type="button"
          onClick={handleGenerateShare}
          disabled={shareGenerating || !shareReady}
          title={shareReady ? '生成分享卡片' : `还差：${shareMissing.join(' / ')}`}
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-[#86B8FF]/35 bg-white/80 px-3 py-1 text-[11px] font-semibold text-[#2A6FA3] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          <span aria-hidden>↗</span>
          {shareGenerating ? '生成中…' : '分享卡片'}
        </button>
      </div>
      <p className="mt-1 text-xs leading-5 text-[#7A97B5]">
        理想职业 = 三块积木的组合。换一种拼法，就是一条新路径。
      </p>
      {!shareReady ? (
        <p className="mt-1 text-[11px] leading-5 text-[#A9BDD1]">
          三块积木和路径都确认后才能生成分享卡——还差：{shareMissing.join(' / ')}
        </p>
      ) : null}
      {shareError ? <p className="mt-2 text-xs text-rose-400">{shareError}</p> : null}

      {/* 三块积木 */}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <LegoBlock index={1} blockKey="superpower" values={profile.superpowers} />
        <LegoBlock
          index={2}
          blockKey="deliveryFormat"
          values={[profile.deliveryFormat === 'undecided' ? '待确认 · 和教练聊聊' : DELIVERY_FORMAT_LABELS[profile.deliveryFormat]]}
          pending={profile.deliveryFormat === 'undecided'}
        />
        <LegoBlock
          index={3}
          blockKey="niche"
          values={profile.niches}
          pending={profile.niches.length === 0 || profile.niches.every((theme) => theme === LEGO_PENDING_NICHE)}
        />
      </div>

      {/* 四象限图（含受雇现实岗位，白底胶囊） */}
      <div className="mt-4">
        <div className="text-center text-[11px] font-semibold tracking-wide text-[#7A97B5]">
          ▲ 重人际 · 线下体验（AI 难替代）
        </div>
        <div className="mt-1 flex items-stretch gap-1">
          <div className="flex w-5 items-center justify-center">
            <span className="whitespace-nowrap text-[11px] font-semibold tracking-wide text-[#7A97B5] [writing-mode:vertical-rl]">
              ◄ 低成本 · 单兵作战
            </span>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-1.5">
            {QUADRANT_ORDER.map((quadrant) => {
              const meta = CAREER_QUADRANT_META[quadrant];
              const quadrantPaths = byQuadrant[quadrant] || [];
              const fitInfo = quadrantFits?.[quadrant] || null;
              const fitMeta = fitInfo ? QUADRANT_FIT_META[fitInfo.fit] : null;
              return (
                <div
                  key={quadrant}
                  className="rounded-2xl border border-[#86B8FF]/18 bg-white/60 p-3"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div>
                      <div className="text-xs font-bold text-[#2A6FA3]">{meta.label}</div>
                    </div>
                    {fitMeta && fitInfo ? (
                      <span
                        title={fitInfo.reason}
                        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold leading-3 ${fitMeta.className}`}
                      >
                        {fitMeta.symbol} {fitMeta.label}
                      </span>
                    ) : null}
                  </div>
                  {quadrantPaths.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {quadrantPaths.map((path) => {
                        const isEmployment = path.deliveryFormat === 'employment';
                        return (
                          <button
                            key={path.id}
                            type="button"
                            onClick={() => setSelectedPathId(path.id === selectedPathId ? null : path.id)}
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-4 transition-colors ${
                              path.id === selectedPathId
                                ? 'border-[#2A6FA3] bg-[#2A6FA3] text-white'
                                : isEmployment
                                  ? 'border-[#B9D8F2] bg-white/95 text-[#2A6FA3] hover:border-[#86B8FF]/50'
                                  : 'border-[#86B8FF]/30 bg-[#F3F8FF]/80 text-[#2A6FA3] hover:bg-white'
                            }`}
                          >
                            <span aria-hidden>{MARKET_DENSITY_META[path.marketDensity].symbol}</span>
                            {displayPathTitle(path.title)}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-2 text-[10px] leading-4 text-[#A9BDD1]">
                      {!hasPaths
                        ? '完成 Step 1a 后，这里会显示你的组合路径'
                        : fitInfo
                          ? fitInfo.reason
                          : '暂无组合'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex w-5 items-center justify-center">
            <span className="whitespace-nowrap text-[11px] font-semibold tracking-wide text-[#7A97B5] [writing-mode:vertical-rl]">
              高单价 · 商业杠杆 ►
            </span>
          </div>
        </div>
        <div className="mt-1 text-center text-[11px] font-semibold tracking-wide text-[#7A97B5]">
          ▼ 线上 · 工具 · 数字资产
        </div>
      </div>

      {/* 市场密度图例 */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[#7A97B5]">
        {Object.values(MARKET_DENSITY_META).map((meta) => (
          <span key={meta.label} className="inline-flex items-center gap-1">
            <span aria-hidden className="text-[#2A6FA3]">{meta.symbol}</span>
            {meta.label} · {meta.description}
          </span>
        ))}
      </div>

      {/* 选中路径详情 */}
      {selectedPath ? (
        <div className="mt-3 rounded-2xl border border-[#86B8FF]/22 bg-white/85 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-[#2A6FA3]">{displayPathTitle(selectedPath.title)}</span>
            <span className="rounded-full bg-[#F3F8FF] px-2 py-0.5 text-[10px] font-semibold text-[#4A789C]">
              {DELIVERY_FORMAT_LABELS[selectedPath.deliveryFormat]}
            </span>
            <span className="rounded-full bg-[#F3F8FF] px-2 py-0.5 text-[10px] font-semibold text-[#4A789C]">
              {MARKET_DENSITY_META[selectedPath.marketDensity].symbol}{' '}
              {MARKET_DENSITY_META[selectedPath.marketDensity].label}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-6 text-[#4A789C]">{selectedPath.narrative}</p>
          {selectedPath.incomeReality ? (
            <p className="mt-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
              现实提示：{selectedPath.incomeReality}
            </p>
          ) : null}
          {onSelectAsMainline ? (
            <button
              type="button"
              onClick={() => onSelectAsMainline(selectedPath)}
              disabled={selectedPath.id === mainlinePathId}
              className={`mt-2.5 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                selectedPath.id === mainlinePathId
                  ? 'cursor-default border border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border border-[#2A6FA3]/25 bg-[#2A6FA3] text-white hover:bg-[#1E4E79]'
              }`}
            >
              {selectedPath.id === mainlinePathId ? '✓ 当前主线（Step 2 聚焦中）' : '设为 Step 2 主线'}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* 分享卡预览弹层 */}
      {shareImageUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B2440]/55 p-4 backdrop-blur-sm"
          onClick={() => setShareImageUrl(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-md overflow-auto rounded-3xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-[#2A6FA3]">路径积木分享卡</div>
              <button
                type="button"
                onClick={() => setShareImageUrl(null)}
                aria-label="关闭"
                className="rounded-full px-2 text-lg leading-6 text-[#7A97B5] hover:text-[#2A6FA3]"
              >
                ×
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shareImageUrl}
              alt="路径积木分享卡"
              className="mt-2 w-full rounded-2xl border border-[#86B8FF]/20"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleSaveShareImage}
                className="flex-1 rounded-full bg-[#2A6FA3] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1E4E79]"
              >
                保存图片
              </button>
              <button
                type="button"
                onClick={handleNativeShare}
                className="flex-1 rounded-full border border-[#86B8FF]/40 bg-[#F3F8FF] px-4 py-2 text-sm font-semibold text-[#2A6FA3] transition-colors hover:bg-white"
              >
                系统分享
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] leading-4 text-[#A9BDD1]">
              卡片右下角含产品二维码，扫码即可打开 {SHARE_SITE_URL.replace(/^https?:\/\//, '')}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
