import type { CareerReport } from '@/lib/career-path';

/**
 * 现实路径 · 乐高积木数据结构
 *
 * 生成逻辑：任何理想职业都可以拆成三块积木再碰撞出多种生存路径
 *   积木① 天赋动作（Superpower）—— 最享受、最不费力调用的底层能力
 *   积木② 交付形态（Delivery Format）—— 钱从哪里来
 *   积木③ 利基主题（Niche Topic）—— 感兴趣或有经验的领域
 *
 * 组织逻辑：○ 类自创路径按事业象限分布展示
 *   纵轴：重人际/线下体验（AI 难替代）↔ 线上/工具/数字资产
 *   横轴：低成本/单兵作战 ↔ 高单价/商业杠杆
 */

// ── 积木② 交付形态 ──────────────────────────────────────────────

export type DeliveryFormat = 'employment' | 'project' | 'productized';

export const DELIVERY_FORMAT_LABELS: Record<DeliveryFormat, string> = {
  employment: '传统雇佣',
  project: '项目制交付',
  productized: '产品化变现',
};

// ── 事业象限（用于 ○ 类自创路径的组织与导航）────────────────────

export type CareerQuadrant = 'embodied' | 'expert' | 'nomad' | 'ai-leveraged';

export const CAREER_QUADRANT_META: Record<
  CareerQuadrant,
  { label: string }
> = {
  embodied: { label: '人际与体验型事业' },
  expert: { label: '专业深度型事业' },
  nomad: { label: '线上轻量型事业' },
  'ai-leveraged': { label: 'AI 杠杆型事业' },
};

// ── 市场密度（诚实标注：组合路径 ≠ 可投递岗位）──────────────────

export type MarketDensity = 'common' | 'niche' | 'created';

export const MARKET_DENSITY_META: Record<
  MarketDensity,
  { symbol: string; label: string; description: string }
> = {
  common: { symbol: '●', label: '常见岗位', description: '招聘平台可直接搜到、能投递' },
  niche: { symbol: '◐', label: '小众真实', description: '岗位存在但密度低，需要主动找' },
  created: { symbol: '○', label: '自创组合', description: '无现成岗位，靠最小实验验证' },
};

// ── 可行性节奏（现实约束讨论的三态标注）────────────────────────

/** 可行性：ready 马上可投递 / build 需积累资源 / learn 需学习准备 */
export type PathFeasibility = 'ready' | 'build' | 'learn';

export const FEASIBILITY_META: Record<
  PathFeasibility,
  { symbol: string; label: string; description: string; className: string }
> = {
  ready: {
    symbol: '▶',
    label: '马上可投递',
    description: '现有能力可直接迁移，岗位或客源现实可得',
    className: 'bg-emerald-50 text-emerald-700',
  },
  build: {
    symbol: '◆',
    label: '需积累资源',
    description: '能力已在，缺作品集、客源、口碑等资源',
    className: 'bg-amber-50 text-amber-700',
  },
  learn: {
    symbol: '✦',
    label: '需学习准备',
    description: '存在资质或知识门槛，需先补关键一课',
    className: 'bg-sky-50 text-sky-700',
  },
};

// ── 价值观适配层（固定坐标系 + 个人适配标注）────────────────────

/** 用户价值画像：由测试画像或（后续）报告/资料板推导 */
export type PathValueProfile = {
  coreValues: string[];
  stabilityPreference: 'high' | 'medium' | 'low';
  incomeExpectation: 'high' | 'medium' | 'low';
  pacePreference: 'structured' | 'flexible' | 'burst';
};

/** 象限与用户价值观的匹配度三态 */
export type QuadrantFit = 'strong' | 'ok' | 'tension';

export const QUADRANT_FIT_META: Record<
  QuadrantFit,
  { symbol: string; label: string; className: string }
> = {
  strong: { symbol: '✓✓', label: '高匹配', className: 'border-[#D8E8DC] bg-[#F2F8F3] text-[#5E8A70]' },
  ok: { symbol: '✓', label: '可评估', className: 'border-[#D5E6F5] bg-[#F3F8FF] text-[#4A789C]' },
  tension: { symbol: '△', label: '有张力', className: 'border-[#F0DADA] bg-[#FBF3F3] text-[#A06B6B]' },
};

const STABILITY_LABELS = { high: '稳定', medium: '节奏可控', low: '自由' } as const;

/** 按用户价值画像计算某个象限的适配度与原因（确定性规则，不依赖 LLM） */
export function computeQuadrantFit(
  profile: PathValueProfile,
  quadrant: CareerQuadrant
): { fit: QuadrantFit; reason: string } {
  const values = new Set(profile.coreValues);
  const has = (...needles: string[]) => needles.some((item) => values.has(item));
  switch (quadrant) {
    case 'embodied': {
      if (profile.stabilityPreference === 'high' && profile.incomeExpectation === 'high') {
        return { fit: 'tension', reason: '线下启动成本与收入波动，与你对稳定 + 高收入的诉求有张力' };
      }
      if (has('belonging', 'impact') && profile.stabilityPreference !== 'high') {
        return { fit: 'strong', reason: '重人际与真实连接，正对你的核心价值' };
      }
      return { fit: 'ok', reason: '可评估，但注意线下场景的时间投入' };
    }
    case 'expert': {
      if (has('mastery') || profile.incomeExpectation === 'high') {
        return { fit: 'strong', reason: '专业深度直接决定单价，正对你的优势' };
      }
      return { fit: 'ok', reason: '需要口碑积累，可先从受雇平台起步' };
    }
    case 'nomad': {
      if (profile.stabilityPreference === 'high' || profile.pacePreference === 'structured') {
        return {
          fit: 'tension',
          reason: `收入与节奏波动大，与你对${STABILITY_LABELS[profile.stabilityPreference]}的诉求有张力`,
        };
      }
      if (has('autonomy', 'variety', 'creativity') && profile.stabilityPreference === 'low') {
        return { fit: 'strong', reason: '低成本灵活启动，正对你的自主与新鲜感诉求' };
      }
      return { fit: 'ok', reason: '可评估，先验证客源再加大投入' };
    }
    case 'ai-leveraged': {
      if (has('mastery', 'creativity') && profile.incomeExpectation === 'high') {
        return {
          fit: 'strong',
          reason: '一次搭建可规模化售卖；受雇版本也可作为此象限的稳定起点',
        };
      }
      if (profile.stabilityPreference === 'high') {
        return { fit: 'ok', reason: '前期需攒标杆案例，建议受雇/平台起步对冲波动' };
      }
      return { fit: 'ok', reason: '可评估，先做最小产品验证需求' };
    }
  }
}

// ── 一条乐高组合路径 ────────────────────────────────────────────

/**
 * 展示用路径标题：剥离“（受雇）（受雇起步）”等雇佣形态后缀。
 * 完整标题（含后缀）保留在数据层，作为教练后台的岗位形态标签。
 */
export function displayPathTitle(title: string): string {
  return title.replace(/（受雇[^）]*）$/, '').trim();
}

export type LegoPath = {
  id: string;
  /** 组合叙事短标题，如「线上情绪陪伴倾听师」 */
  title: string;
  /** 一句人话描述这条路径具体在做什么 */
  narrative: string;
  /** 积木①：天赋动作（用户语言，非岗位语言） */
  superpower: string;
  /** 积木②：交付形态 */
  deliveryFormat: DeliveryFormat;
  /** 积木③：利基主题 */
  niche: string;
  /** 所属事业象限；受雇岗位按其真实工作场景落位（如线上内容岗 → nomad），是象限里更现实的锚点 */
  quadrant?: CareerQuadrant;
  /** 市场密度标注 */
  marketDensity: MarketDensity;
  /** 收入/风险现实提示（如断档期、资质门槛） */
  incomeReality?: string;
  /** 可行性节奏：结合用户现实约束判断的"何时能走通"标注 */
  feasibility?: PathFeasibility;
};

// ── 用户当前确认的路径积木 ──────────────────────────────────────

export type PathLegoProfile = {
  /** 积木①：看家本领（从报告 superpowers 提取，1-3 个，待用户确认） */
  superpowers: string[];
  /** 积木②：交付形态（Step 1a 教练对话后确认，此前为 undecided） */
  deliveryFormat: DeliveryFormat | 'undecided';
  /** 积木③：利基主题（细分领域 1-3 个，如"心理与疗愈行业"，待用户确认） */
  niches: string[];
};

/** 积木③利基主题的待确认占位：细分领域（如"心理与疗愈行业"），不是具体岗位名 */
export const LEGO_PENDING_NICHE = '待探索';

/** 三块积木的展示文案：通俗标题 + 英文副标 + 一句解释 */
export const LEGO_BLOCK_LABELS = {
  superpower: { title: '天赋能力', english: 'Superpower', hint: '你反复做成事的那套动作，走到哪都能带走' },
  deliveryFormat: { title: '交付形态', english: 'Delivery Format', hint: '你想用哪种方式挣到钱——受雇、接项目，还是做自己的产品' },
  niche: { title: '利基主题', english: 'Niche Topic', hint: '你想深耕的细分领域，为谁解决什么问题' },
} as const;

/** 从天赋报告提取初始积木（Step 1a 教练对话确认前均为待确认态） */
export function buildLegoProfileFromReport(
  report: CareerReport | null,
  nicheThemes?: string | string[]
): PathLegoProfile | null {
  if (!report) return null;
  const superpowers = (report.superpowers || [])
    .map((item) => (typeof item === 'object' ? item?.name : item) || '')
    .filter(Boolean)
    .slice(0, 3);
  if (!superpowers.length && report.skills?.length) superpowers.push(...report.skills.slice(0, 3));
  const themeList = (Array.isArray(nicheThemes) ? nicheThemes : nicheThemes ? [nicheThemes] : [])
    .map((theme) => theme?.trim())
    .filter(Boolean);
  return {
    superpowers: superpowers.length ? superpowers : ['待探索'],
    deliveryFormat: 'undecided',
    niches: themeList.length ? themeList.slice(0, 3) : [LEGO_PENDING_NICHE],
  };
}
