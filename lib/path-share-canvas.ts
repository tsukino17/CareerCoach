import type { CareerQuadrant } from '@/lib/path-lego';

/**
 * 路径积木分享卡绘制器：Canvas 2D 手绘高清分享图（1080 宽，高度按内容自适应）。
 * 视觉延续产品浅蓝天空系：渐变底 + 三积木白卡 + 四象限地图 + 深蓝收尾条（含产品二维码）。
 */

export type ShareCardQuadrant = {
  key: CareerQuadrant;
  label: string;
  /** 象限内路径（已按密度排序），每项含密度符号与展示标题 */
  paths: Array<{ symbol: string; title: string }>;
};

export type PathShareCardInput = {
  /** 积木①天赋能力（1-3 个） */
  superpowers: string[];
  /** 积木②交付形态展示文案（含"待确认"状态） */
  deliveryLabel: string;
  deliveryPending: boolean;
  /** 积木③利基主题（1-3 个） */
  niches: string[];
  nichePending: boolean;
  /** 四象限（固定 4 格顺序：embodied / expert / nomad / ai-leveraged） */
  quadrants: ShareCardQuadrant[];
  /** 分享对象名（测试画像名或用户昵称），可选 */
  name?: string;
  /** 职业原型，可选 */
  archetype?: string;
  /** 产品二维码 dataURL（预先异步生成） */
  qrDataUrl: string;
  /** 站点地址（footer 展示） */
  siteUrl: string;
};

const W = 1080;
const PAD = 72;

// 品牌色板（与产品面板一致）
const C = {
  deepBlue: '#1E4E79',
  brand: '#2A6FA3',
  grayBlue: '#7A97B5',
  lightGray: '#A9BDD1',
  amber: '#B97A1E',
  bgTop: '#F7FBFF',
  bgBottom: '#EAF3FE',
  cardBorder: 'rgba(134, 184, 255, 0.28)',
  cellBg: 'rgba(255, 255, 255, 0.78)',
  cellBorder: 'rgba(134, 184, 255, 0.22)',
};

const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif';

function font(size: number, weight: 'normal' | 'bold' = 'normal') {
  return `${weight} ${size}px ${FONT}`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth) end -= 1;
  return `${text.slice(0, end)}…`;
}

/** 流式绘制文本 chips，返回占用高度 */
function drawChips(
  ctx: CanvasRenderingContext2D,
  chips: string[],
  startX: number,
  startY: number,
  maxWidth: number,
  size: number,
  color: string
) {
  const lineHeight = size * 1.5;
  const gapX = 14;
  let x = startX;
  let y = startY;
  ctx.font = font(size, 'bold');
  ctx.fillStyle = color;
  for (const chip of chips) {
    const width = ctx.measureText(chip).width;
    if (x > startX && x + width > startX + maxWidth) {
      x = startX;
      y += lineHeight;
    }
    ctx.fillText(chip, x, y + size);
    x += width + gapX;
  }
  return y + lineHeight - startY;
}

export async function drawPathShareCard(input: PathShareCardInput): Promise<HTMLCanvasElement> {
  // 二维码图先加载完成再绘制，避免导出时缺码
  const qrImage = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('QR image failed to load'));
    image.src = input.qrDataUrl;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.font = font(28);
  const cellW = (W - PAD * 2 - 24) / 2;
  const innerW = cellW - 40;

  // 预计算四象限格高（标题行 + 最多 4 行路径）
  const quadrantHeights = input.quadrants.map((quadrant) => {
    const rows = Math.min(quadrant.paths.length, 4);
    const moreRow = quadrant.paths.length > 4 ? 34 : 0;
    return 30 + 14 + rows * 34 + moreRow + 34;
  });
  const cellH = Math.max(200, ...quadrantHeights);

  // 高度估算：header + hero + blocks 卡 + 象限 + 图例 + footer
  const blocksCardTop = 380;
  const blockValueSize = 28;
  const blockLabelH = 40;
  const blockLineH = blockValueSize * 1.5;
  // 三块积木各占 label + 值行数（预流式计算）
  let measureY = 0;
  const blockHeights = [
    { values: input.superpowers, pending: false },
    { values: [input.deliveryLabel], pending: input.deliveryPending },
    { values: input.niches.length ? input.niches : ['待探索'], pending: input.nichePending },
  ].map((block) => {
    measureY = 0;
    ctx.font = font(blockValueSize, 'bold');
    let x = 0;
    for (const chip of block.values) {
      const width = ctx.measureText(chip).width;
      if (x > 0 && x + width > W - PAD * 2 - 48) {
        x = 0;
        measureY += blockLineH;
      }
      x += width + 14;
    }
    return blockLabelH + measureY + blockLineH + 34;
  });
  const blocksCardH = blockHeights.reduce((sum, h) => sum + h, 0) + 24;

  const quadrantTop = blocksCardTop + blocksCardH + 44;
  const legendTop = quadrantTop + cellH * 2 + 16 + 40;
  const footerTop = legendTop + 56;
  const footerH = 220;
  const H = Math.ceil(footerTop + footerH + PAD * 0.6);

  canvas.width = W;
  canvas.height = H;

  // ── 背景：浅蓝渐变 + 两团柔光 ──
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, C.bgTop);
  bg.addColorStop(1, C.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  for (const [cx, cy, r] of [
    [W * 0.85, 120, 340],
    [-60, H * 0.42, 300],
  ] as const) {
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    glow.addColorStop(0, 'rgba(134, 184, 255, 0.20)');
    glow.addColorStop(1, 'rgba(134, 184, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // ── Header：品牌行 ──
  const logoY = PAD + 22;
  const logoGrad = ctx.createLinearGradient(PAD, logoY - 16, PAD + 32, logoY + 16);
  logoGrad.addColorStop(0, '#86B8FF');
  logoGrad.addColorStop(1, C.brand);
  ctx.fillStyle = logoGrad;
  ctx.beginPath();
  ctx.arc(PAD + 16, logoY, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.brand;
  ctx.font = font(26, 'bold');
  ctx.fillText('EchoTalent · 天赋回声', PAD + 46, logoY + 9);

  // ── Hero：标题 + 副题 + 原型徽章 ──
  let y = logoY + 66;
  ctx.fillStyle = C.deepBlue;
  ctx.font = font(54, 'bold');
  const heroTitle = input.name ? `${input.name} 的路径积木` : '我的路径积木';
  ctx.fillText(heroTitle, PAD, y + 40);
  y += 62;
  ctx.fillStyle = C.grayBlue;
  ctx.font = font(24);
  ctx.fillText('理想职业 = 三块积木的组合，换一种拼法就是一条新路径', PAD, y + 18);
  y += 40;
  if (input.archetype) {
    ctx.font = font(22, 'bold');
    const badgeText = `职业原型 · ${input.archetype}`;
    const badgeW = ctx.measureText(badgeText).width + 36;
    ctx.fillStyle = 'rgba(243, 248, 255, 0.92)';
    roundRect(ctx, PAD, y, badgeW, 40, 20);
    ctx.fill();
    ctx.strokeStyle = C.cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = C.brand;
    ctx.fillText(badgeText, PAD + 18, y + 27);
    y += 58;
  }

  // ── 三积木白卡 ──
  const cardY = Math.max(y + 10, blocksCardTop);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  roundRect(ctx, PAD, cardY, W - PAD * 2, blocksCardH, 28);
  ctx.fill();
  ctx.strokeStyle = C.cardBorder;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const blockLabels: Array<[string, string]> = [
    ['1', 'Superpower · 天赋能力'],
    ['2', 'Delivery Format · 交付形态'],
    ['3', 'Niche Topic · 利基主题'],
  ];
  let blockY = cardY + 30;
  blockHeights.forEach((height, index) => {
    const [num, label] = blockLabels[index];
    // 序号圆点 + 标签
    ctx.fillStyle = C.brand;
    ctx.beginPath();
    ctx.arc(PAD + 34, blockY + 12, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = font(14, 'bold');
    ctx.fillText(num, PAD + 34, blockY + 17);
    ctx.fillStyle = C.grayBlue;
    ctx.font = font(22, 'bold');
    ctx.fillText(label, PAD + 58, blockY + 19);
    blockY += blockLabelH;
    // 值 chips
    const block = [
      { values: input.superpowers, pending: false },
      { values: [input.deliveryLabel], pending: input.deliveryPending },
      { values: input.niches.length ? input.niches : ['待探索'], pending: input.nichePending },
    ][index];
    blockY += drawChips(ctx, block.values, PAD + 34, blockY, W - PAD * 2 - 68, blockValueSize, block.pending ? C.amber : C.brand);
    blockY += 34;
  });

  // ── 四象限 2×2 ──
  const quadrantY = cardY + blocksCardH + 44;
  input.quadrants.forEach((quadrant, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = PAD + col * (cellW + 24);
    const yQ = quadrantY + row * (cellH + 16);
    ctx.fillStyle = C.cellBg;
    roundRect(ctx, x, yQ, cellW, cellH, 22);
    ctx.fill();
    ctx.strokeStyle = C.cellBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = C.brand;
    ctx.font = font(25, 'bold');
    ctx.fillText(quadrant.label, x + 20, yQ + 42);
    ctx.font = font(22);
    const pathRows = quadrant.paths.slice(0, 4);
    pathRows.forEach((path, pathIndex) => {
      const rowY = yQ + 76 + pathIndex * 34;
      ctx.fillStyle = path.symbol === '●' ? C.deepBlue : path.symbol === '◐' ? C.brand : C.grayBlue;
      ctx.fillText(`${path.symbol} ${truncateText(ctx, path.title, innerW - 34)}`, x + 20, rowY);
    });
    if (quadrant.paths.length > 4) {
      ctx.fillStyle = C.lightGray;
      ctx.font = font(20);
      ctx.fillText(`+${quadrant.paths.length - 4} 条更多`, x + 20, yQ + 76 + 4 * 34);
    }
  });

  // ── 密度图例 ──
  const legendY = quadrantY + cellH * 2 + 16 + 30;
  ctx.fillStyle = C.grayBlue;
  ctx.font = font(20);
  ctx.fillText('● 常见在招岗位    ◐ 小众真实存在    ○ 教练碰撞的自创组合', PAD, legendY);

  // ── Footer：深蓝条 + slogan + 二维码 ──
  const fY = legendY + 40;
  const footerGrad = ctx.createLinearGradient(PAD, fY, W - PAD, fY + footerH);
  footerGrad.addColorStop(0, C.brand);
  footerGrad.addColorStop(1, C.deepBlue);
  ctx.fillStyle = footerGrad;
  roundRect(ctx, PAD, fY, W - PAD * 2, footerH, 28);
  ctx.fill();

  const qrSize = 150;
  const qrX = W - PAD - 34 - qrSize;
  const qrY = fY + (footerH - qrSize) / 2;
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 16);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.font = font(32, 'bold');
  ctx.fillText('扫码探索你的路径积木', PAD + 36, fY + 62);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.font = font(22);
  ctx.fillText('三块积木 × 四种象限，找到属于你的现实路径', PAD + 36, fY + 104);
  ctx.font = font(20, 'bold');
  ctx.fillText(input.siteUrl.replace(/^https?:\/\//, ''), PAD + 36, fY + 152);

  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  return canvas;
}
