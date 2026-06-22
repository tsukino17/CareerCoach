import {
  CAREER_DEMO_CASE_KEY,
  CAREER_DEMO_MODE_KEY,
  CAREER_DRAFT_TOKEN_KEY,
  CHAT_STORAGE_KEY,
  CONVERSATION_META_STORAGE_KEY,
  REPORT_STORAGE_KEY,
  type CareerReport,
} from '@/lib/career-path';

export type DemoCase = {
  id: string;
  title: string;
  audience: string;
  scenario: string;
  pitchMessages: Array<{ id: string; role: 'user' | 'assistant'; content: string }>;
  messages: Array<{ id: string; role: 'user' | 'assistant'; content: string }>;
  report: CareerReport;
};

export const DEMO_CASES: DemoCase[] = [
  {
    id: 'insight',
    title: '洞察表达型',
    audience: '适合展示“从自我理解走向现实路径判断”',
    scenario: '适合那些已经感到原有工作节奏不再匹配自己，但还说不清真正应该往哪里发展的人。',
    pitchMessages: [
      {
        id: 'pitch-u-1',
        role: 'user',
        content: '用户常常会说，自己并不是完全没有能力，而是越来越不确定原本熟悉的工作方式是否还适合长期投入，也隐约感觉自己真正擅长的部分，也许并不只是表面上的执行任务。',
      },
      {
        id: 'pitch-a-1',
        role: 'assistant',
        content: '系统会先帮用户把这种模糊不安翻译成更清楚的方向问题：到底是对当前岗位环境感到疲惫，还是能力结构本身已经在指向更上游、更偏洞察与判断的职业路径。',
      },
    ],
    messages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: '你好。我是这里的倾听者，也是你的天赋挖掘者。我想通过对话，帮你发现你可能忽略的职业优势。今天你的职业状态感觉如何？',
      },
      {
        id: 'u-1',
        role: 'user',
        content: '我最近有点迷茫。我一直在做 UI 相关工作，但这半年 AI 发展太快了，团队对设计产出的工期要求明显缩短，我经常会有一种自己正在被压缩、甚至被替代的感觉。',
      },
      {
        id: 'a-1',
        role: 'assistant',
        content: '你现在承受的，不只是岗位变化本身，更像是一种“原本熟悉的价值判断正在失效”的不安。你不是单纯累，而是在怀疑：如果执行速度越来越不构成优势，那自己真正能长期依靠的能力到底是什么。',
      },
      {
        id: 'u-2',
        role: 'user',
        content: '对，我发现自己其实并不只是喜欢画界面。我更在意用户为什么会卡住、信息是不是被理解、一个产品到底有没有把体验说清楚。可如果继续留在纯 UI 执行里，我会越来越疲惫。',
      },
      {
        id: 'a-2',
        role: 'assistant',
        content: '这说明你真正稳定的价值，可能不在“更快出图”，而在“理解用户、梳理体验、把复杂问题讲清楚”。你对纯执行型 UI 工作的疲惫，不一定是你不够努力，更可能是在提醒你：你的能力已经开始往更上游的洞察、体验判断和内容表达移动了。',
      },
      {
        id: 'u-3',
        role: 'user',
        content: '我也想过要不要转去做用户研究、内容策略，或者偏体验策划，但我又担心这些方向听起来都很虚，不知道市场到底买不买单。',
      },
      {
        id: 'a-3',
        role: 'assistant',
        content: '这个担心很真实。所以你现在最需要的，不是立刻决定“转什么岗”，而是先把自己的优势结构看清楚，再去看这些方向在市场里分别对应什么岗位、什么门槛、什么公司环境。只有这样，你才不是被焦虑推着逃离 UI，而是在主动靠近一个更适合你长期发展的方向。',
      },
    ],
    report: {
      archetype: '体验洞察者',
      skills: ['用户洞察', '体验判断', '内容表达', '信息整合'],
      rpg_stats: [
        { name: '洞察', value: 90 },
        { name: '表达', value: 82 },
        { name: '执行', value: 58 },
        { name: '逻辑', value: 78 },
        { name: '共情', value: 84 },
      ],
      superpowers: [
        {
          name: '从界面问题里看见真实体验问题',
          description: '你不会只停留在视觉层面，而是会自然去追问：用户为什么卡住、信息为什么没被理解、体验为什么不顺。',
          potential_roles: ['用户研究', '体验策略', '服务设计'],
        },
        {
          name: '把复杂体验讲清楚',
          description: '你不仅能感受到问题，还擅长把体验逻辑、用户感受和信息结构组织成别人能理解的表达。',
          potential_roles: ['内容策略', '体验策划', '产品教育'],
        },
      ],
      summary:
        '这类用户真正的困惑，通常不是“我有没有能力”，而是“我过去依赖的价值方式，是否还适合未来继续投入”。系统识别出的关键线索往往是：他们真正稳定的优势，不只在执行层，而在更上游的体验洞察、信息组织与判断表达。',
      target_roles: ['用户研究', '体验策略', '内容策略'],
    },
  },
  {
    id: 'coordination',
    title: '协同推进型',
    audience: '适合展示偏产品/运营/项目管理方向',
    scenario: '适合那些擅长推进复杂事情、让多人协作重新有秩序，但还不确定自己该落在哪类管理与推进岗位的人。',
    pitchMessages: [
      {
        id: 'pitch-u-1',
        role: 'user',
        content: '用户在团队里常常承担推进与协调角色，擅长把混乱局面梳理出节奏，但不确定自己更适合产品、项目管理还是运营管理这类方向。',
      },
      {
        id: 'pitch-a-1',
        role: 'assistant',
        content: '系统会把这种“能推进、会拆解、能让复杂协作重新有秩序”的能力单独识别出来，再去判断它在不同岗位中的承接方式，而不是只按岗位名做表面匹配。',
      },
    ],
    messages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: '你好。我是这里的倾听者，也是你的天赋挖掘者。我想通过对话，帮你发现你可能忽略的职业优势。今天你的职业状态感觉如何？',
      },
      {
        id: 'u-1',
        role: 'user',
        content: '我经常在团队里把事情往前推，大家有点乱的时候，我会自然去梳理优先级。',
      },
      {
        id: 'a-1',
        role: 'assistant',
        content: '这说明你不只是执行力好，更像是天然会站到“怎么让复杂协作重新有秩序”的位置上。',
      },
      {
        id: 'u-2',
        role: 'user',
        content: '但我又不太想做很外向、天天销售那种，我更喜欢把目标拆清楚再推进。',
      },
      {
        id: 'a-2',
        role: 'assistant',
        content: '那你的优势可能更适合放在“协同推进、结构化拆解、跨团队落地”的岗位，而不是高强度陌生关系开拓型工作。',
      },
    ],
    report: {
      archetype: '秩序推进者',
      skills: ['项目推进', '跨部门协同', '优先级梳理', '流程拆解'],
      rpg_stats: [
        { name: '执行', value: 86 },
        { name: '组织', value: 90 },
        { name: '沟通', value: 77 },
        { name: '逻辑', value: 82 },
        { name: '创意', value: 60 },
      ],
      superpowers: [
        {
          name: '在混乱里建立秩序',
          description: '面对多人参与、信息混杂的局面，你很容易找到主线和推进节奏。',
          potential_roles: ['产品经理', '项目管理', '运营管理'],
        },
        {
          name: '把目标拆成可执行路径',
          description: '你不仅会想方向，还会本能地去想具体怎样安排、谁来配合、先后顺序如何。',
          potential_roles: ['流程运营', 'PMO', '交付管理'],
        },
      ],
      summary:
        '这类用户常见的特征不是“特别会说”，而是会自然承担推进、协调与拆解复杂目标的角色。系统需要把这种容易被忽略的组织型天赋，从“我只是比较会做事”重新定义成清晰的岗位价值。',
      target_roles: ['产品经理', '项目管理', '流程运营'],
    },
  },
  {
    id: 'service',
    title: '高信任关系型',
    audience: '适合展示陪伴、咨询、用户成功等方向',
    scenario: '适合那些擅长理解人、建立信任，但还没有把这种关系能力当成职业优势来看待的人。',
    pitchMessages: [
      {
        id: 'pitch-u-1',
        role: 'user',
        content: '用户发现自己很容易建立信任、理解别人的真实卡点，但一直不确定这种能力能否对应到现实职业路径，而不是只被当成“性格好”。',
      },
      {
        id: 'pitch-a-1',
        role: 'assistant',
        content: '系统会先把这种高信任关系能力从“个性特征”提炼成“职业能力”，再帮助用户判断它更适合落在陪伴、咨询、用户成功还是顾问型岗位中。',
      },
    ],
    messages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: '你好。我是这里的倾听者，也是你的天赋挖掘者。我想通过对话，帮你发现你可能忽略的职业优势。今天你的职业状态感觉如何？',
      },
      {
        id: 'u-1',
        role: 'user',
        content: '我发现别人很容易跟我讲心里话，而且我经常能比较快抓到他们真正卡住的点。',
      },
      {
        id: 'a-1',
        role: 'assistant',
        content: '这不是简单的“会聊天”，更像是一种稳定建立信任、并且能帮助别人整理感受和问题的能力。',
      },
      {
        id: 'u-2',
        role: 'user',
        content: '我以前总觉得这不算什么专业能力，但现在有点怀疑它是不是其实可以落到真实工作里。',
      },
      {
        id: 'a-2',
        role: 'assistant',
        content: '很可能可以，而且这类能力往往越到需要长期关系、陪伴支持和高信任协作的场景里，价值越明显。',
      },
    ],
    report: {
      archetype: '信任陪伴者',
      skills: ['共情倾听', '关系建立', '需求理解', '表达安抚'],
      rpg_stats: [
        { name: '共情', value: 92 },
        { name: '表达', value: 79 },
        { name: '洞察', value: 81 },
        { name: '执行', value: 66 },
        { name: '稳定性', value: 84 },
      ],
      superpowers: [
        {
          name: '让人愿意说真话',
          description: '你很容易营造出被理解、被接住的感觉，这会自然提升关系质量。',
          potential_roles: ['用户成功', '职业辅导', '客户顾问'],
        },
        {
          name: '在情绪背后听见真正需求',
          description: '你不是只听表面表达，而是会更快意识到别人到底为什么卡住。',
          potential_roles: ['咨询顾问', '社群运营', '服务设计'],
        },
      ],
      summary:
        '这类用户最容易忽略的是，自己最稳定的价值并不只是“性格温和”，而是高质量地建立理解、信任与陪伴关系。系统的作用，是把这种原本被当成个性特质的东西，翻译成职业世界里可以被识别的能力。',
      target_roles: ['用户成功', '职业辅导', '客户顾问'],
    },
  },
];

export function getDemoCaseById(id: string | null | undefined) {
  if (!id) return null;
  return DEMO_CASES.find((item) => item.id === id) || null;
}

export function seedDemoCaseToStorage(selectedCase: DemoCase) {
  const token = `test-draft-${selectedCase.id}-${Date.now()}`;
  if (typeof window === 'undefined') return token;

  window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(selectedCase.messages));
  window.localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(selectedCase.report));
  window.localStorage.setItem(CAREER_DRAFT_TOKEN_KEY, token);
  window.localStorage.setItem(CAREER_DEMO_MODE_KEY, '1');
  window.localStorage.setItem(CAREER_DEMO_CASE_KEY, selectedCase.id);
  window.localStorage.setItem(
    CONVERSATION_META_STORAGE_KEY,
    JSON.stringify([
      {
        id: `test-conv-${selectedCase.id}-${Date.now()}`,
        title: `${selectedCase.title} 样例对话`,
        created_at: new Date().toISOString(),
        messages: selectedCase.messages,
      },
    ])
  );

  return token;
}

export function persistDemoToStorage(caseId: string) {
  if (typeof window === 'undefined') return false;
  const demoCase = getDemoCaseById(caseId);
  if (!demoCase) return false;
  seedDemoCaseToStorage(demoCase);
  return true;
}

export function isDemoModeActive() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(CAREER_DEMO_MODE_KEY) === '1';
}

export function getActiveDemoCaseId() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(CAREER_DEMO_CASE_KEY);
}

export function clearDemoStorage() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(CHAT_STORAGE_KEY);
  window.localStorage.removeItem(REPORT_STORAGE_KEY);
  window.localStorage.removeItem(CAREER_DRAFT_TOKEN_KEY);
  window.localStorage.removeItem(CAREER_DEMO_MODE_KEY);
  window.localStorage.removeItem(CAREER_DEMO_CASE_KEY);
  window.localStorage.removeItem(CONVERSATION_META_STORAGE_KEY);
}
