import { NextResponse } from 'next/server';
import { checkRateLimitDistributed, getClientIp } from '@/lib/rate-limit';
import { llmChatCompletion } from '@/lib/tokendance';
import { recordAiUsage } from '@/lib/token-usage';

type AnalysisType = 'product' | 'industry' | 'career' | 'feedback' | 'resource';

type AnalysisRequest = {
  analysisType?: unknown;
  topic?: unknown;
  customCase?: unknown;
  referenceCases?: unknown;
  userContext?: unknown;
};

type AnalysisReport = {
  headline: string;
  summary: string;
  researchFocus: string;
  opportunity: string;
  executiveBrief: Array<{ label: string; value: string }>;
  analysisNarrative: Array<{ title: string; paragraph: string }>;
  researchPlan: Array<{ step: string; purpose: string; output: string }>;
  evidenceSources: Array<{ sourceType: string; sourceName: string; usedFor: string; confidence: '高' | '中' | '低' }>;
  cases: Array<{
    name: string;
    role: string;
    takeaway: string;
    fit: number;
    evidence: number;
    action: number;
  }>;
  opportunityMap: Array<{ label: string; value: string }>;
  risks: string[];
  nextExperiments: string[];
  actionCards: Array<{ title: string; why: string; firstStep: string; effort: string; evidenceToCollect: string }>;
  confidenceNotes: string[];
};

const ANALYSIS_SYSTEM_PROMPT = `你是一位严谨的中文咨询分析顾问，服务于职业转型和行动力教练产品。

你的任务是把用户的调研问题转成结构化分析报告。你可以基于通用知识、用户给出的案例和参考案例做分析，但不要伪造实时数据、市场规模、引用来源或精确数字。

要求：
- 输出必须是严格 JSON，不要 Markdown，不要解释 JSON。
- 所有字段必须使用简体中文。
- 如果事实需要进一步验证，要在 risks 或 nextExperiments 中明确写“需验证”。
- 报告要可行动，不能只是概念判断。
- 语气要像资深产品分析师或咨询顾问，判断具体、克制、聪明，不要泛泛安慰，不要写模板话术。
- analysisNarrative 必须像正式报告正文，每段都要有清晰观点、理由和对用户问题的直接回答，避免只重复标题。
- executiveBrief 必须把最关键的判断先说出来，用简短但有信息量的句子，不要空泛。
- researchPlan 要体现咨询工具的工作过程：先界定问题，再收集证据，再判断机会，最后生成行动。
- evidenceSources 必须区分用户材料、教练记忆、天赋报告、身份愿景板、预置案例、模型推断、需外部验证等来源；不要把模型推断写成事实来源。
- actionCards 必须是用户今天或本周能做的动作，不要写大而空的建议。
- cases 至少 3 个，若用户给了 customCase，把它放在第一位。
- 分数 fit/evidence/action 为 0 到 100 的整数。

JSON 结构：
{
  "headline": "一句话结论",
  "summary": "简短摘要",
  "researchFocus": "这次应该重点看什么",
  "opportunity": "对用户产品/职业/行动路径的机会判断",
  "executiveBrief": [
    { "label": "判断重点", "value": "最值得先知道的判断" }
  ],
  "analysisNarrative": [
    { "title": "分析段落标题", "paragraph": "像正式报告正文一样展开分析，至少 90 字，说明为什么这样判断，以及这对用户意味着什么。" }
  ],
  "researchPlan": [
    { "step": "研究步骤", "purpose": "为什么要做", "output": "会产出什么" }
  ],
  "evidenceSources": [
    { "sourceType": "用户材料/教练记忆/天赋报告/身份愿景板/预置案例/模型推断/需外部验证", "sourceName": "来源名", "usedFor": "用于支持什么判断", "confidence": "高/中/低" }
  ],
  "cases": [
    { "name": "案例名", "role": "案例角色", "takeaway": "关键启发", "fit": 80, "evidence": 70, "action": 85 }
  ],
  "opportunityMap": [
    { "label": "用户/市场/岗位/资源等维度", "value": "具体判断" }
  ],
  "risks": ["风险或事实不确定性"],
  "nextExperiments": ["下一步低成本验证动作"],
  "actionCards": [
    { "title": "行动卡标题", "why": "为什么值得做", "firstStep": "第一步具体动作", "effort": "10分钟/30分钟/1小时/本周", "evidenceToCollect": "需要收集什么证据" }
  ],
  "confidenceNotes": ["哪些结论有把握，哪些还要验证"]
}`;

function normalizeAnalysisType(value: unknown): AnalysisType {
  if (value === 'industry' || value === 'career' || value === 'feedback' || value === 'resource') return value;
  return 'product';
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, 1200) : fallback;
}

function normalizeReferenceCases(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = item as { name?: unknown; role?: unknown; takeaway?: unknown };
      return {
        name: asString(record.name).slice(0, 80),
        role: asString(record.role).slice(0, 80),
        takeaway: asString(record.takeaway).slice(0, 240),
      };
    })
    .filter((item) => item.name)
    .slice(0, 5);
}

function normalizeUserContext(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const record = value as Record<string, unknown>;
  return {
    reportSummary: asString(record.reportSummary).slice(0, 260),
    visionSummary: asString(record.visionSummary).slice(0, 260),
    recentAction: asString(record.recentAction).slice(0, 260),
    memorySummary: asString(record.memorySummary).slice(0, 260),
  };
}

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match?.[0] || trimmed;
}

function clampScore(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 70;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeReport(value: unknown, fallback: AnalysisReport): AnalysisReport {
  const raw = value as Partial<AnalysisReport>;
  const researchPlan = Array.isArray(raw.researchPlan) ? raw.researchPlan : fallback.researchPlan;
  const evidenceSources = Array.isArray(raw.evidenceSources) ? raw.evidenceSources : fallback.evidenceSources;
  const cases = Array.isArray(raw.cases) ? raw.cases : fallback.cases;
  const opportunityMap = Array.isArray(raw.opportunityMap) ? raw.opportunityMap : fallback.opportunityMap;
  const risks = Array.isArray(raw.risks) ? raw.risks : fallback.risks;
  const nextExperiments = Array.isArray(raw.nextExperiments) ? raw.nextExperiments : fallback.nextExperiments;
  const actionCards = Array.isArray(raw.actionCards) ? raw.actionCards : fallback.actionCards;
  const confidenceNotes = Array.isArray(raw.confidenceNotes) ? raw.confidenceNotes : fallback.confidenceNotes;
  const executiveBrief = Array.isArray(raw.executiveBrief) ? raw.executiveBrief : fallback.executiveBrief;
  const analysisNarrative = Array.isArray(raw.analysisNarrative) ? raw.analysisNarrative : fallback.analysisNarrative;
  return {
    headline: asString(raw.headline, fallback.headline).slice(0, 140),
    summary: asString(raw.summary, fallback.summary).slice(0, 360),
    researchFocus: asString(raw.researchFocus, fallback.researchFocus).slice(0, 300),
    opportunity: asString(raw.opportunity, fallback.opportunity).slice(0, 300),
    executiveBrief: executiveBrief
      .map((item) => {
        const record = item as { label?: unknown; value?: unknown };
        return {
          label: asString(record.label, '判断重点').slice(0, 40),
          value: asString(record.value, '需要进一步补充判断。').slice(0, 180),
        };
      })
      .filter((item) => item.value)
      .slice(0, 4),
    analysisNarrative: analysisNarrative
      .map((item) => {
        const record = item as { title?: unknown; paragraph?: unknown };
        return {
          title: asString(record.title, '分析展开').slice(0, 50),
          paragraph: asString(record.paragraph, '需要进一步展开分析。').slice(0, 520),
        };
      })
      .filter((item) => item.paragraph)
      .slice(0, 4),
    researchPlan: researchPlan
      .map((item) => {
        const record = item as { step?: unknown; purpose?: unknown; output?: unknown };
        return {
          step: asString(record.step, '研究步骤').slice(0, 80),
          purpose: asString(record.purpose, '明确为什么要看这个环节。').slice(0, 160),
          output: asString(record.output, '形成可判断的结论。').slice(0, 160),
        };
      })
      .filter((item) => item.step)
      .slice(0, 5),
    evidenceSources: evidenceSources
      .map((item) => {
        const record = item as { sourceType?: unknown; sourceName?: unknown; usedFor?: unknown; confidence?: unknown };
        const confidence: '高' | '中' | '低' = record.confidence === '高' || record.confidence === '低' ? record.confidence : '中';
        return {
          sourceType: asString(record.sourceType, '模型推断').slice(0, 30),
          sourceName: asString(record.sourceName, '待补充来源').slice(0, 80),
          usedFor: asString(record.usedFor, '支持当前阶段的方向判断。').slice(0, 160),
          confidence,
        };
      })
      .filter((item) => item.sourceName)
      .slice(0, 7),
    cases: cases
      .map((item) => {
        const record = item as { name?: unknown; role?: unknown; takeaway?: unknown; fit?: unknown; evidence?: unknown; action?: unknown };
        return {
          name: asString(record.name, '待分析案例').slice(0, 80),
          role: asString(record.role, '参考对象').slice(0, 80),
          takeaway: asString(record.takeaway, '需要进一步验证其启发点。').slice(0, 260),
          fit: clampScore(record.fit),
          evidence: clampScore(record.evidence),
          action: clampScore(record.action),
        };
      })
      .filter((item) => item.name)
      .slice(0, 5),
    opportunityMap: opportunityMap
      .map((item) => {
        const record = item as { label?: unknown; value?: unknown };
        return {
          label: asString(record.label, '分析维度').slice(0, 40),
          value: asString(record.value, '需要补充信息。').slice(0, 180),
        };
      })
      .slice(0, 5),
    risks: risks.map((item) => asString(item).slice(0, 180)).filter(Boolean).slice(0, 5),
    nextExperiments: nextExperiments.map((item) => asString(item).slice(0, 180)).filter(Boolean).slice(0, 5),
    actionCards: actionCards
      .map((item) => {
        const record = item as { title?: unknown; why?: unknown; firstStep?: unknown; effort?: unknown; evidenceToCollect?: unknown };
        return {
          title: asString(record.title, '低成本验证动作').slice(0, 80),
          why: asString(record.why, '帮助把想法转成现实证据。').slice(0, 160),
          firstStep: asString(record.firstStep, '先记录一个可执行的最小动作。').slice(0, 160),
          effort: asString(record.effort, '30分钟').slice(0, 40),
          evidenceToCollect: asString(record.evidenceToCollect, '记录观察到的事实。').slice(0, 160),
        };
      })
      .filter((item) => item.title)
      .slice(0, 5),
    confidenceNotes: confidenceNotes.map((item) => asString(item).slice(0, 180)).filter(Boolean).slice(0, 5),
  };
}

function fallbackReport(analysisType: AnalysisType, topic: string, customCase: string, referenceCases: Array<{ name: string; role: string; takeaway: string }>, userContext: Record<string, string> = {}): AnalysisReport {
  const firstCase = customCase || referenceCases[0]?.name || '待分析对象';
  const hasContext = Boolean(userContext.reportSummary || userContext.visionSummary || userContext.recentAction || userContext.memorySummary);
  return {
    headline: '先把问题拆成可验证对象，再判断是否值得投入。',
    summary: `当前问题是：${topic || '未填写分析问题'}。模型暂不可用时，先用预置框架生成一版基础报告。`,
    researchFocus: analysisType === 'career' ? '岗位职责、能力门槛、作品证据、进入路径和风险。' : '真实用户、参考案例、可观察信号、商业或行动验证方式。',
    opportunity: '把模糊兴趣转成 1 个可观察案例、1 个可验证假设和 1 个低成本实验。',
    executiveBrief: [
      { label: '判断重点', value: '先不要急着决定做不做，而是先确认这个方向是否真的能被现实用户需求支撑。' },
      { label: '当前结论', value: '这更适合作为探索中的方向假设，而不是已经被验证成立的结论。' },
      { label: '下一步', value: '优先补真实案例、用户反馈和外部信号，再决定是否继续投入。' },
    ],
    analysisNarrative: [
      {
        title: '为什么这个方向值得继续分析',
        paragraph: '这件事值得继续看，不是因为概念本身听起来吸引人，而是因为它背后可能对应着一组真实存在的用户问题。现在真正需要判断的，不是这个想法“美不美”，而是它是否抓住了用户愿意反复回来、愿意投入注意力、并且在现实里感到有帮助的那部分价值。',
      },
      {
        title: '我现在更倾向的判断',
        paragraph: '当前更稳妥的判断是：这个方向可以继续探索，但还不适合直接当成已经成立的产品结论。它看起来具备可讨论的机制和案例参考，也有机会连接到用户真实卡点，但是否值得继续投入，要看这些机制能不能转译成你目标用户愿意持续使用的实际体验。',
      },
      {
        title: '还缺的关键证据',
        paragraph: '现在最缺的不是更多概念，而是更贴近现实的证据：用户原话、真实行为、外部案例、岗位或市场信号。只要这些证据没有补上，很多判断都只能停留在“看起来合理”的层面，不能真正支撑你往下一步做产品、做职业判断或做资源投入。',
      },
    ],
    researchPlan: [
      { step: '界定问题', purpose: '确认这次到底要判断方向、案例、岗位还是资源。', output: '一个清晰的分析问题和判断标准。' },
      { step: '整理现有材料', purpose: '先用用户输入、教练记忆和预置案例形成初步假设。', output: '可被验证的 2-3 个假设。' },
      { step: '补充外部证据', purpose: '识别需要再查的市场、岗位、用户反馈或竞品事实。', output: '需验证清单和推荐渠道。' },
      { step: '转成行动', purpose: '避免报告停留在理解层面。', output: '今天或本周可执行的行动卡。' },
    ],
    evidenceSources: [
      ...(customCase ? [{ sourceType: '用户材料', sourceName: '用户提交的材料', usedFor: '判断用户真正关心的分析对象和问题边界。', confidence: '高' as const }] : []),
      ...(hasContext ? [{ sourceType: '教练记忆', sourceName: '本地职业画像与行动记录', usedFor: '校准建议是否贴合用户当前方向和能量。', confidence: '中' as const }] : []),
      ...referenceCases.slice(0, 3).map((item) => ({ sourceType: '预置案例', sourceName: item.name, usedFor: '提供对照对象和可迁移机制。', confidence: '中' as const })),
      { sourceType: '需外部验证', sourceName: '实时岗位/市场/用户反馈', usedFor: '验证机会强度、需求频次和进入门槛。', confidence: '低' as const },
    ],
    cases: [
      {
        name: firstCase,
        role: customCase ? '用户提交案例' : '参考案例',
        takeaway: '先收集公开资料、用户反馈或岗位信息，再判断它是否适合作为主要参考。',
        fit: 76,
        evidence: 48,
        action: 82,
      },
      ...referenceCases.slice(0, 2).map((item) => ({
        name: item.name,
        role: item.role || '参考案例',
        takeaway: item.takeaway || '可作为对照对象继续拆解。',
        fit: 78,
        evidence: 72,
        action: 74,
      })),
    ],
    opportunityMap: [
      { label: '核心假设', value: '这个方向是否解决了用户真实存在且愿意投入时间的问题。' },
      { label: '可观察证据', value: '评论、访谈、岗位 JD、竞品功能、社区讨论或付费行为。' },
      { label: '行动入口', value: '先做一次 30 分钟资料整理或 1 次低压力访谈。' },
    ],
    risks: ['模型接口暂不可用，当前报告未进行实时检索。', '涉及市场规模、岗位增长或用户需求强度的判断需验证。'],
    nextExperiments: ['收集 3 个公开案例并记录共同点。', '找 1 个真实用户或从业者做 20 分钟访谈。', '把发现整理成一张行动卡片，放回行动日历。'],
    actionCards: [
      { title: '收集 3 个真实样本', why: '用真实材料替代想象，减少方向判断的焦虑。', firstStep: '打开一个目标平台，保存 3 条案例、评论或 JD。', effort: '30分钟', evidenceToCollect: '链接、截图、关键词、反复出现的需求。' },
      { title: '做一张对照表', why: '看清不同案例之间的共同机制和差异。', firstStep: '按“用户是谁/痛点/解决机制/可借鉴点”写 4 列。', effort: '45分钟', evidenceToCollect: '每个案例至少 1 条事实依据。' },
      { title: '安排一次轻访谈', why: '让现实世界的人帮你校准判断。', firstStep: '给一位目标用户或从业者发 3 个问题。', effort: '本周', evidenceToCollect: '原话、犹豫点、对方愿意继续聊的主题。' },
    ],
    confidenceNotes: ['当前方向判断可以先作为探索假设。', '市场规模、岗位数量、商业表现和用户需求强度需要外部证据验证。'],
  };
}

async function requestQwenAnalysis(req: Request, prompt: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);
  try {
    const { content, model, usage } = await llmChatCompletion({
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.45,
      maxTokens: 1200,
      responseFormat: { type: 'json_object' },
      signal: controller.signal,
    });
    await recordAiUsage({ req, route: 'coach/analysis', model, usage });
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  let fallback: AnalysisReport | null = null;
  try {
    const ip = getClientIp(req);
    const limit = await checkRateLimitDistributed({ key: `coach-analysis:${ip}`, limit: 20, windowMs: 10 * 60 * 1000 });
    if (!limit.ok) return NextResponse.json({ error: '请求过于密集，请稍后再试。' }, { status: 429 });

    const body = (await req.json()) as AnalysisRequest;
    const analysisType = normalizeAnalysisType(body.analysisType);
    const topic = asString(body.topic, '请分析这个方向是否值得继续探索。');
    const customCase = asString(body.customCase);
    const referenceCases = normalizeReferenceCases(body.referenceCases);
    const userContext = normalizeUserContext(body.userContext);
    fallback = fallbackReport(analysisType, topic, customCase, referenceCases, userContext);

    const prompt = JSON.stringify({
      analysisType,
      topic,
      customCase,
      referenceCases,
      userContext,
      instruction: '请基于这些信息生成事实审慎、可行动的咨询分析报告。不要伪造实时数据；不确定处标注需验证。',
    });
    const content = await requestQwenAnalysis(req, prompt);
    const parsed = JSON.parse(extractJson(content));
    const report = normalizeReport(parsed, fallback);
    return NextResponse.json({ report, provider: 'qwen' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.warn(`[coach-analysis] Using fallback report. ${message}`);
    return NextResponse.json({
      report: fallback || fallbackReport('product', '请分析这个方向是否值得继续探索。', '', []),
      provider: 'local-fallback',
      providerNote: '模型分析接口暂不可用，已返回本地框架报告。',
    });
  }
}
