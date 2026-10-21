/**
 * 现实路径 · 能力证据确认卡
 *
 * 教练在对话中识别到高价值经历后，输出结构化证据卡（[[EVIDENCE:{...}]] 标记），
 * 前端解析渲染为确认卡，用户三出口确认：准确 / 补充 / 不准确。
 * 确认结果随每轮请求同步给教练，避免重复确认同一证据。
 */

export type EvidenceProficiency = 'single' | 'repeated' | 'methodized';

export const PROFICIENCY_META: Record<
  EvidenceProficiency,
  { label: string; hint: string }
> = {
  single: { label: '一次性经历', hint: '做过一两次，尚未形成稳定经验' },
  repeated: { label: '反复做过', hint: '多段经历里反复出现' },
  methodized: { label: '有方法论', hint: '形成了自己的方法或流程' },
};

export type EvidenceCard = {
  id: string;
  /** 可复用能力（目标岗位语言，如"需求分析与问题定义"） */
  capability: string;
  /** 用户经验的一句话描述（用户语言） */
  experienceSummary: string;
  /** 经验 → 可复用能力的翻译 */
  reusableAbility: string;
  /** 在目标岗位里对应的工作动作 */
  targetAction: string;
  /** 熟练度三态 */
  proficiency: EvidenceProficiency;
  /** 可展示产物（作品/文档/数据/评价），没有则留空 */
  artifact?: string | null;
  /** 确认状态 */
  status: 'pending' | 'confirmed' | 'partial' | 'rejected';
  /** 用户补充/修正的内容（status 为 partial 时有值） */
  userAmendment?: string;
  createdAt?: string;
};

/** 现实约束：与交付形态探讨合并确认，不单独问两轮 */
export type RealityConstraints = {
  /** 每周可稳定投入时间，如"每周 6 小时" */
  weeklyHours?: string;
  /** 可接受的收入断档缓冲，如"约 6 个月" */
  financialRunway?: string;
  /** 不可协商项（"绝对不做"清单，筛选力最强） */
  hardNo: string[];
  /** 用户已有的自发行动（行为证据 > 口头兴趣） */
  selfInitiated: string[];
  /** 节奏意图：短期快速就业 / 中长期探索 / 双线并行（教练在约束讨论中确认） */
  paceIntent?: string;
};

export const EMPTY_CONSTRAINTS: RealityConstraints = {
  hardNo: [],
  selfInitiated: [],
};

/** 从教练回复中解析证据卡标记，返回干净文本 + 卡片列表 */
export function parseEvidenceCardsFromReply(reply: string): {
  cleanText: string;
  cards: EvidenceCard[];
} {
  const cards: EvidenceCard[] = [];
  const cleanText = reply.replace(/\[\[EVIDENCE:\s*(\{[\s\S]*?\})\s*\]\]/g, (_match, json: string) => {
    try {
      const parsed = JSON.parse(json) as Partial<EvidenceCard>;
      if (parsed.capability && parsed.experienceSummary && parsed.reusableAbility && parsed.targetAction) {
        cards.push({
          id: `evidence_${Date.now()}_${cards.length}`,
          capability: String(parsed.capability),
          experienceSummary: String(parsed.experienceSummary),
          reusableAbility: String(parsed.reusableAbility),
          targetAction: String(parsed.targetAction),
          proficiency: (['single', 'repeated', 'methodized'] as const).includes(
            parsed.proficiency as EvidenceProficiency
          )
            ? (parsed.proficiency as EvidenceProficiency)
            : 'repeated',
          artifact: parsed.artifact || null,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
      }
    } catch {
      // JSON 解析失败时静默丢弃标记，不影响正文
    }
    return '';
  });
  return { cleanText: cleanText.trim(), cards };
}
