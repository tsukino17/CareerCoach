'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type VisionDraft = {
  ideal_statement: string;
  daily_state: string;
  daily_routine: string;
  next_actions: string;
  already_have: string;
  can_grow: string;
  identity_words: string;
};

export default function VisionBoardPage() {
  const [draft, setDraft] = useState<VisionDraft>({
    ideal_statement:
      '发挥我的洞察力、结构化表达与共情能力，在职业发展与人才成长领域里，做“把复杂经验讲清楚、并转化为可执行选择”的工作。',
    daily_state: '大多数时候稳定、清醒，偶尔会因为“做得不够好”而有一点紧。',
    daily_routine: '上午做一段深度输入与输出；下午安排沟通与协作；晚上留出复盘与整理，保证睡前能收束。',
    next_actions: '把一个模糊的想法拆成 3 个可验证的小问题；整理 1 个案例；做 5 分钟的复盘记录。',
    already_have: '能持续观察自己与用户的真实需求，愿意把事情做细，能在复杂里保持秩序感。',
    can_grow: '更稳定地公开表达与输出，把“偶尔做到”变成“可重复的节奏”。',
    identity_words: '温柔、坚定、可靠',
  });

  const fullText = useMemo(() => {
    const lines = [
      draft.ideal_statement && `最理想的情况下，我想：${draft.ideal_statement}`,
      draft.daily_state && `我每天的状态是：${draft.daily_state}`,
      draft.daily_routine && `我一天的 routine 是：${draft.daily_routine}`,
      draft.next_actions && `为了更接近理想状态，我目前能做的事情是：${draft.next_actions}`,
      (draft.already_have || draft.can_grow) &&
        `和理想状态相比，我已经拥有的特质是：${draft.already_have}；我还可以再增加的部分是：${draft.can_grow}`,
      draft.identity_words && `我是一位${draft.identity_words}的人，我已经具备了实现理想的初步能力。`,
    ].filter(Boolean);
    return lines.join('\n\n');
  }, [draft]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const canGenerate = Boolean(fullText.trim());

  const handleGenerateImage = async () => {
    setImageError(null);
    if (!canGenerate) {
      setImageError('请先填写一些内容，再生成图片。');
      return;
    }
    setIsGenerating(true);
    try {
      const url = await renderVisionBoardImage({ draft });
      setImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch {
      setImageError('生成失败，请稍后重试。');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `identity-vision-board-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#F3F8FF 0%, #FFFFFF 55%, #F7FBFF 100%)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>身份愿景板</h1>
            <p style={{ marginTop: 8, color: 'rgba(15,23,42,0.65)', lineHeight: 1.6 }}>
              先把“初始目标与状态”写清楚。后续行动力教练会以此为底稿，持续见证与确认。
            </p>
          </div>
          <Link href="/coach/action" style={{ color: 'rgba(15,23,42,0.65)', textDecoration: 'none' }}>
            返回
          </Link>
        </div>

        <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
          <Field
            label="愿景宣言"
            placeholder="最理想的情况下，我想发挥我的___、___和___能力，在___领域里，做___相关的事情。"
            value={draft.ideal_statement}
            onChange={(v) => setDraft((p) => ({ ...p, ideal_statement: v }))}
          />
          <Field
            label="每日状态"
            placeholder="我每天的状态是……"
            value={draft.daily_state}
            onChange={(v) => setDraft((p) => ({ ...p, daily_state: v }))}
          />
          <Field
            label="一天的 routine"
            placeholder="我一天的 routine 是……"
            value={draft.daily_routine}
            onChange={(v) => setDraft((p) => ({ ...p, daily_routine: v }))}
          />
          <Field
            label="目前能做的事"
            placeholder="为了更接近理想状态，我目前能做的事情是……"
            value={draft.next_actions}
            onChange={(v) => setDraft((p) => ({ ...p, next_actions: v }))}
          />
          <Field
            label="已拥有的特质"
            placeholder="和理想状态相比，我已经拥有的特质是……"
            value={draft.already_have}
            onChange={(v) => setDraft((p) => ({ ...p, already_have: v }))}
          />
          <Field
            label="可增加的部分"
            placeholder="我还可以再增加的部分是……"
            value={draft.can_grow}
            onChange={(v) => setDraft((p) => ({ ...p, can_grow: v }))}
          />
          <Field
            label="身份关键词（3个）"
            placeholder="例如：温柔、坚定、可靠"
            value={draft.identity_words}
            onChange={(v) => setDraft((p) => ({ ...p, identity_words: v }))}
          />
        </div>

        <div
          style={{
            marginTop: 18,
            padding: 18,
            borderRadius: 18,
            border: '1px solid rgba(134,184,255,0.25)',
            background: 'rgba(255,255,255,0.75)',
          }}
        >
          <div style={{ fontWeight: 800, color: '#0f172a' }}>预览（文字将入库）</div>
          <pre
            style={{
              marginTop: 10,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'rgba(15,23,42,0.75)',
              lineHeight: 1.8,
              fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
            }}
          >
            {fullText || '填写上面的内容后，这里会生成你的愿景板文字预览。'}
          </pre>

          <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <button
              type="button"
              disabled={!canGenerate || isGenerating}
              onClick={handleGenerateImage}
              style={{
                padding: '10px 14px',
                borderRadius: 999,
                background: !canGenerate || isGenerating ? 'rgba(15,23,42,0.08)' : 'rgba(134,184,255,0.20)',
                border: '1px solid rgba(134,184,255,0.35)',
                color: '#0f172a',
                fontWeight: 800,
                cursor: !canGenerate || isGenerating ? 'not-allowed' : 'pointer',
              }}
            >
              {isGenerating ? '生成中…' : '生成图片'}
            </button>

            {imageUrl && (
              <button
                type="button"
                onClick={handleDownload}
                style={{
                  padding: '10px 14px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(15,23,42,0.12)',
                  color: '#0f172a',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                下载图片
              </button>
            )}

            {imageError && <span style={{ color: 'rgba(220,38,38,0.85)', fontSize: 13 }}>{imageError}</span>}
          </div>
        </div>

        {imageUrl && (
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 18,
              border: '1px solid rgba(134,184,255,0.22)',
              background: 'rgba(255,255,255,0.75)',
            }}
          >
            <div style={{ fontWeight: 800, color: '#0f172a' }}>图片预览</div>
            <img
              src={imageUrl}
              alt="身份愿景板分享图"
              style={{ marginTop: 10, width: '100%', height: 'auto', borderRadius: 14, display: 'block' }}
            />
          </div>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label
      style={{
        display: 'block',
        padding: 16,
        borderRadius: 18,
        border: '1px solid rgba(134,184,255,0.22)',
        background: 'rgba(134,184,255,0.08)',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{label}</div>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        style={{
          marginTop: 10,
          width: '100%',
          resize: 'vertical',
          borderRadius: 14,
          border: '1px solid rgba(15,23,42,0.10)',
          padding: 12,
          outline: 'none',
          background: 'rgba(255,255,255,0.85)',
          color: '#0f172a',
          lineHeight: 1.6,
        }}
      />
    </label>
  );
}

async function renderVisionBoardImage({ draft }: { draft: VisionDraft }) {
  const W = 1080;
  const H = 1600;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no context');

  const palette = {
    bgA: '#F3F8FF',
    bgB: '#FFFFFF',
    blob1: '#86B8FF',
    blob2: '#BBD9FF',
    ink: '#0f172a',
    muted: 'rgba(15,23,42,0.62)',
    card: 'rgba(255,255,255,0.56)',
    cardHi: 'rgba(255,255,255,0.18)',
    stroke: 'rgba(134,184,255,0.20)',
    accent: '#86B8FF',
  };

  const roundRectPath = (x: number, y: number, w: number, h: number, r: number) => {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  };

  const blob = (x: number, y: number, r: number, c: string, a = 0.7) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const measureTextWithTracking = (text: string, tracking: number) => {
    const chars = (text || '').split('');
    if (chars.length === 0) return 0;
    let w = 0;
    for (let i = 0; i < chars.length; i++) {
      w += ctx.measureText(chars[i]).width;
      if (i < chars.length - 1) w += tracking;
    }
    return w;
  };

  const drawTextWithTracking = (text: string, x: number, y: number, tracking: number) => {
    let cx = x;
    for (const ch of (text || '').split('')) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + tracking;
    }
  };

  const forbiddenLineStart = new Set([
    '，',
    '。',
    '、',
    '；',
    '：',
    '！',
    '？',
    '）',
    '】',
    '』',
    '”',
    '’',
    ',',
    '.',
    ';',
    '!',
    '?',
    '%',
    '…',
  ]);
  const openingChars = new Set(['“', '‘', '（', '【', '《', '"', "'"]);

  const wrapLinesWithTracking = (text: string, maxWidth: number, tracking: number) => {
    const lines: string[] = [];
    const normalized = (text || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return lines;

    let line = '';
    for (const ch of normalized.split('')) {
      const next = line + ch;
      if (measureTextWithTracking(next, tracking) <= maxWidth) {
        line = next;
        continue;
      }

      if (line && forbiddenLineStart.has(ch)) {
        let moved = '';
        while (line.length > 1 && measureTextWithTracking(line + ch, tracking) > maxWidth) {
          moved = line.slice(-1) + moved;
          line = line.slice(0, -1);
        }
        if (measureTextWithTracking(line + ch, tracking) <= maxWidth) {
          lines.push(line + ch);
          line = moved || '';
          continue;
        }
      }

      if (line && openingChars.has(line.slice(-1))) {
        const open = line.slice(-1);
        const rest = line.slice(0, -1);
        if (rest) lines.push(rest);
        line = open + ch;
        continue;
      }

      if (line) lines.push(line);
      line = ch;
    }
    if (line) lines.push(line);

    for (let i = 1; i < lines.length; i++) {
      let curr = lines[i] || '';
      let prev = lines[i - 1] || '';
      if (!curr || !prev) continue;

      const needsFix = () => curr.length <= 1 || forbiddenLineStart.has(curr[0]);
      let guard = 0;
      while (guard < 10 && needsFix() && prev.length > 1) {
        let take = curr.length <= 1 ? 2 : 1;
        take = Math.min(Math.max(take, prev.length === 2 ? 2 : 1), prev.length - 1);
        let segment = prev.slice(-take);
        while (segment && forbiddenLineStart.has(segment[0]) && take < prev.length - 1) {
          take += 1;
          segment = prev.slice(-take);
        }
        if (!segment) break;

        const nextPrev = prev.slice(0, -take);
        const nextCurr = segment + curr;
        if ((nextPrev || '').trim().length < 2) break;
        if (measureTextWithTracking(nextCurr, tracking) > maxWidth) break;
        if (forbiddenLineStart.has(nextCurr[0])) break;

        prev = nextPrev;
        curr = nextCurr;
        guard += 1;
      }

      lines[i - 1] = prev;
      lines[i] = curr;
    }

    return lines;
  };

  const ellipsizeToWidthWithTracking = (text: string, maxWidth: number, tracking: number) => {
    const t = (text || '').trim();
    if (!t) return '';
    if (measureTextWithTracking(t, tracking) <= maxWidth) return t;
    const ell = '…';
    if (measureTextWithTracking(ell, tracking) > maxWidth) return ell;
    let lo = 0;
    let hi = t.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const candidate = t.slice(0, mid) + ell;
      if (measureTextWithTracking(candidate, tracking) <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    return t.slice(0, lo) + ell;
  };

  const clampLines = (lines: string[], maxLines: number, maxWidth: number, tracking: number) => {
    if (lines.length <= maxLines) return lines;
    const clipped = lines.slice(0, maxLines);
    const last = clipped[clipped.length - 1] || '';
    clipped[clipped.length - 1] = ellipsizeToWidthWithTracking(last, maxWidth, tracking);
    return clipped;
  };

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = palette.bgA;
  ctx.fillRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, palette.bgA);
  bg.addColorStop(1, palette.bgB);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  blob(260, 300, 560, palette.blob1, 0.22);
  blob(920, 380, 620, palette.blob2, 0.22);
  blob(220, 1240, 520, palette.blob2, 0.14);
  blob(980, 1320, 560, palette.blob1, 0.14);

  const cardX = 70;
  const cardY = 80;
  const cardW = 940;
  const cardH = 1440;
  const cardR = 30;

  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  roundRectPath(cardX, cardY, cardW, cardH, cardR);
  ctx.fillStyle = palette.card;
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRectPath(cardX, cardY, cardW, cardH, cardR);
  ctx.clip();
  const sheen = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
  sheen.addColorStop(0, palette.cardHi);
  sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(255,255,255,0.10)');
  ctx.fillStyle = sheen;
  ctx.fillRect(cardX, cardY, cardW, cardH);
  ctx.restore();

  const pad = 64;
  const innerX = cardX + pad;
  const innerY = cardY + pad;
  const innerW = cardW - pad * 2;

  const family =
    '"Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';

  ctx.fillStyle = palette.muted;
  ctx.font = `700 28px ${family}`;
  ctx.fillText('Identity Vision Board', innerX, innerY + 10);

  ctx.fillStyle = palette.ink;
  ctx.font = `900 74px ${family}`;
  ctx.fillText('身份愿景板', innerX, innerY + 120);

  ctx.save();
  ctx.strokeStyle = palette.stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(innerX, innerY + 144);
  ctx.lineTo(innerX + 240, innerY + 144);
  ctx.stroke();
  ctx.restore();

  const sections: Array<{ label: string; value: string }> = [];
  if (draft.ideal_statement.trim()) sections.push({ label: '愿景宣言', value: draft.ideal_statement.trim() });
  if (draft.daily_state.trim()) sections.push({ label: '每日状态', value: draft.daily_state.trim() });
  if (draft.daily_routine.trim()) sections.push({ label: '一天的 routine', value: draft.daily_routine.trim() });
  if (draft.next_actions.trim()) sections.push({ label: '目前能做的事', value: draft.next_actions.trim() });
  if ((draft.already_have + draft.can_grow).trim()) {
    const combined = `已拥有：${draft.already_have.trim()}；可增加：${draft.can_grow.trim()}`.replace(/\s+/g, ' ').trim();
    sections.push({ label: '特质对照', value: combined });
  }
  if (draft.identity_words.trim()) sections.push({ label: '身份关键词', value: draft.identity_words.trim() });

  const contentMaxW = innerW;
  let y = innerY + 210;
  const trackings = [0, -0.4, -0.8, -1.2];

  for (const s of sections) {
    if (y > cardY + cardH - 120) break;

    ctx.save();
    ctx.fillStyle = 'rgba(134,184,255,0.26)';
    ctx.beginPath();
    ctx.arc(innerX + 8, y - 10, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.70)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(innerX + 8, y - 10, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = palette.ink;
    ctx.font = `800 30px ${family}`;
    ctx.fillText(s.label, innerX + 28, y);

    ctx.fillStyle = palette.muted;
    ctx.font = `400 26px ${family}`;
    const maxLines = 4;
    let chosenTracking = 0;
    let chosenLines: string[] = [];
    for (const t of trackings) {
      const lines = wrapLinesWithTracking(s.value, contentMaxW, t);
      const clamped = clampLines(lines, maxLines, contentMaxW, t);
      const bad = clamped.some((l) => {
        const tt = (l || '').trim();
        if (!tt) return true;
        if (tt.length <= 1) return true;
        return forbiddenLineStart.has(tt[0]);
      });
      if (!bad) {
        chosenTracking = t;
        chosenLines = clamped;
        break;
      }
    }
    if (chosenLines.length === 0) {
      chosenTracking = -0.8;
      chosenLines = clampLines(wrapLinesWithTracking(s.value, contentMaxW, chosenTracking), maxLines, contentMaxW, chosenTracking);
    }

    let ly = y + 46;
    for (const line of chosenLines) {
      if (chosenTracking) drawTextWithTracking(line, innerX + 28, ly, chosenTracking);
      else ctx.fillText(line, innerX + 28, ly);
      ly += 42;
    }
    y = ly + 18;
  }

  ctx.fillStyle = 'rgba(15,23,42,0.45)';
  ctx.font = `500 20px ${family}`;
  ctx.fillText('EchoTalent · Action Coach', innerX, cardY + cardH - 52);

  const pngBlob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (!b) reject(new Error('toBlob failed'));
      else resolve(b);
    }, 'image/png');
  });
  return URL.createObjectURL(pngBlob);
}
