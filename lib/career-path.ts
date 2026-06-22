export const REPORT_STORAGE_KEY = 'career_report_v1';
export const CHAT_STORAGE_KEY = 'career_chat_history_v1';
export const CONVERSATION_META_STORAGE_KEY = 'career_conversations_meta';
export const CAREER_DRAFT_TOKEN_KEY = 'career_draft_token_v1';
export const CAREER_PATH_CLAIMED_NOTICE_KEY = 'career_path_claimed_notice_v1';
export const CAREER_DEMO_MODE_KEY = 'career_demo_mode_v1';
export const CAREER_DEMO_CASE_KEY = 'career_demo_case_v1';
export const CAREER_REAL_SAMPLE_KEY = 'career_real_sample_v1';
export const CAREER_REAL_SAMPLE_LIBRARY_KEY = 'career_real_sample_library_v1';
export const CAREER_ACTIVE_REAL_SAMPLE_ID_KEY = 'career_active_real_sample_id_v1';
export const CAREER_PROFILE_SUMMARY_KEY = 'career_profile_summary_v1';

export type CareerSuperpower =
  | string
  | {
      name: string;
      description: string;
      potential_roles?: string[];
    };

export type CareerReport = {
  archetype: string;
  skills: string[];
  rpg_stats?: Array<{ name: string; value: number }>;
  superpowers: CareerSuperpower[];
  summary: string;
  target_roles?: string[];
  generated_by?: 'model' | 'fallback';
};

export type CareerProfileSummary = {
  updatedAt: string;
  messageCount: number;
  userMessageCount: number;
  lastUserSignal: string;
  keywords: string[];
};

export type StoredCareerSampleMessage = {
  id?: string;
  role: string;
  content: string;
};

export function isReportRequestLikeContent(content: unknown) {
  if (typeof content !== 'string') return false;
  const text = normalizeSampleText(content);
  if (!text) return false;

  return [
    /^(报告|总结|分析|画像|测评|结果|结论|路径预览)[。.!！?？\s]*$/,
    /(生成|产出|输出|给我|帮我|可以|能不能|能否).*(报告|总结|分析|画像|测评|结果|结论)/,
    /(报告|总结|画像|测评|结果|结论).*(生成|产出|输出|看看|查看|看一下|看下)/,
    /(看看|查看|看一下|看下|打开).*(报告|总结|分析|画像|结果|结论)/,
    /(不想|不太想|先不|不继续|不用).*(聊|说|继续)/,
    /(不聊了|先到这|到这里|差不多了|够了|可以了|结束吧|停一下|暂停)/,
    /^(好的?|好|嗯|行|可以|继续|继续聊聊|谢谢|辛苦了|ok|OK)[。.!！?？\s]*$/,
  ].some((pattern) => pattern.test(text));
}

export function isCareerProfileMaterialContent(content: unknown) {
  if (typeof content !== 'string') return false;
  const text = normalizeSampleText(content);
  if (text.length < 6) return false;
  if (isReportRequestLikeContent(text)) return false;
  return true;
}

export function filterCareerProfileMaterialMessages<T extends { role?: unknown; content?: unknown }>(messages: T[]) {
  return messages.filter((item) => item.role === 'user' || item.role === 'assistant').filter((item) => {
    if (item.role !== 'user') return true;
    return isCareerProfileMaterialContent(item.content);
  });
}

export type StoredCareerRealSample = {
  id: string;
  createdAt: string;
  source: 'model_report';
  report: CareerReport;
  messages: StoredCareerSampleMessage[];
  label?: string;
};

function normalizeSampleText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

const FALLBACK_KEYWORD_RULES = [
  { keyword: '共情', aliases: ['共情', '倾听', '陪伴', '理解人', '情绪', '咨询'] },
  { keyword: '洞察', aliases: ['洞察', '分析', '观察', '研究', '判断', '复盘'] },
  { keyword: '表达', aliases: ['表达', '写作', '内容', '沟通', '讲', '传播'] },
  { keyword: '推进', aliases: ['推进', '执行', '落地', '项目', '协调', '组织'] },
  { keyword: '结构化', aliases: ['结构', '系统', '流程', '整理', '规划', '秩序'] },
  { keyword: '创造', aliases: ['创意', '设计', '创造', '想法', '体验', '美感'] },
];

export function buildCareerProfileSummary(messages: StoredCareerSampleMessage[]): CareerProfileSummary {
  const userMessages = messages
    .filter((item) => item?.role === 'user' && typeof item.content === 'string')
    .map((item) => normalizeSampleText(item.content))
    .filter(Boolean);
  const allText = userMessages.join(' ');
  const keywords = FALLBACK_KEYWORD_RULES
    .filter((rule) => rule.aliases.some((alias) => allText.includes(alias)))
    .map((rule) => rule.keyword)
    .slice(0, 6);

  return {
    updatedAt: new Date().toISOString(),
    messageCount: messages.length,
    userMessageCount: userMessages.length,
    lastUserSignal: userMessages[userMessages.length - 1]?.slice(0, 180) || '',
    keywords: keywords.length ? keywords : ['探索', '自我理解', '职业方向'],
  };
}

export function buildFallbackCareerReport(messages: StoredCareerSampleMessage[]): CareerReport {
  const summary = buildCareerProfileSummary(messages);
  const joinedKeywords = summary.keywords.join('、');
  const lastSignal = summary.lastUserSignal;
  const archetype = summary.keywords.includes('共情')
    ? '共情洞察者'
    : summary.keywords.includes('结构化')
      ? '结构梳理者'
      : summary.keywords.includes('表达')
        ? '表达连接者'
        : '潜能探索者';

  return {
    archetype,
    skills: summary.keywords.slice(0, 5),
    rpg_stats: [
      { name: '自我觉察', value: 76 },
      { name: '洞察力', value: summary.keywords.includes('洞察') ? 84 : 72 },
      { name: '共情力', value: summary.keywords.includes('共情') ? 86 : 70 },
      { name: '表达力', value: summary.keywords.includes('表达') ? 82 : 68 },
      { name: '行动清晰度', value: 64 },
    ],
    superpowers: [
      {
        name: '从经历里提取线索',
        description: lastSignal
          ? `你已经开始把真实感受和职业选择联系起来。尤其是“${lastSignal}”这类表达，说明你不是只在找一个岗位名称，而是在辨认更适合自己的工作状态。`
          : '你正在把模糊的职业感受整理成可以讨论的线索，这是后续判断方向的基础。',
      },
      {
        name: '围绕关键优势做判断',
        description: `目前对话里比较明显的关键词是：${joinedKeywords}。这些词可以先作为临时坐标，帮助你判断哪些方向值得继续验证。`,
      },
      {
        name: '需要用现实样本校准',
        description: '这是一份基础报告，适合先看见自己的轮廓。更细的岗位场景、日常工作和对比判断，可以在你点开具体职业时再生成。',
      },
    ],
    summary:
      `你的职业原型更接近“${archetype}”。目前能稳定读到的线索集中在${joinedKeywords}：你适合先把这些能力当作临时坐标，用来筛选更值得了解的职业方向。因为这是一份轻量报告，它不会替你下最终判断，更适合作为进入岗位细节、现实路径和后续对话校准的起点。`,
    generated_by: 'fallback',
  };
}

function buildSampleFingerprint(
  report: CareerReport,
  messages: StoredCareerSampleMessage[],
) {
  const lastUserMessage = [...messages]
    .reverse()
    .find((item) => item?.role === 'user' && typeof item.content === 'string')
    ?.content;

  return [
    normalizeSampleText(report.archetype || ''),
    normalizeSampleText(report.summary || ''),
    normalizeSampleText(lastUserMessage || ''),
  ]
    .filter(Boolean)
    .join('::');
}

export type PathDirectionCluster = {
  id: string;
  name: string;
  tagline: string;
  fit_reason: string;
  strengths: string[];
  sample_roles: string[];
};

export type PathMapPreview = {
  headline: string;
  introduction: string;
  direction_clusters: PathDirectionCluster[];
  market_insight_prompts: string[];
  preparation_focuses: string[];
};

type DirectionDefinition = {
  id: string;
  name: string;
  tagline: string;
  fit_reason: string;
  strengths: string[];
  sample_roles: string[];
  keywords: string[];
};

const DIRECTION_LIBRARY: DirectionDefinition[] = [
  {
    id: 'insight-strategy',
    name: '洞察与策略型',
    tagline: '适合把复杂信息整理成判断与方向的人。',
    fit_reason: '你更容易在理解人、提炼问题、形成判断的工作里发挥稳定优势。',
    strengths: ['洞察', '整合', '抽象思考'],
    sample_roles: ['用户研究', '内容策略', '战略分析'],
    keywords: ['洞察', '分析', '策略', '研究', '抽象', '逻辑', '判断', '咨询', '规划'],
  },
  {
    id: 'coordination-execution',
    name: '复杂协同推进型',
    tagline: '适合推动多人协作、把事情落地成结果的人。',
    fit_reason: '你在跨方沟通、任务推进和把模糊目标拆成路径这类场景里会更有掌控感。',
    strengths: ['推进', '协调', '执行节奏'],
    sample_roles: ['产品经理', '项目管理', '运营管理'],
    keywords: ['执行', '推进', '协同', '组织', '管理', '产品', '运营', '落地', '项目'],
  },
  {
    id: 'expression-influence',
    name: '内容表达与影响型',
    tagline: '适合用表达建立理解、信任与影响的人。',
    fit_reason: '如果你擅长把感受、观点或复杂内容讲明白，这类方向更容易积累可见价值。',
    strengths: ['表达', '叙事', '影响力'],
    sample_roles: ['品牌内容', '市场策划', '新媒体运营'],
    keywords: ['表达', '内容', '创意', '写作', '传播', '品牌', '叙事', '营销'],
  },
  {
    id: 'relationship-service',
    name: '高信任关系服务型',
    tagline: '适合通过理解与陪伴创造价值的人。',
    fit_reason: '你更可能在需要长期信任、共情沟通和陪伴支持的工作中建立自己的不可替代性。',
    strengths: ['共情', '倾听', '关系建立'],
    sample_roles: ['用户成功', '职业辅导', '客户顾问'],
    keywords: ['共情', '倾听', '陪伴', '支持', '服务', '关系', '顾问', '咨询'],
  },
  {
    id: 'system-optimization',
    name: '流程优化与系统型',
    tagline: '适合把混乱局面梳理成稳定机制的人。',
    fit_reason: '如果你天然会关注结构、秩序和效率，这类岗位更容易让你的优势被长期看见。',
    strengths: ['结构化', '流程意识', '稳定输出'],
    sample_roles: ['流程运营', '数据运营', '供应链协调'],
    keywords: ['流程', '系统', '结构', '秩序', '优化', '数据', '稳定', '规范'],
  },
];

function extractTextFromSuperpower(item: CareerSuperpower) {
  if (typeof item === 'string') return item;
  return `${item.name || ''} ${item.description || ''} ${(item.potential_roles || []).join(' ')}`.trim();
}

export function extractPotentialRoles(report: CareerReport) {
  const roles = new Set<string>();
  for (const role of report.target_roles || []) {
    if (role?.trim()) roles.add(role.trim());
  }
  for (const superpower of report.superpowers || []) {
    if (typeof superpower === 'object') {
      for (const role of superpower.potential_roles || []) {
        if (role?.trim()) roles.add(role.trim());
      }
    }
  }
  return Array.from(roles).slice(0, 8);
}

export function buildPathMapPreview(report: CareerReport): PathMapPreview {
  const potentialRoles = extractPotentialRoles(report);
  const signalText = [
    report.archetype,
    report.summary,
    ...(report.skills || []),
    ...potentialRoles,
    ...(report.superpowers || []).map(extractTextFromSuperpower),
  ]
    .join(' ')
    .toLowerCase();

  const ranked = DIRECTION_LIBRARY.map((direction) => {
    const score = direction.keywords.reduce((acc, keyword) => {
      return acc + (signalText.includes(keyword.toLowerCase()) ? 2 : 0);
    }, 0);
    return { ...direction, score };
  })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((direction, index) => {
      const matchedSkills = (report.skills || []).filter((skill) => {
        const normalizedSkill = skill.toLowerCase();
        return direction.keywords.some((keyword) => normalizedSkill.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(normalizedSkill));
      });
      const evidenceStrengths = Array.from(new Set([...matchedSkills, ...direction.strengths])).slice(0, 3);
      const matchedRoles = potentialRoles.filter((role) => {
        const normalizedRole = role.toLowerCase();
        return (
          direction.sample_roles.some((sampleRole) => normalizedRole.includes(sampleRole.toLowerCase()) || sampleRole.toLowerCase().includes(normalizedRole)) ||
          direction.keywords.some((keyword) => normalizedRole.includes(keyword.toLowerCase()))
        );
      });
      const sampleRoles =
        matchedRoles.length > 0
          ? matchedRoles.slice(0, 4)
          : index === 0 && potentialRoles.length > 0
            ? potentialRoles.slice(0, 4)
            : direction.sample_roles;
      const strengthText = evidenceStrengths.length ? evidenceStrengths.join('、') : report.archetype;
      const roleText = sampleRoles.length ? sampleRoles.slice(0, 3).join('、') : '相关岗位';

      return {
        id: direction.id,
        name: direction.name,
        tagline: direction.tagline,
        fit_reason:
          index === 0
            ? `先把它当作优先验证的方向假设。它和你目前呈现出的“${strengthText}”更接近，可先用${roleText}做现实校准，看真实日常是否匹配你的工作方式。`
            : `这是相邻备选假设，适合用来做对照。你可以留意${roleText}，判断自己更适合靠近哪类工作节奏。`,
        strengths: evidenceStrengths,
        sample_roles: sampleRoles,
      };
    });

  return {
    headline: `把“${report.archetype}”翻译成现实职业方向`,
    introduction:
      '这份预览不会直接替你下结论，而是先把你的职业画像转换成值得认真考虑的方向轮廓，让你更稳地判断“先往哪里走”。',
    direction_clusters: ranked,
    market_insight_prompts: [
      '同一岗位在不同行业里的真实工作差异是什么。',
      '这个方向在市场上的门槛、薪资带和成长路径如何。',
      '如果先不急着行动，最值得先想清楚的准备重点是什么。',
    ],
    preparation_focuses: [
      '先明确哪些方向值得重点考虑，而不是盲目广撒网。',
      '把你的优势翻译成招聘市场能识别的能力语言。',
      '在真正投递前，先判断要补的短板与更适合的切入方式。',
    ],
  };
}

export function createDraftSummary(report: CareerReport, preview?: PathMapPreview) {
  return {
    archetype: report.archetype,
    summary: report.summary,
    skills: report.skills || [],
    suggested_roles: extractPotentialRoles(report),
    direction_clusters: preview?.direction_clusters?.map((item) => item.name) || [],
  };
}

export function getOrCreateCareerDraftToken() {
  if (typeof window === 'undefined') return null;
  const existing = window.localStorage.getItem(CAREER_DRAFT_TOKEN_KEY);
  if (existing) return existing;
  const token = window.crypto?.randomUUID?.() || `draft-${Date.now()}`;
  window.localStorage.setItem(CAREER_DRAFT_TOKEN_KEY, token);
  return token;
}

export function saveGeneratedCareerSample(report: CareerReport, messages: StoredCareerSampleMessage[]) {
  if (typeof window === 'undefined') return null;
  const normalizedMessages = messages
    .filter((item) => item && typeof item.role === 'string' && typeof item.content === 'string')
    .map((item) => ({
      id: item.id,
      role: item.role,
      content: item.content,
    }));
  const fingerprint = buildSampleFingerprint(report, normalizedMessages);
  const library = readCareerSampleLibrary();
  const matchedSample = fingerprint
    ? library.find((item) => buildSampleFingerprint(item.report, item.messages) === fingerprint)
    : null;
  const sample: StoredCareerRealSample = {
    id: matchedSample?.id || window.crypto?.randomUUID?.() || `real-sample-${Date.now()}`,
    createdAt: matchedSample?.createdAt || new Date().toISOString(),
    source: 'model_report',
    report,
    messages: normalizedMessages,
    label: report.archetype || '真实模型案例',
  };
  window.localStorage.setItem(CAREER_REAL_SAMPLE_KEY, JSON.stringify(sample));
  const nextLibrary = [sample, ...library.filter((item) => item.id !== sample.id)].slice(0, 12);
  window.localStorage.setItem(CAREER_REAL_SAMPLE_LIBRARY_KEY, JSON.stringify(nextLibrary));
  window.localStorage.setItem(CAREER_ACTIVE_REAL_SAMPLE_ID_KEY, sample.id);
  return sample;
}

export function readGeneratedCareerSample() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(CAREER_REAL_SAMPLE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredCareerRealSample;
  } catch (error) {
    console.error('Failed to parse generated career sample', error);
    return null;
  }
}

export function readCareerSampleLibrary() {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(CAREER_REAL_SAMPLE_LIBRARY_KEY);
  if (!raw) {
    const single = readGeneratedCareerSample();
    return single ? [single] : [];
  }
  try {
    const parsed = JSON.parse(raw) as StoredCareerRealSample[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to parse career sample library', error);
    return [];
  }
}

export function readActiveCareerSample() {
  if (typeof window === 'undefined') return null;
  const activeId = window.localStorage.getItem(CAREER_ACTIVE_REAL_SAMPLE_ID_KEY);
  const library = readCareerSampleLibrary();
  if (activeId) {
    const active = library.find((item) => item.id === activeId);
    if (active) return active;
  }
  return library[0] || readGeneratedCareerSample();
}

export function setActiveCareerSample(sampleId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CAREER_ACTIVE_REAL_SAMPLE_ID_KEY, sampleId);
}

export function deleteCareerSample(sampleId: string) {
  if (typeof window === 'undefined') return;
  const library = readCareerSampleLibrary().filter((item) => item.id !== sampleId);
  window.localStorage.setItem(CAREER_REAL_SAMPLE_LIBRARY_KEY, JSON.stringify(library));
  const activeId = window.localStorage.getItem(CAREER_ACTIVE_REAL_SAMPLE_ID_KEY);
  if (activeId === sampleId) {
    if (library[0]?.id) {
      window.localStorage.setItem(CAREER_ACTIVE_REAL_SAMPLE_ID_KEY, library[0].id);
      window.localStorage.setItem(CAREER_REAL_SAMPLE_KEY, JSON.stringify(library[0]));
    } else {
      window.localStorage.removeItem(CAREER_ACTIVE_REAL_SAMPLE_ID_KEY);
      window.localStorage.removeItem(CAREER_REAL_SAMPLE_KEY);
    }
  }
}
