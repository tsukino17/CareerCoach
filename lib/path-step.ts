/**
 * 现实路径 · Step 2 信息聚焦 / Step 3 行动收束
 *
 * Step 2：用户选定一条主线路径后，教练把该路径的关键岗位需求逐项与已有证据对照
 *   （[[REQUIREMENT:{...}]] 标记，仿 [[EVIDENCE]] 协议，不重复取证），
 *   再逐项对照价值观、确认意愿三态。
 * Step 3：意愿确认后输出准备度卡（[[READINESS:{...}]] 标记），并收束为最小微行动。
 */

import { LEGO_PENDING_NICHE, type PathLegoProfile } from '@/lib/path-lego';
import type { EvidenceCard } from '@/lib/path-evidence';

// ── Step 2 · 需求对照 ────────────────────────────────────────────

/** 需求对照状态：checked 已证实证据直接对上 / pending 有线索待确认 / gap 暂无证据 */
export type RequirementCheckStatus = 'checked' | 'pending' | 'gap';

export const REQUIREMENT_STATUS_META: Record<
  RequirementCheckStatus,
  { label: string; className: string }
> = {
  checked: { label: '已有证据', className: 'border-[#D8E8DC] bg-[#F2F8F3] text-[#5E8A70]' },
  pending: { label: '待确认', className: 'border-[#D5E6F5] bg-[#F3F8FF] text-[#4A789C]' },
  gap: { label: '暂无线索', className: 'border-[#E8E2D5] bg-[#FAF7F0] text-[#8A7A5E]' },
};

export type RequirementCheck = {
  /** 岗位关键需求（招聘语言，如"选题策划与内容排期"） */
  requirement: string;
  /** 用户已有证据摘要：引用证据卡能力或用户原话，暂缺时为 null */
  evidenceSummary: string | null;
  status: RequirementCheckStatus;
};

/** Step 2 选定主线快照：路径 + 需求对照进度 + 价值观小结 + 意愿三态 */
export type SelectedPathBrief = {
  pathId: string;
  pathTitle: string;
  requirementChecks: RequirementCheck[];
  /** 价值观对照小结（教练逐项对照工作方式与 coreValues 后沉淀） */
  valueNotes: string[];
  /** 意愿三态：想做 / 观望 / 不想做（不想做时回 Step 1 换路径） */
  willingness?: 'want' | 'unsure' | 'no';
};

// ── Step 3 · 准备度卡 ────────────────────────────────────────────

export type ReadinessSummary = {
  /** 0-100，必须来自已确认证据，不虚高 */
  score: number;
  /** 已具备：已证实能力对应的岗位动作 */
  have: string[];
  /** 仍需验证：有线索但证据不足的部分 */
  verify: string[];
  /** 下一步：1-2 个最小验证入口（对齐节奏意图） */
  next: string[];
};

// ── 标记解析 ─────────────────────────────────────────────────────

/** 从教练回复中解析需求对照标记，返回干净文本 + 对照列表 */
export function parseRequirementCardsFromReply(reply: string): {
  cleanText: string;
  checks: RequirementCheck[];
} {
  const checks: RequirementCheck[] = [];
  const cleanText = reply.replace(
    /\[\[REQUIREMENT:\s*(\{[\s\S]*?\})\s*\]\]/g,
    (_match, json: string) => {
      try {
        const parsed = JSON.parse(json) as Partial<RequirementCheck>;
        if (parsed.requirement) {
          checks.push({
            requirement: String(parsed.requirement),
            evidenceSummary: parsed.evidenceSummary ? String(parsed.evidenceSummary) : null,
            status: (['checked', 'pending', 'gap'] as const).includes(
              parsed.status as RequirementCheckStatus
            )
              ? (parsed.status as RequirementCheckStatus)
              : 'pending',
          });
        }
      } catch {
        // JSON 解析失败时静默丢弃标记，不影响正文
      }
      return '';
    }
  );
  return { cleanText: cleanText.trim(), checks };
}

/** 从教练回复中解析准备度卡标记，返回干净文本 + 准备度 */
export function parseReadinessFromReply(reply: string): {
  cleanText: string;
  readiness: ReadinessSummary | null;
} {
  let readiness: ReadinessSummary | null = null;
  const cleanText = reply.replace(
    /\[\[READINESS:\s*(\{[\s\S]*?\})\s*\]\]/g,
    (_match, json: string) => {
      try {
        const parsed = JSON.parse(json) as Partial<ReadinessSummary>;
        const score = Number(parsed.score);
        if (Number.isFinite(score)) {
          readiness = {
            score: Math.min(100, Math.max(0, Math.round(score))),
            have: (Array.isArray(parsed.have) ? parsed.have : []).map(String).filter(Boolean).slice(0, 6),
            verify: (Array.isArray(parsed.verify) ? parsed.verify : []).map(String).filter(Boolean).slice(0, 6),
            next: (Array.isArray(parsed.next) ? parsed.next : []).map(String).filter(Boolean).slice(0, 3),
          };
        }
      } catch {
        // JSON 解析失败时静默丢弃标记，不影响正文
      }
      return '';
    }
  );
  return { cleanText: cleanText.trim(), readiness };
}

/** 把一轮对照合并进已有对照列表：同需求覆盖，新需求追加 */
export function mergeRequirementChecks(
  current: RequirementCheck[],
  incoming: RequirementCheck[]
): RequirementCheck[] {
  const next = [...current];
  for (const check of incoming) {
    const index = next.findIndex((item) => item.requirement === check.requirement);
    if (index >= 0) next[index] = check;
    else next.push(check);
  }
  return next;
}

// ── Step 解锁判定 ────────────────────────────────────────────────

/**
 * Step 2 解锁门槛（完成度门槛）：积木②交付形态确认 + 积木③利基确认
 * + 已证实（confirmed）证据卡 ≥ 2 张，三者同时满足；未满足时 Step 2 显示引导态。
 */
export function isStep2Unlocked(
  profile: PathLegoProfile | null,
  evidenceCards: EvidenceCard[]
): boolean {
  if (!profile) return false;
  const lego2Confirmed = profile.deliveryFormat !== 'undecided';
  const lego3Confirmed = profile.niches.some((theme) => {
    const trimmed = theme.trim();
    return Boolean(trimmed) && trimmed !== LEGO_PENDING_NICHE && trimmed !== '待探索';
  });
  const confirmedCount = evidenceCards.filter((card) => card.status === 'confirmed').length;
  return lego2Confirmed && lego3Confirmed && confirmedCount >= 2;
}
