import { NextResponse } from 'next/server';
import { COACH_MESSAGE_FORMATTING_RULES } from '@/lib/coach-message-formatting';
import { checkRateLimitDistributed, getClientIp } from '@/lib/rate-limit';
import { llmChatCompletion } from '@/lib/tokendance';
import { recordAiUsage } from '@/lib/token-usage';

type OpportunityRequest = {
  target?: unknown;
  city?: unknown;
  workStyle?: unknown;
  pastedJobs?: unknown;
  userContext?: unknown;
  preferences?: unknown;
};

type OpportunityReport = {
  profileSummary: string;
  pathVerdict: string;
  feasibilityScore: number;
  preferenceFitSummary?: string;
  matchDimensions?: Array<{ label: string; score: number; reason: string }>;
  searchQueries: string[];
  recommendedSearchLinks?: Array<{ name: string; url: string; why: string }>;
  recommendedChannels: Array<{ name: string; why: string; queryHint: string }>;
  opportunityRoles: Array<{ title: string; companyType: string; matchReason: string; risk: string; evidenceToCollect: string }>;
  skillGaps: string[];
  firstWeekActions: string[];
  caveats: string[];
};

const OPPORTUNITY_SYSTEM_PROMPT = `你是一位严谨的中文职业机会研究顾问。你的任务不是大量推荐岗位，而是基于用户画像、城市、发展倾向和可用岗位文本，判断职业路径的现实可行性。

你不能伪造已经抓取到的岗位、公司或薪资。没有明确数据时，必须说“需验证”。你可以生成多源搜索策略、推荐渠道、岗位标题方向、公司类型和下一步验证动作。

如果用户偏好国内岗位，优先使用中文岗位标题、BOSS/脉脉/拉勾/前程无忧/公司官网等渠道语境。如果用户有海外或国际工作意愿，同时给出 LinkedIn、Google Jobs、Wellfound、Levels.fyi、Remote OK 等英文搜索入口和英文岗位关键词。

输出必须是严格 JSON，不要 Markdown。

JSON 结构：
{
  "profileSummary": "用户画像摘要",
  "pathVerdict": "路径可行性判断",
  "feasibilityScore": 0,
  "preferenceFitSummary": "用户偏好匹配摘要",
  "matchDimensions": [
    { "label": "匹配维度", "score": 0, "reason": "为什么这样打分" }
  ],
  "searchQueries": ["搜索词"],
  "recommendedSearchLinks": [
    { "name": "渠道名", "url": "https://example.com/search?q=keyword", "why": "为什么先看这个入口" }
  ],
  "recommendedChannels": [
    { "name": "渠道名", "why": "为什么适合", "queryHint": "建议搜索方式" }
  ],
  "opportunityRoles": [
    { "title": "岗位/路径名称", "companyType": "公司或组织类型", "matchReason": "匹配理由", "risk": "风险", "evidenceToCollect": "需要收集的证据" }
  ],
  "skillGaps": ["能力缺口"],
  "firstWeekActions": ["第一周验证动作"],
  "caveats": ["事实边界和需验证项"]
}`;

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, 3000) : fallback;
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function clampScore(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 60;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function extractJson(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match?.[0] || trimmed;
}

function buildSearchUrl(base: string, query: string) {
  return `${base}${encodeURIComponent(query)}`;
}

function fallbackReport(target: string, city: string, workStyle: string, pastedJobs: string, preferences: Record<string, unknown> = {}): OpportunityReport {
  const direction = target || '待确认职业方向';
  const seniority = asString(preferences.seniority);
  const salary = asString(preferences.salary);
  const preferredIndustries = asString(preferences.preferredIndustries);
  const marketScope = asString(preferences.marketScope, '国内为主，必要时参考海外');
  const baseQuery = `${direction} ${city || ''} ${seniority || ''}`.replace(/\s+/g, ' ').trim();
  const wantsOverseas = /海外|国际|国外|远程|global|international|remote/i.test(`${marketScope} ${city} ${workStyle}`);
  const wantsDomestic = !/海外优先|国际优先|overseas first|global first/i.test(marketScope);
  return {
    profileSummary: `当前目标方向：${direction}${city ? `；城市/地点偏好：${city}` : ''}。`,
    pathVerdict: pastedJobs
      ? '已提供岗位文本，可先基于职位描述判断能力要求和入口可行性；仍需补充来源链接和样本量。'
      : '尚未提供真实岗位样本，当前只能生成搜索策略和验证框架。',
    feasibilityScore: pastedJobs ? 68 : 52,
    preferenceFitSummary: [
      seniority ? `经验层级：${seniority}` : '',
      salary ? `薪资期待：${salary}` : '',
      preferredIndustries ? `偏好行业：${preferredIndustries}` : '',
      marketScope ? `搜索范围：${marketScope}` : '',
    ].filter(Boolean).join('；') || '还没有填写明确偏好，当前优先按目标方向和地点做粗匹配。',
    matchDimensions: [
      { label: '方向贴合', score: direction === '待确认职业方向' ? 48 : 70, reason: direction === '待确认职业方向' ? '目标方向还不够具体。' : '已有明确岗位方向，可先找相邻岗位族验证。' },
      { label: '现实证据', score: pastedJobs ? 72 : 42, reason: pastedJobs ? '已提供职位描述或岗位文本，能做初步反推。' : '缺少真实岗位样本，需要补 3-5 条职位描述。' },
      { label: '工作方式适配', score: workStyle ? 66 : 45, reason: workStyle ? `会优先按“${workStyle}”筛选岗位和渠道。` : '还没有明确全职、远程、项目制或灵活办公偏好。' },
      { label: '偏好清晰度', score: seniority || salary || preferredIndustries ? 66 : 38, reason: seniority || salary || preferredIndustries ? '已有部分筛选条件，可用于排序岗位。' : '薪资、年限、行业、工作方式还需要进一步收窄。' },
    ],
    searchQueries: [
      `${direction} ${city || ''} 招聘`,
      `${direction} 初级 0-3年 ${city || ''}`,
      `${direction} 远程 自由职业`,
      `${direction} 公司官网 careers`,
    ].map((item) => item.replace(/\s+/g, ' ').trim()),
    recommendedSearchLinks: [
      ...(wantsDomestic ? [
        { name: 'BOSS 直聘搜索', url: buildSearchUrl('https://www.zhipin.com/web/geek/job?query=', baseQuery), why: '适合验证国内岗位数量、薪资区间和团队要求。' },
        { name: '脉脉岗位搜索', url: buildSearchUrl('https://maimai.cn/jobs/search?query=', baseQuery), why: '适合补充国内互联网/科技岗位和从业者语境。' },
      ] : []),
      { name: 'Google 聚合搜索', url: buildSearchUrl('https://www.google.com/search?q=', wantsOverseas ? `${baseQuery} jobs salary job description remote` : `${baseQuery} 招聘 薪资 职位描述`), why: '适合快速查公开职位描述、薪资讨论和公司官网入口。' },
      ...(wantsOverseas ? [
        { name: 'LinkedIn Jobs', url: buildSearchUrl('https://www.linkedin.com/jobs/search/?keywords=', baseQuery), why: '适合看国际化岗位标题、年限、英文能力词和公司类型。' },
        { name: 'Remote OK', url: buildSearchUrl('https://remoteok.com/remote-', direction), why: '适合验证远程岗位和英文岗位关键词。' },
        { name: 'Levels.fyi 薪资参考', url: buildSearchUrl('https://www.levels.fyi/?compare=', direction), why: '适合科技岗位薪资粗校准，国内外口径需分开看。' },
      ] : []),
    ],
    recommendedChannels: [
      { name: '公司官网 / Careers', why: '更接近真实岗位，反爬压力较低。', queryHint: `${direction} careers ${city || ''}`.trim() },
      { name: 'LinkedIn / Boss / 拉勾 / 前程无忧 / 脉脉', why: '适合验证岗位标题、薪资、年限和技能关键词。', queryHint: `${direction} ${city || ''} 0-3年`.trim() },
      { name: '电鸭 / V2EX / Remote OK / Wellfound / Upwork', why: '适合发现远程、自由职业、创业团队和非标准路径。', queryHint: `${direction} remote freelance startup`.trim() },
    ],
    opportunityRoles: [
      { title: direction, companyType: '相关行业中小团队或新业务团队', matchReason: '方向与用户输入一致，可作为第一批验证对象。', risk: '缺少真实岗位样本，需验证招聘强度。', evidenceToCollect: '收集 5 条职位描述，记录共同技能和经验要求。' },
      { title: '产品/运营/用户研究复合岗位', companyType: 'AI 应用、内容社区、工具产品、教育或心理健康产品', matchReason: '更适合转型用户用作品和用户理解建立入口。', risk: '岗位名称可能分散，不能只搜一个关键词。', evidenceToCollect: '比较 3 种岗位名称的岗位需求差异。' },
    ],
    skillGaps: ['需要从职位描述中确认高频工具、作品要求和经验年限。', '需要准备一个能证明方向理解的作品或案例拆解。'],
    firstWeekActions: ['用生成的搜索词收集 5 条岗位链接或职位描述文本。', '筛出 2 个最接近的岗位名称。', '为其中 1 个岗位写一版作品集/简历证据清单。'],
    caveats: ['当前没有直接联网抓取招聘网站数据。', 'BOSS、脉脉等平台结果需用户打开验证或后续接入专门采集器。'],
  };
}

function normalizeReport(value: unknown, fallback: OpportunityReport): OpportunityReport {
  const raw = value as Partial<OpportunityReport>;
  const channels = Array.isArray(raw.recommendedChannels) ? raw.recommendedChannels : fallback.recommendedChannels;
  const roles = Array.isArray(raw.opportunityRoles) ? raw.opportunityRoles : fallback.opportunityRoles;
  const dimensions = Array.isArray(raw.matchDimensions) ? raw.matchDimensions : fallback.matchDimensions || [];
  const searchLinks = Array.isArray(raw.recommendedSearchLinks) ? raw.recommendedSearchLinks : fallback.recommendedSearchLinks || [];
  return {
    profileSummary: asString(raw.profileSummary, fallback.profileSummary).slice(0, 400),
    pathVerdict: asString(raw.pathVerdict, fallback.pathVerdict).slice(0, 400),
    feasibilityScore: clampScore(raw.feasibilityScore),
    preferenceFitSummary: asString(raw.preferenceFitSummary, fallback.preferenceFitSummary || '').slice(0, 400),
    matchDimensions: dimensions.map((item) => {
      const record = item as { label?: unknown; score?: unknown; reason?: unknown };
      return {
        label: asString(record.label, '匹配维度').slice(0, 80),
        score: clampScore(record.score),
        reason: asString(record.reason, '需要更多岗位样本验证。').slice(0, 180),
      };
    }).slice(0, 6),
    searchQueries: (Array.isArray(raw.searchQueries) ? raw.searchQueries : fallback.searchQueries).map((item) => asString(item).slice(0, 120)).filter(Boolean).slice(0, 8),
    recommendedSearchLinks: searchLinks.map((item) => {
      const record = item as { name?: unknown; url?: unknown; why?: unknown };
      const url = asString(record.url, '').slice(0, 500);
      return {
        name: asString(record.name, '搜索入口').slice(0, 80),
        url: /^https?:\/\//.test(url) ? url : '',
        why: asString(record.why, '用于补充现实岗位证据。').slice(0, 180),
      };
    }).filter((item) => item.url).slice(0, 6),
    recommendedChannels: channels.map((item) => {
      const record = item as { name?: unknown; why?: unknown; queryHint?: unknown };
      return {
        name: asString(record.name, '渠道').slice(0, 80),
        why: asString(record.why, '用于补充现实信号。').slice(0, 180),
        queryHint: asString(record.queryHint, '').slice(0, 120),
      };
    }).slice(0, 6),
    opportunityRoles: roles.map((item) => {
      const record = item as { title?: unknown; companyType?: unknown; matchReason?: unknown; risk?: unknown; evidenceToCollect?: unknown };
      return {
        title: asString(record.title, '待验证岗位').slice(0, 80),
        companyType: asString(record.companyType, '待确认公司类型').slice(0, 100),
        matchReason: asString(record.matchReason, '需要进一步验证匹配度。').slice(0, 200),
        risk: asString(record.risk, '需验证岗位真实性和进入门槛。').slice(0, 180),
        evidenceToCollect: asString(record.evidenceToCollect, '收集职位描述、岗位链接或访谈信息。').slice(0, 180),
      };
    }).slice(0, 6),
    skillGaps: (Array.isArray(raw.skillGaps) ? raw.skillGaps : fallback.skillGaps).map((item) => asString(item).slice(0, 160)).filter(Boolean).slice(0, 6),
    firstWeekActions: (Array.isArray(raw.firstWeekActions) ? raw.firstWeekActions : fallback.firstWeekActions).map((item) => asString(item).slice(0, 160)).filter(Boolean).slice(0, 6),
    caveats: (Array.isArray(raw.caveats) ? raw.caveats : fallback.caveats).map((item) => asString(item).slice(0, 180)).filter(Boolean).slice(0, 6),
  };
}

async function requestQwenOpportunity(req: Request, prompt: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 16000);
  try {
    const { content, model, usage } = await llmChatCompletion({
      messages: [
        { role: 'system', content: OPPORTUNITY_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.35,
      maxTokens: 1400,
      responseFormat: { type: 'json_object' },
      signal: controller.signal,
    });
    await recordAiUsage({ req, route: 'coach/opportunity-search', model, usage });
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  let fallback: OpportunityReport | null = null;
  try {
    const ip = getClientIp(req);
    const limit = await checkRateLimitDistributed({ key: `coach-opportunity:${ip}`, limit: 16, windowMs: 10 * 60 * 1000 });
    if (!limit.ok) return NextResponse.json({ error: '请求过于密集，请稍后再试。' }, { status: 429 });

    const body = (await req.json()) as OpportunityRequest;
    const target = asString(body.target, '待确认职业方向');
    const city = asString(body.city);
    const workStyle = asString(body.workStyle);
    const pastedJobs = asString(body.pastedJobs);
    const userContext = typeof body.userContext === 'object' && body.userContext ? body.userContext : {};
    const preferences = asRecord(body.preferences);
    fallback = fallbackReport(target, city, workStyle, pastedJobs, preferences);

    const prompt = JSON.stringify({
      target,
      city,
      workStyle,
      pastedJobs,
      preferences,
      userContext,
      expectedOutput: `请基于用户画像、岗位偏好和岗位文本生成职业路径可行性研究。重点输出偏好匹配维度、可比较的岗位方向、搜索入口和下一步验证动作。默认先给国内真实岗位语境，优先使用中国大陆招聘市场里更常见、真实存在且可搜索的岗位名称、中文岗位需求表达、国内公司类型和本地工作方式；不要创造概念岗位名或诗意岗位名。如果用户使用自定义叫法，必须翻译成真实招聘中更常见的岗位名称、相邻岗位名或部门名称。只有在用户明确选择海外、国际、英文岗位或远程跨国机会时，再补充英文关键词和国际渠道。岗位能力、常见的岗位需求和能力要求必须来自真实职位描述或常见岗位要求，不能写成用户天赋能力；用户天赋只能用于匹配判断和差距补齐建议。没有真实数据时生成搜索策略并明确需验证，不要伪造岗位、公司或薪资，也不要在没有真实近期样本时声称来自近3个月平台抽样。JSON 字段里的用户可见文字也要遵守以下规则：${COACH_MESSAGE_FORMATTING_RULES}`,
    });
    const content = await requestQwenOpportunity(req, prompt);
    const parsed = JSON.parse(extractJson(content));
    const report = normalizeReport(parsed, fallback);
    return NextResponse.json({ report, provider: 'qwen' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    console.warn(`[coach-opportunity] Using fallback report. ${message}`);
    return NextResponse.json({
      report: fallback || fallbackReport('待确认职业方向', '', '', ''),
      provider: 'local-fallback',
      providerNote: '模型机会搜索接口暂不可用，已返回本地框架报告。',
    });
  }
}
