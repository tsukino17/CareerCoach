'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Compass,
  FilePenLine,
  FileText,
  Heart,
  EyeOff,
  LayoutGrid,
  Menu,
  PanelRight,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PATH_TEST_PERSONAS, CORE_VALUE_LABELS, type PathTestPersona } from '@/lib/path-test-personas';
import { getMockConversation } from '@/lib/path-test-conversations';
import { buildLegoProfileFromReport, displayPathTitle, type DeliveryFormat, type LegoPath } from '@/lib/path-lego';
import {
  isStep2Unlocked,
  mergeRequirementChecks,
  parseReadinessFromReply,
  parseRequirementCardsFromReply,
  REQUIREMENT_STATUS_META,
  type ReadinessSummary,
  type SelectedPathBrief,
} from '@/lib/path-step';
import {
  EMPTY_CONSTRAINTS,
  PROFICIENCY_META,
  parseEvidenceCardsFromReply,
  type EvidenceCard,
  type RealityConstraints,
} from '@/lib/path-evidence';
import { PathLegoPanel } from '@/app/path/components/path-lego-panel';
import { supabase } from '@/lib/supabase';
import { authHeaders } from '@/lib/api-auth';
import { AuthDialog } from '@/components/auth-dialog';
import {
  buildCareerProfileSummary,
  buildPathMapPreview,
  CAREER_DRAFT_TOKEN_KEY,
  CAREER_PROFILE_SUMMARY_KEY,
  CHAT_STORAGE_KEY,
  REPORT_STORAGE_KEY,
  type CareerReport,
  type PathMapPreview,
  type StoredCareerSampleMessage,
  extractPotentialRoles,
  readActiveCareerSample,
} from '@/lib/career-path';
import { getDemoCaseById, isDemoModeActive } from '@/lib/demo-cases';
import { trackEvent } from '@/lib/analytics-client';

type PathMessage = { role: 'user' | 'assistant'; content: string; evidenceCards?: EvidenceCard[] };
type PathTask = {
  id: string;
  title: string;
  createdAt: string;
  completedAt: string | null;
  sourceMessage: string;
};
type PathReflection = {
  dateKey: string;
  content: string;
  mood: PathMood;
  updatedAt: string;
};
type PathConversationArchive = {
  id: string;
  title: string;
  archivedAt: string;
  dateKey: string;
  messages: PathMessage[];
};
type PathResourceCategory = 'ability' | 'experience' | 'interest' | 'access';
type PathResourceNote = {
  id: string;
  roleName: string | null;
  category: PathResourceCategory;
  text: string;
  source: string;
  createdAt: string | null;
};
type PathBoardSummary = {
  leastResistancePath: string;
  reason: string;
  nextStep: string;
  resources: string[];
  resourceNotes: PathResourceNote[];
  tools: string[];
  places: string[];
  updatedAt: string | null;
  source: string;
};

type PathMood = 'bright' | 'steady' | 'stuck' | 'low';
type CareerExplorationCheckId = 'jd' | 'salary' | 'skills' | 'comparison' | 'conversation' | 'next-step';
type PanelId = 'overview' | 'tasks' | 'reflection' | 'calendar' | 'modules' | 'exploration' | 'profile' | 'updates';

const PATH_BOARD_SUMMARY_KEY = 'career_path_board_summary_v1';
const PATH_TASKS_KEY = 'career_path_micro_tasks_v1';
const PATH_REFLECTIONS_KEY = 'career_path_daily_reflections_v1';
const PATH_CONVERSATION_ARCHIVES_KEY = 'career_path_conversation_archives_v1';
const PATH_CAREER_EXPLORATION_KEY = 'career_path_career_exploration_checks_v1';
const PATH_VISIBLE_PANELS_KEY = 'career_path_visible_panels_v1';
// 现实教练阶段隐藏的面板（探索焦点 / 任务列表 / 今日觉察 / 探索入口），后期由行动力教练启用
const HIDDEN_PANEL_IDS: PanelId[] = ['overview', 'tasks', 'reflection', 'exploration'];
const DEFAULT_VISIBLE_PANELS: PanelId[] = [];
const ALL_PANEL_IDS: PanelId[] = ['overview', 'tasks', 'reflection', 'calendar', 'modules', 'exploration', 'profile', 'updates'];

const CAREER_EXPLORATION_STEPS: Array<{ id: CareerExplorationCheckId; title: string; description: string }> = [
  { id: 'jd', title: '看过 3 条岗位需求', description: '知道这个岗位通常在做什么、公司怎么描述它。' },
  { id: 'salary', title: '查过薪资和地区差异', description: '有一个粗略薪资区间，不把单条信息当结论。' },
  { id: 'skills', title: '拆过高频能力词', description: '圈出反复出现的工具、技能、经验和作品要求。' },
  { id: 'comparison', title: '对比过 2 个相邻岗位', description: '知道它和相似岗位的任务边界、门槛和发展差异。' },
  { id: 'conversation', title: '问过 1 位从业者或看过真实经验', description: '补到招聘文本里看不到的日常、压力和隐性规则。' },
  { id: 'next-step', title: '形成下一步验证动作', description: '知道接下来是继续查、做作品、信息面谈还是试投。' },
];

const MOOD_OPTIONS: Array<{ value: PathMood; label: string; emoji: string; color: string }> = [
  { value: 'bright', label: '亮起来', emoji: '😄', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  { value: 'steady', label: '稳稳的', emoji: '🙂', color: 'text-[#2A6FA3] bg-[#DDEEFF] border-[#86B8FF]/45' },
  { value: 'stuck', label: '有点卡', emoji: '🤔', color: 'text-violet-600 bg-violet-50 border-violet-100' },
  { value: 'low', label: '能量低', emoji: '😐', color: 'text-slate-600 bg-slate-100 border-slate-200' },
];

function pickTopItems(values: string[], count: number) {
  return Array.from(new Set((values || []).map((item) => item.trim()).filter(Boolean))).slice(0, count);
}

function summarizeSuperpowers(report: CareerReport | null) {
  if (!report) return [] as string[];
  const items = (report.superpowers || [])
    .map((item) => (typeof item === 'string' ? item : `${item.name} ${item.description}`))
    .filter(Boolean);
  return pickTopItems(items, 3);
}

function buildCoachIntro(report: CareerReport | null, preview: PathMapPreview | null) {
  const strengths = pickTopItems(report?.skills || summarizeSuperpowers(report), 3);
  const roles = pickTopItems(preview?.direction_clusters.flatMap((cluster) => cluster.sample_roles) || extractPotentialRoles(report || ({} as CareerReport)), 3);
  const roleText = roles.length ? roles.join('、') : '一些现实岗位';

  return `我们先一起看看，你已经拥有的能力可以在哪些现实岗位里继续发挥。我读取到你的优势线索有${strengths.slice(0, 3).join('、') || '一些核心优势'}，可能的职业方向包括${roleText}。你想先了解哪个职业方向？`;
}

function buildInitialBoardSummary(report: CareerReport | null, preview: PathMapPreview | null): PathBoardSummary {
  const primaryCluster = preview?.direction_clusters?.[0];
  const topRoles = pickTopItems(primaryCluster?.sample_roles || extractPotentialRoles(report || ({} as CareerReport)), 3);
  const resources = pickTopItems([...(report?.skills || []), ...(primaryCluster?.strengths || [])], 5);
  const roleText = topRoles[0] || primaryCluster?.name || '一个最容易验证的职业方向';

  return {
    leastResistancePath: primaryCluster?.name || roleText,
    reason: resources.length
      ? `这个方向能承接你已经显露出的${resources.slice(0, 3).join('、')}，可以先从其中一个具体岗位继续了解。`
      : '这是当前更值得先了解的方向之一，后续会结合真实经历和岗位信息继续调整。',
    nextStep: '先和教练一起看见一条你愿意继续了解的可能性，再由你选择最顺手的探索入口。',
    resources,
    resourceNotes: [],
    tools: ['招聘信息', '信息面谈', '作品/经历盘点'],
    places: ['招聘平台', '从业者社群', '朋友/同事网络'],
    updatedAt: null,
    source: '来自天赋能力报告的初版整理',
  };
}

function buildBoardSummaryFromConversation(report: CareerReport | null, preview: PathMapPreview | null, messages: PathMessage[]): PathBoardSummary {
  const latestUserText = [...messages].reverse().find((item) => item.role === 'user')?.content || '';
  const base = buildInitialBoardSummary(report, preview);
  const mentionedRole =
    pickTopItems(preview?.direction_clusters.flatMap((item) => item.sample_roles) || extractPotentialRoles(report || ({} as CareerReport)), 8)
      .find((role) => latestUserText.includes(role)) || base.leastResistancePath;
  const resourceNotes = mergeResourceNotes(
    base.resourceNotes,
    messages.filter((item) => item.role === 'user').flatMap((item) => inferResourceNotesFromUserText(item.content, mentionedRole))
  );
  const now = new Date();

  return {
    ...base,
    leastResistancePath: mentionedRole,
    reason: `从刚才的对话看，你对“${mentionedRole}”已经有更明确的注意力。它适合先放进资源板里耐心观察：哪些任务真的吸引你，哪些要求会消耗你，哪些已有能力可以自然迁移。`,
    nextStep: `你可以从“${mentionedRole}”的岗位日常、真实职位描述、相邻岗位或从业者经验里，选一个最想先了解的角度。`,
    resources: pickTopItems([...base.resources, ...resourceNotes.map((note) => note.text)], 8),
    resourceNotes,
    updatedAt: now.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
    source: `根据右侧现实路径教练的 ${messages.filter((item) => item.role === 'user').length} 轮对话整理`,
  };
}

function normalizeBoardSummary(board: Partial<PathBoardSummary> | null, fallback: PathBoardSummary): PathBoardSummary {
  if (!board) return fallback;
  const savedNotes = Array.isArray(board.resourceNotes)
    ? board.resourceNotes.filter((note) => note?.text && note?.category && !isAbstractTalentAbilityNote(note as PathResourceNote))
    : [];
  const normalizedSavedNotes = (savedNotes as PathResourceNote[]).map((note) => ({
    ...note,
    roleName: note.roleName || fallback.leastResistancePath,
  }));
  return {
    ...fallback,
    ...board,
    resources: Array.isArray(board.resources) ? pickTopItems(board.resources, 8) : fallback.resources,
    resourceNotes: mergeResourceNotes(fallback.resourceNotes, normalizedSavedNotes),
    tools: Array.isArray(board.tools) ? board.tools : fallback.tools,
    places: Array.isArray(board.places) ? board.places : fallback.places,
  };
}

function createResourceNote(
  category: PathResourceCategory,
  text: string,
  source: string,
  createdAt: string | null = new Date().toISOString(),
  roleName: string | null = null
): PathResourceNote {
  const normalized = text.replace(/\s+/g, '').slice(0, 48);
  const normalizedRole = (roleName || '未分类岗位').replace(/\s+/g, '').slice(0, 32);
  return {
    id: `${normalizedRole}-${category}-${normalized}`,
    roleName,
    category,
    text: text.trim(),
    source,
    createdAt,
  };
}

function mergeResourceNotes(existing: PathResourceNote[], incoming: PathResourceNote[]) {
  const seen = new Set<string>();
  return [...existing, ...incoming]
    .filter((note) => note.text.trim())
    .filter((note) => !isAbstractTalentAbilityNote(note))
    .filter((note) => {
      const key = `${note.roleName || '未分类岗位'}:${note.category}:${note.text.replace(/\s+/g, '')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 24);
}

function isAbstractTalentAbilityNote(note: Pick<PathResourceNote, 'category' | 'text' | 'source'>) {
  if (note.category !== 'ability') return false;
  if (note.source === '来自天赋能力报告') return true;
  return /^(视觉节奏把控|留白与分寸感|用户体验微调|跨媒介叙事迁移|环境情绪翻译|感知型接口)$/.test(note.text.trim());
}

function inferResourceNotesFromUserText(text: string, roleName: string | null = null): PathResourceNote[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const notes: PathResourceNote[] = [];
  if (/(写过|整理过|输出过|维护过|改过|做过).{0,14}(解释说明|说明文档|技术文档|文档|教程|指南|操作手册|配置说明|帮助中心)/.test(trimmed)) {
    notes.push(createResourceNote('experience', '写过解释说明类文档，可作为技术文档、内容设计或用户教育方向的经验素材。', '来自现实路径教练对话', undefined, roleName));
  }
  if (/(做过|参与过|负责过|整理过|分析过).{0,16}(用户反馈|用户调研|访谈|问卷|可用性测试|体验问题|需求整理)/.test(trimmed)) {
    notes.push(createResourceNote('experience', '处理过用户反馈或体验问题，可作为用户研究、体验优化方向的经验素材。', '来自现实路径教练对话', undefined, roleName));
  }
  if (/(做过|参与过|负责过|推进过|协调过).{0,16}(项目|活动|上线|协作|跨部门|客户|交付)/.test(trimmed)) {
    notes.push(createResourceNote('experience', '有项目推进或跨角色协作经验，可用于证明协作交付能力。', '来自现实路径教练对话', undefined, roleName));
  }
  if (/(擅长|熟悉|比较会|能|可以).{0,18}(拆解|表达|写作|结构化|梳理|分析|复盘|沟通|协调)/.test(trimmed)) {
    notes.push(createResourceNote('ability', '具备表达、拆解或结构化整理相关能力，可用于岗位能力对照。', '来自现实路径教练对话', undefined, roleName));
  }
  if (/(感兴趣|想了解|想尝试|更想|想先看|吸引|愿意继续|可以继续聊)/.test(trimmed) && !/(不感兴趣|没兴趣|不想|不太想|不愿意)/.test(trimmed)) {
    notes.push(createResourceNote('interest', '用户表达了对这个岗位方向的兴趣，可作为意愿线索继续验证。', '来自现实路径教练对话', undefined, roleName));
  }

  return mergeResourceNotes([], notes);
}

function hasEnoughEvidenceForPathUpdate(messages: PathMessage[], checks: CareerExplorationCheckId[]) {
  const userTurns = messages.filter((item) => item.role === 'user' && item.content.trim()).length;
  const hasCoreEvidence = checks.includes('jd') && checks.includes('skills') && checks.includes('next-step');
  const hasRealityContext = checks.includes('comparison') || checks.includes('conversation') || checks.includes('salary');
  return userTurns >= 3 && hasCoreEvidence && hasRealityContext;
}

function splitAssistantReply(reply: string): PathMessage[] {
  const normalized = insertSemanticBreaks(reply.replace(/\r/g, '')).replace(/\n{3,}/g, '\n\n').trim();
  if (normalized.length <= 520) return [{ role: 'assistant', content: normalized }];

  const blocks = normalized.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  if (blocks.length < 2) {
    const sentences = normalized
      .split(/(?<=[。！？；])/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (sentences.length < 2) return [{ role: 'assistant', content: normalized }];

    const first: string[] = [];
    const second: string[] = [];
    const target = normalized.length / 2;
    let firstLength = 0;
    sentences.forEach((sentence) => {
      if (firstLength < target || second.length === 0) {
        first.push(sentence);
        firstLength += sentence.length;
      } else {
        second.push(sentence);
      }
    });

    const splitMessages: PathMessage[] = [
      { role: 'assistant', content: first.join('') },
      { role: 'assistant', content: second.join('') },
    ];
    return splitMessages.filter((message) => message.content.trim());
  }

  let firstLength = 0;
  let splitIndex = 1;
  const target = normalized.length / 2;
  for (let index = 0; index < blocks.length - 1; index += 1) {
    firstLength += blocks[index].length;
    splitIndex = index + 1;
    if (firstLength >= target) break;
  }

  const splitMessages: PathMessage[] = [
    { role: 'assistant', content: blocks.slice(0, splitIndex).join('\n\n') },
    { role: 'assistant', content: blocks.slice(splitIndex).join('\n\n') },
  ];
  return splitMessages.filter((message) => message.content.trim());
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const COACH_SECTION_LABELS = [
  '常见岗位名称：',
  '真实工作日常：',
  '常见的岗位需求：',
  '你和这些要求的连接点：',
  '还需要补齐的证据：',
  '还需要验证：',
  '待验证点：',
  '下一步只观察：',
  '微行动：',
  '真实岗位摘录：',
  '岗位链接：',
  '薪资粗略范围：',
];

function insertSemanticBreaks(input: string) {
  let text = input
    .replace(/\r/g, '')
    .replace(/【\/?强调】/g, '')
    .replace(/\[\/?强调\]/g, '')
    .replace(/它在现实中不是诗意概念，?而是/g, '')
    .replace(/不是诗意概念，?而是/g, '')
    .replace(/你已有的能力(?:天然)?接口(?:很强)?在这里：?[\s\S]*$/g, '')
    .replace(/(?:它和你的能力有明确接口|这个方向与你的天赋有清晰接口)：?[^。！？]*(?:。|$)/g, '')
    .replace(/你提到对这个方向感兴趣，是因为它更贴近你擅长的哪一部分？比如：是环境情绪翻译带来的客户行为预判力？还是跨媒介叙事迁移能力在客户旅程设计中的应用？或是留白与分寸感[^。！？]*(?:。|$)/g, '你提到对这个方向感兴趣，可以先落到实际任务上看：你更想做客户数据和反馈分析、客户旅程梳理、触达话术设计、帮助文档整理，还是跨团队推动流程优化？')
    .replace(/环境情绪翻译带来的客户行为预判力/g, '判断客户卡点和行为信号')
    .replace(/跨媒介叙事迁移能力在客户旅程设计中的应用/g, '把客户旅程拆成清楚的流程、话术和文档')
    .replace(/跨媒介叙事迁移/g, '跨渠道内容整理')
    .replace(/环境情绪翻译/g, '判断用户状态')
    .replace(/留白与分寸感/g, '控制信息密度和沟通节奏')
    .replace(/感知型接口/g, '体验判断')
    .replace(/客户行为预判力/g, '客户行为判断')
    .replace(/什么该介入、什么该静默/g, '什么时候主动触达、什么时候减少打扰')
    .replace(/[✓✔✅]\s*/g, '')
    .replace(/\s*(?:→|=>|->)\s*/g, '，')
    .replace(/JD里的常见职位要求/g, '常见的岗位需求')
    .replace(/岗位需求里的常见要求/g, '常见的岗位需求')
    .replace(/高频能力词（[^）]*JD抽样[^）]*）/g, '常见的岗位需求')
    .replace(/高频能力词（[^）]*）/g, '常见的岗位需求')
    .replace(/高频能力词里，和你直接相连的是：/g, '你和这些要求的连接点：')
    .replace(/和你直接相连的是：/g, '你和这些要求的连接点：')
    .replace(/JD里高频出现的\s*(?=\n|$)/g, '')
    .replace(/JD中高频出现的\s*(?=\n|$)/g, '')
    .replace(/(?:高频能力词(?:在JD中)?反复出现|能力关键词高频出现|高频能力关键词|岗位能力|能力要求)：?/g, '常见的岗位需求：')
    .replace(/(?:这类岗位的日常核心是|岗位日常核心是|这类岗位的真实工作日常包括|岗位的真实工作日常包括|真实工作日常包括|这个岗位常见的工作内容有|它日常会做|真实工作日常)：?/g, '真实工作日常：')
    .replace(/(?:待验证的是|仍需验证|需要验证的是)：?/g, '还需要验证：')
    .replace(/比如\s*(?!：)/g, '比如：')
    .replace(/([：；，])，+/g, '$1')
    .replace(/([：；])\s*，/g, '$1')
    .replace(/，{2,}/g, '，')
    .replace(/(典型一天可能包括|一天可能包括|日常任务可能包括|日常通常包括)：?\s*(?=(上午|中午|下午|晚上|下班前|会前|会中|会后|第一步|第二步|第三步))/g, '$1：\n• ')
    .replace(/[；。]?\s*(上午|中午|下午|晚上|下班前|会前|会中|会后|第一步|第二步|第三步)：/g, '\n• $1：')
    .replace(/，?恰好对应[^。！？]*(?:最常被忽视|决定成败|底层能力|天然接口)[^。！？]*(?:。|$)/g, '。')
    .replace(/，?正是[^。！？]*(?:最常被忽视|决定成败|底层能力|天然接口)[^。！？]*(?:。|$)/g, '。')
    .replace(/([：，。；、！？）》”])\s+/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .trim();

  COACH_SECTION_LABELS.forEach((label) => {
    text = text.replace(new RegExp(`([^\\n])\\s*(${escapeRegExp(label)})`, 'g'), '$1\n\n$2');
  });

  text = text
    .replace(/([。！？；])\s*(?=(接下来可以|接下来我|验证入口|观察清单|能力记录|这条经验|这类经历|这些都可能是|这类素材|它不需要|从准备度看|目前可以先判断|如果继续看|你对这个岗位|你为什么对|你更想先看清|你想先看|你想先了解|你最想先了解|我可以帮你拆|如果你愿意|接下来[，,]?你|接下来你可以告诉我|可以只说|我来帮你|看1条真实|或直接))/g, '$1\n\n')
    .replace(/([：])\s*(?=(比如：|例如：))/g, '$1\n\n')
    .replace(/(你(?:对这个方向)?最想先了解的是：)\s*[•●▪◦▸]\s*/g, '$1')
    .replace(/(是否包含：)\s*[•●▪◦▸]\s*/g, '$1')
    .replace(/(那么，?你对这个方向最想先了解的是：)\s*[•●▪◦▸]\s*/g, '$1')
    .replace(/([？])\s*[•●▪◦▸]\s*/g, '$1')
    .replace(/([：；])\s*[,，]+/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

function readPathTasks(): PathTask[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PATH_TASKS_KEY) || '[]') as PathTask[];
    return Array.isArray(parsed)
      ? parsed.filter((item) => item?.id && item?.title).map((item) => ({ ...item, completedAt: item.completedAt || null }))
      : [];
  } catch {
    return [];
  }
}

function savePathTasks(tasks: PathTask[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PATH_TASKS_KEY, JSON.stringify(tasks));
}

function readCareerExplorationChecks(): Record<string, CareerExplorationCheckId[]> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PATH_CAREER_EXPLORATION_KEY) || '{}') as Record<string, CareerExplorationCheckId[]>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).map(([role, checks]) => [
        role,
        Array.isArray(checks)
          ? checks.filter((item): item is CareerExplorationCheckId => CAREER_EXPLORATION_STEPS.some((step) => step.id === item))
          : [],
      ])
    );
  } catch {
    return {};
  }
}

function saveCareerExplorationChecks(checksByRole: Record<string, CareerExplorationCheckId[]>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PATH_CAREER_EXPLORATION_KEY, JSON.stringify(checksByRole));
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readPathReflections(): PathReflection[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PATH_REFLECTIONS_KEY) || '[]') as PathReflection[];
    return Array.isArray(parsed)
      ? parsed.filter((item) => item?.dateKey && typeof item.content === 'string' && item.mood)
      : [];
  } catch {
    return [];
  }
}

function savePathReflection(reflection: PathReflection) {
  if (typeof window === 'undefined') return;
  const existing = readPathReflections();
  const next = [
    reflection,
    ...existing.filter((item) => item.dateKey !== reflection.dateKey),
  ];
  window.localStorage.setItem(PATH_REFLECTIONS_KEY, JSON.stringify(next));
}

function findTodayReflection() {
  const todayKey = toDateKey(new Date());
  return readPathReflections().find((item) => item.dateKey === todayKey) || null;
}

function readConversationArchives(): PathConversationArchive[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PATH_CONVERSATION_ARCHIVES_KEY) || '[]') as PathConversationArchive[];
    return Array.isArray(parsed)
      ? parsed.filter((item) => item?.id && item?.archivedAt && Array.isArray(item.messages))
      : [];
  } catch {
    return [];
  }
}

function saveConversationArchives(archives: PathConversationArchive[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PATH_CONVERSATION_ARCHIVES_KEY, JSON.stringify(archives.slice(0, 50)));
}

function createArchiveId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `path-archive-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildArchiveTitle(messages: PathMessage[]) {
  const firstUserMessage = messages.find((item) => item.role === 'user')?.content.trim();
  if (!firstUserMessage) return '现实路径教练对话';
  return firstUserMessage.length > 18 ? `${firstUserMessage.slice(0, 18)}...` : firstUserMessage;
}

function getArchivesForDate(archives: PathConversationArchive[], dateKey: string) {
  return archives.filter((archive) => archive.dateKey === dateKey);
}

function createTaskId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `path-task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extractMicroAction(content: string) {
  const actionMatch = content.match(/微行动[：:]\s*([^\n。！？!?]{4,80})/);
  if (actionMatch?.[1]) return actionMatch[1].trim().replace(/[，,；;：:]\s*$/, '');

  const lightActionMatch = content.match(/(?:今天|现在|这一轮).*?(?:写下|圈出|选出|回想|观察)([^。！？!?]{4,70})/);
  if (lightActionMatch?.[0]) return lightActionMatch[0].trim();

  return '';
}

function isMicroActionConfirmation(text: string) {
  const trimmed = text.trim();
  if (/(不|不能|不想|不要|暂时|算了|以后|没法|做不到)/.test(trimmed)) return false;
  return /^(可以|可以的|好|好的|行|能|能的|愿意|我愿意|我可以|没问题|确认|试试|可以试试|能完成)/.test(trimmed);
}

function maybeAddConfirmedMicroAction(tasks: PathTask[], messages: PathMessage[], userText: string) {
  if (!isMicroActionConfirmation(userText)) return tasks;
  const lastAssistant = [...messages].reverse().find((item) => item.role === 'assistant');
  if (!lastAssistant || !/(微行动|微小但是意义重大|今天你能完成)/.test(lastAssistant.content)) return tasks;

  const title = extractMicroAction(lastAssistant.content);
  if (!title || tasks.some((item) => item.title === title && !item.completedAt)) return tasks;

  return [
    {
      id: createTaskId(),
      title,
      createdAt: new Date().toISOString(),
      completedAt: null,
      sourceMessage: lastAssistant.content,
    },
    ...tasks,
  ];
}

function getTaskStats(tasks: PathTask[]) {
  const completed = tasks.filter((item) => item.completedAt).length;
  return { completed, pending: tasks.length - completed };
}

function getMonthDates(cursor: Date): Array<Date | null> {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const dates: Array<Date | null> = Array(first.getDay()).fill(null);
  for (let day = 1; day <= last.getDate(); day += 1) {
    dates.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
  }
  while (dates.length % 7 !== 0) dates.push(null);
  return dates;
}

function formatDateLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

function getTasksForDate(tasks: PathTask[], dateKey: string) {
  return tasks.filter((task) => {
    const createdKey = toDateKey(new Date(task.createdAt));
    const completedKey = task.completedAt ? toDateKey(new Date(task.completedAt)) : '';
    return createdKey === dateKey || completedKey === dateKey;
  });
}

function getCompletedTasksForDate(tasks: PathTask[], dateKey: string) {
  return tasks.filter((task) => task.completedAt && toDateKey(new Date(task.completedAt)) === dateKey);
}

function readStoredMessages(): StoredCareerSampleMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CHAT_STORAGE_KEY) || '[]') as StoredCareerSampleMessage[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.role && item?.content) : [];
  } catch {
    return [];
  }
}

function persistArchiveSummary(
  report: CareerReport | null,
  board: PathBoardSummary,
  pathMessages: PathMessage[],
  tasks: PathTask[],
  reflection: PathReflection | null
) {
  if (typeof window === 'undefined') return;
  const materialMessages: StoredCareerSampleMessage[] = [
    ...readStoredMessages(),
    ...pathMessages.map((item) => ({ role: item.role, content: item.content })),
  ];
  const profileSummary = buildCareerProfileSummary(materialMessages);
  window.localStorage.setItem(
    CAREER_PROFILE_SUMMARY_KEY,
    JSON.stringify({
      ...profileSummary,
      reportArchetype: report?.archetype || '',
      leastResistancePath: board.leastResistancePath,
      pathNextStep: board.nextStep,
      microTasks: tasks.map((item) => ({
        title: item.title,
        completed: Boolean(item.completedAt),
        completedAt: item.completedAt,
      })),
      todayReflection: reflection
        ? {
            content: reflection.content,
            mood: reflection.mood,
            updatedAt: reflection.updatedAt,
          }
        : null,
      updatedFrom: 'path_archive_update',
    })
  );
  window.localStorage.setItem(PATH_BOARD_SUMMARY_KEY, JSON.stringify(board));
}

function persistPathBoardSummary(board: PathBoardSummary) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PATH_BOARD_SUMMARY_KEY, JSON.stringify(board));
}

// 现实路径对话 id：同一天连续使用归入同一场对话，归档或超过 6 小时后自动新建
const PATH_ANALYTICS_CONVERSATION_KEY = 'career_path_analytics_conversation';
function getPathAnalyticsConversationId(reset = false) {
  if (typeof window === 'undefined') return 'server';
  const now = Date.now();
  try {
    const raw = JSON.parse(window.localStorage.getItem(PATH_ANALYTICS_CONVERSATION_KEY) || '{}') as { id?: string; at?: number };
    if (!reset && raw.id && now - Number(raw.at || 0) < 6 * 60 * 60 * 1000) {
      window.localStorage.setItem(PATH_ANALYTICS_CONVERSATION_KEY, JSON.stringify({ id: raw.id, at: now }));
      return raw.id;
    }
  } catch {
    // 本地存储损坏时直接新建
  }
  const id = `path_conv_${now}_${Math.random().toString(36).slice(2, 8)}`;
  window.localStorage.setItem(PATH_ANALYTICS_CONVERSATION_KEY, JSON.stringify({ id, at: now }));
  return id;
}

function PathModule({
  icon: Icon,
  title,
  description,
  accent,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accent: string;
  items: string[];
}) {
  return (
    <Card className="rounded-[1.2rem] border border-slate-200/80 bg-white/88 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent}`}>
            <Icon className="h-4 w-4 text-inherit" />
          </span>
          <div>
            <CardTitle className="text-base font-semibold text-[#2A6FA3]">{title}</CardTitle>
            <p className="mt-1 text-xs leading-6 text-slate-500">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length ? items.map((item) => (
          <div key={item} className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 text-sm leading-6 text-slate-700">
            {item}
          </div>
        )) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-4 text-sm text-slate-400">
            这里先留给你填内容。
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const EVIDENCE_STATUS_META: Record<EvidenceCard['status'], { label: string; className: string }> = {
  pending: { label: '待你确认', className: 'bg-amber-50 text-amber-700' },
  confirmed: { label: '已证实', className: 'bg-emerald-50 text-emerald-700' },
  partial: { label: '部分证实', className: 'bg-sky-50 text-sky-700' },
  rejected: { label: '不成立', className: 'bg-slate-100 text-slate-500' },
};

/** 对话内可交互的证据确认卡：三出口（准确 / 补充 / 不准确） */
function EvidenceConfirmCard({
  card,
  onConfirm,
  onSupplement,
  onReject,
}: {
  card: EvidenceCard;
  onConfirm: () => void;
  onSupplement: (amendment: string) => void;
  onReject: () => void;
}) {
  const [supplementing, setSupplementing] = useState(false);
  const [draft, setDraft] = useState('');
  const meta = EVIDENCE_STATUS_META[card.status];
  const proficiency = PROFICIENCY_META[card.proficiency];
  return (
    <div className="mt-2 w-full rounded-2xl border border-[#86B8FF]/30 bg-white/95 p-3.5 text-sm shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#2A6FA3]">
          <ClipboardCheck className="h-3.5 w-3.5 text-sky-500" />
          能力证据确认卡
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}>{meta.label}</span>
      </div>
      <div className="mt-2.5 font-semibold text-[#2A6FA3]">{card.capability}</div>
      <div className="mt-2 grid gap-1.5 leading-6 text-slate-700">
        <div><span className="font-semibold text-slate-500">你的经历：</span>{card.experienceSummary}</div>
        <div><span className="font-semibold text-slate-500">可复用能力：</span>{card.reusableAbility}</div>
        <div><span className="font-semibold text-slate-500">岗位动作：</span>{card.targetAction}</div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="rounded-full bg-[#F3F8FF] px-2.5 py-1 font-semibold text-[#2A6FA3]" title={proficiency.hint}>{proficiency.label}</span>
        {card.artifact ? <span className="rounded-full bg-slate-50 px-2.5 py-1">可展示：{card.artifact}</span> : null}
      </div>
      {card.status === 'pending' ? (
        supplementing ? (
          <div className="mt-3 rounded-xl border border-[#B9D8F2]/80 bg-[#F3F8FF]/70 p-3">
            <div className="text-xs font-semibold text-[#47708F]">哪里不准确，或者你想补充什么？教练会按你的修正重新记录。</div>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={2}
              placeholder="例如：这件事是团队一起做的，我只是参与其中。"
              className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#86B8FF] focus:ring-2 focus:ring-[#86B8FF]/20"
            />
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                className="rounded-full bg-[#86B8FF]/85 text-[#225F91] shadow-sm hover:bg-[#78AAEE]"
                disabled={!draft.trim()}
                onClick={() => {
                  onSupplement(draft.trim());
                  setSupplementing(false);
                  setDraft('');
                }}
              >
                提交补充
              </Button>
              <Button size="sm" variant="ghost" className="rounded-full text-slate-500 hover:bg-white/80" onClick={() => { setSupplementing(false); setDraft(''); }}>
                返回
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" className="rounded-full bg-[#86B8FF]/85 text-[#225F91] shadow-sm hover:bg-[#78AAEE]" onClick={onConfirm}>这条准确</Button>
            <Button size="sm" variant="outline" className="rounded-full border-[#B9D8F2] bg-white/80 text-[#47708F]" onClick={() => setSupplementing(true)}>我想补充</Button>
            <Button size="sm" variant="ghost" className="rounded-full text-slate-500 hover:bg-white/80" onClick={onReject}>不太准确</Button>
          </div>
        )
      ) : card.status === 'partial' && card.userAmendment ? (
        <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-2 text-xs leading-6 text-sky-900">
          按你的补充记录：{card.userAmendment}
        </div>
      ) : card.status === 'confirmed' ? (
        <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          已证实，沉淀为路径证据。
        </div>
      ) : card.status === 'rejected' ? (
        <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <X className="h-3.5 w-3.5" />
          已记录为不成立，教练不会再引用这条证据。
        </div>
      ) : null}
    </div>
  );
}

/** 证据进度面板：数据驱动的证据卡总览 + 现实约束 */
function EvidenceProgressPanel({ cards, constraints }: { cards: EvidenceCard[]; constraints: RealityConstraints }) {
  const confirmedCount = cards.filter((card) => card.status === 'confirmed' || card.status === 'partial').length;
  const pendingCount = cards.filter((card) => card.status === 'pending').length;
  const hasConstraints = Boolean(
    constraints.weeklyHours?.trim() || constraints.financialRunway?.trim() || constraints.hardNo.length || constraints.selfInitiated.length
  );
  return (
    <section className="rounded-[1.6rem] border border-[#86B8FF]/22 bg-white/82 p-5 shadow-[0_18px_50px_rgba(134,184,255,0.12)] backdrop-blur md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#2A6FA3]">
            <ClipboardCheck className="h-4 w-4 text-sky-500" />
            能力证据进度
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500">教练从你的真实经历里提炼可复用能力，逐条与你确认后沉淀为路径证据。实际核对数量根据岗位动态确定，通常是 3–5 项。</p>
        </div>
        <span className="rounded-full bg-[#F3F8FF] px-3 py-1 text-xs font-semibold text-[#2A6FA3]">
          {cards.length ? `已证实 ${confirmedCount} 项 · 待确认 ${pendingCount} 项` : '尚未开始核对'}
        </span>
      </div>
      {cards.length ? (
        <div className="mt-4 space-y-3">
          {cards.map((card) => {
            const meta = EVIDENCE_STATUS_META[card.status];
            const proficiency = PROFICIENCY_META[card.proficiency];
            return (
              <div key={card.id} className="rounded-2xl border border-[#86B8FF]/20 bg-[#F3F8FF]/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[#2A6FA3]">{card.capability}</div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span>
                </div>
                <div className="mt-2 grid gap-1 text-sm leading-6 text-slate-700">
                  <div><span className="font-semibold text-slate-500">经历：</span>{card.experienceSummary}</div>
                  <div><span className="font-semibold text-slate-500">可复用能力：</span>{card.reusableAbility}</div>
                  <div><span className="font-semibold text-slate-500">岗位动作：</span>{card.targetAction}</div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-white/85 px-2.5 py-1 font-semibold text-[#2A6FA3]" title={proficiency.hint}>{proficiency.label}</span>
                  {card.artifact ? <span className="rounded-full bg-white/85 px-2.5 py-1">可展示：{card.artifact}</span> : null}
                </div>
                {card.status === 'partial' && card.userAmendment ? (
                  <div className="mt-2 text-xs leading-5 text-sky-800">按你的补充记录：{card.userAmendment}</div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-[#86B8FF]/30 bg-[#F3F8FF]/50 px-4 py-5 text-sm leading-6 text-slate-400">
          教练还没有从对话里提炼出能力证据。聊一段具体的工作经历后，这里会出现第一张证据卡。
        </div>
      )}
      <div className="mt-5 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#7A97B5]">
          <Clock3 className="h-3.5 w-3.5" />
          现实约束
        </div>
        {hasConstraints ? (
          <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
            {constraints.weeklyHours?.trim() ? <div><span className="font-semibold text-slate-500">时间预算：</span>{constraints.weeklyHours}</div> : null}
            {constraints.financialRunway?.trim() ? <div><span className="font-semibold text-slate-500">收入断档缓冲：</span>{constraints.financialRunway}</div> : null}
            {constraints.paceIntent?.trim() ? <div><span className="font-semibold text-slate-500">节奏意图：</span>{constraints.paceIntent}</div> : null}
            {constraints.hardNo.length ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-slate-500">绝对不做：</span>
                {constraints.hardNo.map((item) => (
                  <span key={item} className="rounded-full border border-[#F0DADA] bg-[#FBF3F3] px-2.5 py-1 text-xs text-[#A06B6B]">{item}</span>
                ))}
              </div>
            ) : null}
            {constraints.selfInitiated.length ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-slate-500">已经在做：</span>
                {constraints.selfInitiated.map((item) => (
                  <span key={item} className="rounded-full border border-[#D8E8DC] bg-[#F2F8F3] px-2.5 py-1 text-xs text-[#5E8A70]">{item}</span>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-sm leading-6 text-slate-400">和教练聊交付形态时，会一起确认你的时间预算、收入缓冲和"绝对不做"清单。</p>
        )}
      </div>
    </section>
  );
}

type RoleReadinessDimension = {
  label: '能力匹配度' | '经验' | '意愿' | '资源';
  score: number;
};

type RoleResourceGroup = {
  roleName: string;
  abilities: string[];
  experiences: string[];
  interests: string[];
  access: string[];
  checks: CareerExplorationCheckId[];
  readiness: {
    totalScore: number;
    status: string;
    evidenceLabel: string;
    dimensions: RoleReadinessDimension[];
  };
};

const ROLE_RESOURCE_LIMIT = 3;

function ProductTabs({
  items,
  activeValue,
  onChange,
  disabled = false,
  children,
}: {
  items: Array<{ value: string; label: string }>;
  activeValue: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const showTabs = items.length > 1;

  return (
    <div className="space-y-3">
      {showTabs ? (
        <div
          role="tablist"
          className="rounded-2xl border border-slate-200/80 bg-slate-100/70 p-1"
        >
          <div className="flex max-w-full gap-1 overflow-x-auto">
            {items.map((item) => {
              const active = item.value === activeValue;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  disabled={disabled}
                  onClick={() => onChange(item.value)}
                  className={`min-h-10 min-w-[8.5rem] flex-1 shrink-0 rounded-xl px-3 py-2 text-sm font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-[#86B8FF]/45 ${
                    active
                      ? 'bg-white text-[#2A6FA3] shadow-sm ring-1 ring-slate-200/80'
                      : 'text-slate-500 hover:bg-white/70 hover:text-slate-700'
                  } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <span className="block truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="rounded-2xl border border-slate-200/80 bg-white/92 p-4 shadow-[0_12px_28px_rgba(42,111,163,0.045)]">
        {children}
      </div>
    </div>
  );
}

function ResourceSupportModule({
  resourceNotes,
  fallbackAccess,
  currentRole,
  checksByRole,
}: {
  resourceNotes: PathResourceNote[];
  fallbackAccess: string[];
  currentRole: string;
  checksByRole: Record<string, CareerExplorationCheckId[]>;
}) {
  const groupedNotes = useMemo(
    () => groupResourceNotesByRole(resourceNotes, currentRole, fallbackAccess, checksByRole),
    [resourceNotes, currentRole, fallbackAccess, checksByRole]
  );
  const [activeRoleName, setActiveRoleName] = useState(groupedNotes[0]?.roleName || '');
  const activeGroup = groupedNotes.find((group) => group.roleName === activeRoleName) || groupedNotes[0];

  useEffect(() => {
    if (!groupedNotes.some((group) => group.roleName === activeRoleName)) {
      setActiveRoleName(groupedNotes[0]?.roleName || '');
    }
  }, [activeRoleName, groupedNotes]);

  return (
    <Card className="rounded-[1.2rem] border border-slate-200/80 bg-white/88 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Users className="h-4 w-4 text-inherit" />
          </span>
          <div>
            <CardTitle className="text-base font-semibold text-[#2A6FA3]">资源支持</CardTitle>
            <p className="mt-1 text-xs leading-6 text-slate-500">最多保留 3 个岗位，按岗位切换查看。</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {activeGroup ? (
          <ProductTabs
            items={groupedNotes.map((group) => ({ value: group.roleName, label: group.roleName }))}
            activeValue={activeGroup.roleName}
            onChange={setActiveRoleName}
          >
            <div className="space-y-3">
              <RoleReadinessChart summary={activeGroup.readiness} />
              <ResourceNoteGroup label="能力" items={activeGroup.abilities} emptyText="等对话继续沉淀能力线索。" />
              <ResourceNoteGroup label="经验" items={activeGroup.experiences} emptyText="用户提到真实经历后，会记录在这里。" />
              <ResourceNoteGroup label="意愿" items={activeGroup.interests} emptyText="用户明确表达兴趣后，会记录在这里。" />
              <ResourceNoteGroup label="资源" items={activeGroup.access} emptyText="有可访问的人、平台、城市或材料后，会记录在这里。" />
            </div>
          </ProductTabs>
        ) : null}
      </CardContent>
    </Card>
  );
}

function groupResourceNotesByRole(
  resourceNotes: PathResourceNote[],
  currentRole: string,
  fallbackAccess: string[],
  checksByRole: Record<string, CareerExplorationCheckId[]>
): RoleResourceGroup[] {
  const fallbackRole = currentRole || '待确认岗位';
  const roleNames = Array.from(new Set([fallbackRole, ...resourceNotes.map((note) => note.roleName || fallbackRole)]))
    .map((roleName) => roleName.trim())
    .filter(Boolean)
    .slice(0, ROLE_RESOURCE_LIMIT);

  return roleNames.map((roleName) => {
    const notes = resourceNotes.filter((note) => (note.roleName || fallbackRole) === roleName);
    const abilities = notes.filter((note) => note.category === 'ability').map((note) => note.text);
    const experiences = notes.filter((note) => note.category === 'experience').map((note) => note.text);
    const interests = notes.filter((note) => note.category === 'interest').map((note) => note.text);
    const access = notes.filter((note) => note.category === 'access').map((note) => note.text);
    const checks = checksByRole[roleName] || [];
    const visibleAccess = access.length ? access : fallbackAccess.slice(0, 4);
    return {
      roleName,
      abilities,
      experiences,
      interests,
      access: visibleAccess,
      checks,
      readiness: buildRoleReadiness({
        roleName,
        currentRole: fallbackRole,
        abilities,
        experiences,
        interests,
        access,
        checks,
      }),
    };
  });
}

function buildRoleReadiness({
  roleName,
  currentRole,
  abilities,
  experiences,
  interests,
  access,
  checks,
}: {
  roleName: string;
  currentRole: string;
  abilities: string[];
  experiences: string[];
  interests: string[];
  access: string[];
  checks: CareerExplorationCheckId[];
}) {
  const abilityScore = clampScore(abilities.length * 30 + (checks.includes('skills') ? 35 : 0));
  const experienceScore = clampScore(experiences.length * 42 + (checks.includes('conversation') ? 20 : 0));
  const interestScore = clampScore(interests.length * 52 + (roleName === currentRole ? 28 : 0) + (checks.length ? 8 : 0));
  const resourceScore = clampScore(
    access.length * 35
    + (checks.includes('jd') ? 20 : 0)
    + (checks.includes('salary') ? 15 : 0)
    + (checks.includes('comparison') ? 15 : 0)
    + (checks.includes('next-step') ? 15 : 0)
  );
  const totalScore = Math.round((abilityScore * 0.3) + (experienceScore * 0.3) + (interestScore * 0.2) + (resourceScore * 0.2));
  const evidenceCount = abilities.length + experiences.length + interests.length + access.length + checks.length;
  const status = evidenceCount < 3 ? '待确认' : totalScore >= 70 ? '准备度较高' : totalScore >= 45 ? '部分具备' : '证据偏少';

  return {
    totalScore,
    status,
    evidenceLabel: `${Math.min(evidenceCount, 5)}/5 项线索`,
    dimensions: [
      { label: '能力匹配度' as const, score: abilityScore },
      { label: '经验' as const, score: experienceScore },
      { label: '意愿' as const, score: interestScore },
      { label: '资源' as const, score: resourceScore },
    ],
  };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function RoleReadinessChart({ summary }: { summary: RoleResourceGroup['readiness'] }) {
  return (
    <div className="rounded-xl border border-white/80 bg-white/78 px-3 py-3 shadow-[0_8px_20px_rgba(42,111,163,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[#2A6FA3]">岗位准备度总览</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">{summary.status} · {summary.evidenceLabel}</div>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div>总分</div>
          <div className="text-lg font-bold leading-6 text-[#2A6FA3]">{summary.totalScore}</div>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {summary.dimensions.map((dimension) => (
          <div key={dimension.label} className="grid grid-cols-[74px_minmax(0,1fr)_32px] items-center gap-2 text-xs">
            <span className="text-slate-600">{dimension.label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full rounded-full bg-[#86B8FF]" style={{ width: `${dimension.score}%` }} />
            </span>
            <span className="text-right font-semibold text-[#2A6FA3]">{dimension.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResourceNoteGroup({ label, items, emptyText }: { label: string; items: string[]; emptyText: string }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold text-[#2A6FA3]">{label}</div>
      {items.length ? (
        <div className="space-y-1.5">
          {items.slice(0, 4).map((item) => (
            <div key={`${label}-${item}`} className="rounded-xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 text-sm leading-6 text-slate-700">
              {item}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-3 py-3 text-sm leading-6 text-slate-400">
          {emptyText}
        </div>
      )}
    </div>
  );
}

function CareerExplorationBoard({
  roles,
  selectedRole,
  checks,
  locked,
  onSelectRole,
  onToggleCheck,
  onOpenSearch,
}: {
  roles: string[];
  selectedRole: string;
  checks: CareerExplorationCheckId[];
  locked: boolean;
  onSelectRole: (role: string) => void;
  onToggleCheck: (id: CareerExplorationCheckId) => void;
  onOpenSearch: () => void;
}) {
  const progress = Math.round((checks.length / CAREER_EXPLORATION_STEPS.length) * 100);
  const currentRole = selectedRole || roles[0] || '待探索岗位';
  const roleTabs = Array.from(new Set([currentRole, ...(roles.length ? roles : [])]))
    .filter(Boolean)
    .slice(0, ROLE_RESOURCE_LIMIT)
    .map((role) => ({ value: role, label: role }));

  return (
    <Card className="rounded-[1.6rem] border border-[#86B8FF]/20 bg-white/88 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2A6FA3]">
              <BriefcaseBusiness className="h-4 w-4 text-sky-500" />
              我已经了解了什么
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
              这些是可以帮助你看清岗位的探索角度，不是必须完成的清单。你可以只勾选已经看过、聊过或确认过的部分。
            </p>
          </div>
          <Button
            variant="outline"
            className="rounded-full border-[#86B8FF]/35 bg-white/85 text-[#2A6FA3] shadow-sm hover:bg-[#F3F8FF]"
            onClick={onOpenSearch}
            disabled={locked}
          >
            <Search className="mr-2 h-4 w-4" />
            岗位聚合搜索
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ProductTabs items={roleTabs} activeValue={currentRole} onChange={onSelectRole} disabled={locked}>
          <div className="mx-auto max-w-3xl">
            <div className="rounded-xl border border-[#86B8FF]/18 bg-[#F3F8FF]/55 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-[#2A6FA3]">了解进度</span>
                <span className="font-bold text-[#2A6FA3]">{checks.length}/{CAREER_EXPLORATION_STEPS.length}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full bg-[#86B8FF]" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200/75 bg-white/84">
              {CAREER_EXPLORATION_STEPS.map((step) => {
                const done = checks.includes(step.id);
                return (
                  <button
                    key={step.id}
                    type="button"
                    disabled={locked}
                    onClick={() => onToggleCheck(step.id)}
                    className={`flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left transition last:border-b-0 ${
                      done ? 'bg-emerald-50/55' : 'hover:bg-[#F3F8FF]/65'
                    }`}
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-[#86B8FF]/55 bg-white text-transparent'
                    }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-semibold ${done ? 'text-emerald-800' : 'text-slate-700'}`}>
                        {step.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] leading-4 text-slate-500">{step.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </ProductTabs>
      </CardContent>
    </Card>
  );
}

function MobilePanel({
  id,
  title,
  description,
  expanded,
  onToggle,
  collapsedOnDesktop = false,
  children,
}: {
  id: PanelId;
  title: string;
  description: string;
  expanded: boolean;
  onToggle: (id: PanelId) => void;
  collapsedOnDesktop?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-4">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between rounded-[1.3rem] border border-[#86B8FF]/20 bg-white/78 px-5 py-4 text-left shadow-[0_12px_36px_rgba(15,23,42,0.05)] backdrop-blur min-[560px]:hidden"
      >
        <span>
          <span className="block text-base font-bold text-[#2A6FA3]">{title}</span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
        </span>
        <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      <div className={expanded ? 'block' : collapsedOnDesktop ? 'hidden' : 'hidden min-[560px]:block'}>{children}</div>
    </section>
  );
}

function ActionCenterCard({
  locked,
  mainlineTitle,
  ownedAbility,
  readinessScore,
  tasks,
  onToggleTask,
}: {
  locked: boolean;
  /** 主线：教练和用户确认要走的那条路径 */
  mainlineTitle: string | null;
  /** 已经拥有的能力（证据里的一句话） */
  ownedAbility: string | null;
  readinessScore: number | null;
  tasks: PathTask[];
  onToggleTask: (taskId: string) => void;
}) {
  const stats = getTaskStats(tasks);
  return (
    <Card className="rounded-[1.6rem] border border-[#86B8FF]/26 bg-[linear-gradient(180deg,rgba(243,248,255,0.96)_0%,rgba(255,255,255,0.88)_100%)] shadow-[0_18px_50px_rgba(134,184,255,0.16)] backdrop-blur">
      <CardContent className="p-0">
        {/* 顶部只保留两层信息：主线 + 已拥有能力 */}
        <div className="px-5 pb-4 pt-5 sm:px-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#7A97B5]">
            <Compass className="h-3.5 w-3.5" />
            主线
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[#2A6FA3]">
            {locked ? '完成天赋报告后生成' : (mainlineTitle || '还没有选定主线')}
          </h2>
          {!locked && ownedAbility ? (
            <p className="mt-1.5 text-sm leading-6 text-[#4A789C]">
              <span className="font-semibold text-[#5E8A70]">你已经拥有</span> {ownedAbility}
            </p>
          ) : null}
        </div>

        <div className="border-t border-[#86B8FF]/18" />

        {/* 主体：行动清单 */}
        <div className="px-5 pb-5 pt-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2A6FA3]">
              <ClipboardCheck className="h-4 w-4 text-sky-500" />
              行动清单
            </div>
            <div className="ml-auto flex items-center gap-2">
              {readinessScore !== null ? (
                <span className="rounded-full border border-[#86B8FF]/30 bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold text-[#2A6FA3]">
                  准备度 {readinessScore}
                </span>
              ) : null}
              <Badge variant="secondary" className="bg-[#86B8FF]/14 text-[#2A6FA3]">
                {stats.completed}/{tasks.length || 0}
              </Badge>
            </div>
          </div>
          <p className="mt-1 text-xs leading-5 text-[#7A97B5]">
            只收纳教练和你确认过的微行动，完成后打勾。
          </p>

          <div className="mt-3 space-y-2">
            {tasks.length ? tasks.map((task) => (
              <label
                key={task.id}
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm leading-6 transition-colors ${
                  task.completedAt
                    ? 'border-emerald-100 bg-emerald-50/70 text-slate-500'
                    : 'border-[#86B8FF]/22 bg-white/85 text-slate-700 hover:bg-[#F3F8FF]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={Boolean(task.completedAt)}
                  disabled={locked}
                  onChange={() => onToggleTask(task.id)}
                  className="mt-1 h-4 w-4 rounded border-[#86B8FF]/45 text-[#2A6FA3] focus:ring-[#86B8FF]"
                />
                <span className={task.completedAt ? 'line-through decoration-emerald-500/55' : ''}>
                  {task.title}
                </span>
              </label>
            )) : (
              <div className="rounded-2xl border border-dashed border-[#86B8FF]/25 bg-white/60 px-4 py-5 text-sm leading-7 text-slate-500">
                和教练确认的下一步，会记录在这里。
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TodayReflectionCard({
  value,
  mood,
  savedAt,
  locked,
  onChange,
  onMoodChange,
  onSave,
}: {
  value: string;
  mood: PathMood;
  savedAt: string | null;
  locked: boolean;
  onChange: (value: string) => void;
  onMoodChange: (mood: PathMood) => void;
  onSave: () => void;
}) {
  return (
    <Card className="rounded-[1.6rem] border border-[#86B8FF]/18 bg-white/82 shadow-[0_18px_50px_rgba(15,23,42,0.05)] backdrop-blur">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2A6FA3]">
              <Heart className="h-4 w-4 text-rose-400" />
              今日觉察
            </div>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              记录对话后的感受、行动后的感觉，或今天多看清的一点。
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {MOOD_OPTIONS.map((option) => {
            return (
              <button
                key={option.value}
                type="button"
                disabled={locked}
                onClick={() => onMoodChange(option.value)}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors ${
                  mood === option.value ? option.color : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                }`}
              >
                <span className="text-base leading-none">{option.emoji}</span>
                {option.label}
              </button>
            );
          })}
        </div>

        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={locked}
          rows={4}
          placeholder="今天我发现……"
          className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 outline-none focus:border-sky-300"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs leading-5 text-slate-400">
            {savedAt ? `已保存到行动力日历 · ${savedAt}` : '保存后会在行动力日历里点亮今日贴纸。'}
          </p>
          <Button
            type="button"
            disabled={locked || !value.trim()}
            onClick={onSave}
            className="rounded-full bg-[#86B8FF]/85 text-[#225F91] shadow-sm hover:bg-[#78AAEE]"
          >
            保存觉察
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PathActionCalendar({
  tasks,
  reflections,
  archives,
  selectedDate,
  onSelectDate,
  onOpenArchive,
}: {
  tasks: PathTask[];
  reflections: PathReflection[];
  archives: PathConversationArchive[];
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
  onOpenArchive: (archive: PathConversationArchive) => void;
}) {
  const today = new Date();
  const visibleDates = getMonthDates(today);
  const selectedTasks = getTasksForDate(tasks, selectedDate);
  const completedTasks = getCompletedTasksForDate(tasks, selectedDate);
  const selectedReflection = reflections.find((item) => item.dateKey === selectedDate);
  const selectedArchives = getArchivesForDate(archives, selectedDate);
  const selectedMood = selectedReflection ? MOOD_OPTIONS.find((item) => item.value === selectedReflection.mood) : null;
  const hasSelectedProgress = Boolean(selectedReflection || selectedArchives.length || completedTasks.length);

  return (
    <Card className="rounded-[1.6rem] border border-[#86B8FF]/18 bg-white/82 shadow-[0_18px_50px_rgba(15,23,42,0.05)] backdrop-blur">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2A6FA3]">
              <CalendarDays className="h-4 w-4 text-sky-500" />
              行动力日历
            </div>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              用图标记录任务完成、今日觉察和心情贴纸。
            </p>
          </div>
          <Badge variant="secondary" className="bg-[#86B8FF]/14 text-[#2A6FA3]">
            {today.getFullYear()} / {today.getMonth() + 1}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
            <div key={day} className="text-center text-[11px] font-semibold text-slate-400">
              {day}
            </div>
          ))}
          {visibleDates.map((date, index) => {
            const dateKey = date ? toDateKey(date) : `blank-${index}`;
            const dayTasks = date ? getTasksForDate(tasks, dateKey) : [];
            const dayCompleted = date ? getCompletedTasksForDate(tasks, dateKey) : [];
            const dayReflection = date ? reflections.find((item) => item.dateKey === dateKey) : null;
            const dayArchives = date ? getArchivesForDate(archives, dateKey) : [];
            const dayMood = dayReflection ? MOOD_OPTIONS.find((item) => item.value === dayReflection.mood) : null;
            const isSelected = dateKey === selectedDate;
            const hasSignals = dayTasks.length || dayCompleted.length || dayReflection || dayArchives.length;

            return (
              <button
                key={dateKey}
                type="button"
                disabled={!date}
                onClick={() => date && onSelectDate(dateKey)}
                className={`min-h-[72px] rounded-2xl border p-2 text-left transition-colors ${
                  !date
                    ? 'opacity-0'
                    : isSelected
                      ? 'border-[#86B8FF] bg-[#F3F8FF] shadow-[0_10px_24px_rgba(134,184,255,0.16)]'
                      : hasSignals
                        ? 'border-[#86B8FF]/22 bg-white/86'
                        : 'border-slate-200/60 bg-white/54'
                }`}
              >
                {date ? (
                  <>
                    <div className="text-xs font-bold text-[#2A6FA3]">{date.getDate()}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {dayCompleted.length ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-600" title="任务完成">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </span>
                      ) : dayTasks.length ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-[#86B8FF]/25 bg-[#86B8FF]/12 text-[#2A6FA3]" title="任务">
                          <ClipboardCheck className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                      {dayReflection ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-500" title="今日觉察">
                          <Heart className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                      {dayReflection ? (
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg border text-sm ${dayMood?.color || 'border-[#86B8FF]/20 bg-white text-[#2A6FA3]'}`} title="心情贴纸">
                          {dayMood?.emoji || '🙂'}
                        </span>
                      ) : null}
                      {dayArchives.length ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-[#86B8FF]/25 bg-white text-[#2A6FA3]" title="历史对话">
                          <FileText className="h-3.5 w-3.5" />
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl border border-[#86B8FF]/16 bg-[#F3F8FF]/60 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-400">{formatDateLabel(selectedDate)}</div>
              <div className="mt-1 text-sm font-bold text-[#2A6FA3]">
                {hasSelectedProgress ? '你离理想中的自己又近了一步！' : selectedTasks.length ? '已有待完成微行动' : '等待一点行动证据'}
              </div>
            </div>
            {selectedMood ? (
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border text-lg ${selectedMood.color}`}>
                {selectedMood.emoji}
              </span>
            ) : null}
          </div>
          {selectedReflection ? (
            <p className="mt-3 text-sm leading-7 text-slate-600">{selectedReflection.content}</p>
          ) : (
            <p className="mt-3 text-sm leading-7 text-slate-500">
              记录下你今天为了实现目标又做了哪些努力吧~
            </p>
          )}
          {selectedArchives.length ? (
            <div className="mt-3 space-y-2">
              {selectedArchives.map((archive) => (
                <button
                  key={archive.id}
                  type="button"
                  onClick={() => onOpenArchive(archive)}
                  className="flex w-full items-center justify-between rounded-2xl border border-[#86B8FF]/18 bg-white/78 px-3 py-2 text-left text-xs font-semibold text-[#2A6FA3] hover:bg-white"
                >
                  <span className="truncate">{archive.title}</span>
                  <span className="shrink-0 text-slate-400">{new Date(archive.archivedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ConversationArchiveModal({
  archive,
  onClose,
}: {
  archive: PathConversationArchive | null;
  onClose: () => void;
}) {
  if (!archive) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/42 px-4 py-6 backdrop-blur-sm">
      <div className="flex max-h-[86vh] w-full max-w-2xl flex-col rounded-[1.5rem] border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2A6FA3]">
              <FileText className="h-4 w-4 text-sky-500" />
              历史对话
            </div>
            <h2 className="mt-2 truncate text-lg font-bold text-[#2A6FA3]">{archive.title}</h2>
            <p className="mt-1 text-xs text-slate-400">
              {new Date(archive.archivedAt).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          <button
            type="button"
            aria-label="关闭历史对话"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {archive.messages.map((message, index) => (
            <div key={`${archive.id}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[92%] rounded-2xl border px-4 py-3 text-sm leading-7 ${
                message.role === 'user'
                  ? 'border-[#86B8FF]/16 bg-[#86B8FF]/12 text-slate-700'
                  : 'border-slate-200/70 bg-slate-50/80 text-slate-700'
              }`}
              >
                <CoachMessageContent content={message.content} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CoachMessageContent({ content }: { content: string }) {
  const match = content.match(/^(.*?天赋能力有)(.*?)(，可能适合的职业方向有)(.*?)(。这里面[\s\S]*)$/);
  if (!match) return <FormattedCoachText content={content} />;

  const [, beforeSkills, skills, beforeRoles, roles, afterRoles] = match;
  return (
    <>
      {beforeSkills}
      <span className="rounded-lg bg-[#86B8FF]/18 px-1.5 py-0.5 font-semibold text-[#2A6FA3]">
        {skills}
      </span>
      {beforeRoles}
      <span className="rounded-lg bg-[#86B8FF]/18 px-1.5 py-0.5 font-semibold text-[#2A6FA3]">
        {roles}
      </span>
      {afterRoles}
    </>
  );
}

function CoachTypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-2xl border border-[#86B8FF]/10 bg-white/65 px-4 py-3 text-sm leading-7 text-slate-400 shadow-sm">
        <div className="flex items-center gap-1.5" aria-label="现实路径教练正在生成回复">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#86B8FF]/70" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#86B8FF]/55 [animation-delay:120ms]" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#86B8FF]/40 [animation-delay:240ms]" />
        </div>
      </div>
    </div>
  );
}

function FormattedCoachText({ content }: { content: string }) {
  const blocks = buildCoachBlocks(content);

  if (blocks.length === 0) return null;

  return (
    <div className="space-y-3.5 text-sm leading-7 text-inherit">
      {blocks.map((block, index) => {
        if (block.kind === 'list') {
          return (
            <div key={`${block.intro}-${index}`} className="space-y-2">
              {block.intro ? (
                <p className="break-words leading-6">
                  <HighlightedInlineText text={block.intro} />
                </p>
              ) : null}
              <ul className="space-y-2">
                {block.items.map((item, itemIndex) => (
                  <li key={`${item}-${itemIndex}`} className="grid grid-cols-[18px_minmax(0,1fr)] items-start gap-2 leading-7 text-inherit">
                    <span className="pt-[0.08rem] text-center text-[20px] font-semibold leading-7 text-[#8ABBE5]">•</span>
                    <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                      <HighlightedInlineText text={item} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        return (
          <p key={`${block.text}-${index}`} className="break-words leading-6 [overflow-wrap:anywhere]">
            <HighlightedInlineText text={block.text} />
          </p>
        );
      })}
    </div>
  );
}

type CoachTextBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; intro: string; items: string[] };

function buildCoachBlocks(content: string): CoachTextBlock[] {
  return cleanCoachText(content)
    .replace(/\n{3,}/g, '\n\n')
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((paragraph) => {
      const bulletBlock = parseBulletBlock(paragraph);
      if (bulletBlock.items.length > 0) {
        return splitBulletBlockByTrailingText(bulletBlock);
      }
      return splitParagraphIntoBlocks(normalizeQuestionOptions(paragraph));
    });
}

function splitParagraphIntoBlocks(text: string): CoachTextBlock[] {
  const withSemanticBreaks = text
    .replace(/([。！？；])\s*(?=(接下来可以|接下来我|验证入口|观察清单|能力记录|这条经验|这类经历|这些都可能是|这类素材|从准备度看|目前可以先判断|如果继续看|你可以|你愿意|你想|我建议|先看|再看))/g, '$1\n\n')
    .replace(/([：])\s*(?=(比如：|例如：))/g, '$1\n\n')
    .replace(/([：；])\s*[,，]+/g, '$1');

  return withSemanticBreaks
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap(splitLongParagraphPiece)
    .map((item) => ({ kind: 'paragraph', text: item } as CoachTextBlock));
}

function splitLongParagraphPiece(text: string) {
  if (text.length <= 150) return [text];
  const sentences = text
    .match(/[^。！？；]+[。！？；]?/g)
    ?.map((item) => item.trim())
    .filter(Boolean);
  if (!sentences || sentences.length < 2) return [text];

  const chunks: string[] = [];
  let current = '';
  sentences.forEach((sentence) => {
    const next = `${current}${sentence}`;
    if (current && next.length > 130) {
      chunks.push(current);
      current = sentence;
    } else {
      current = next;
    }
  });
  if (current) chunks.push(current);
  return chunks;
}

function cleanCoachText(content: string) {
  const cleaned = content
    .replace(/\r/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '“$1”')
    .replace(/\*\*([^*]+)\*\*/g, '@@HL_OPEN@@$1@@HL_CLOSE@@')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|\n)\s{0,3}#{1,6}\s*/g, '$1')
    .replace(/(^|\n)\s{0,3}>\s?/g, '$1')
    .replace(/(^|\n)\s*[-*+]\s+/g, '$1• ')
    .replace(/(^|\n)\s*\d+[.)]\s+/g, '$1• ')
    .replace(/'([^'\n]{1,60})'/g, '“$1”')
    .replace(/“([^”\n]{2,40})”/g, '@@HL_OPEN@@“$1”@@HL_CLOSE@@')
    .replace(/(?:NPS|DAU|MAU|转化率|完成率|解决率)\s*[+＋-]?\s*\d+(?:\.\d+)?%?/gi, '@@HL_OPEN@@$&@@HL_CLOSE@@')
    // 行内的短横线、圆点只是模型生成的分隔符，不应渲染成伪列表。
    // 只处理水平空格包围的分隔符，保留真正换行后的圆点列表。
    .replace(/[ \t]+[-•·][ \t]+/g, '，')
    .replace(/(?:真实工作日常|核心工作|工作内容|岗位职责)：\s*这些事[：:]?/g, (match) => match.replace('这些事', '').replace('：：', '：'))
    .trim();
  return insertSemanticBreaks(cleaned);
}

function HighlightedInlineText({ text }: { text: string }) {
  const parts = segmentCoachText(text);
  return (
    <>
      {parts.map((part, index) => {
        if (part.kind === 'highlight') {
          const { leading, core, trailing } = splitHighlightPunctuation(part.text);
          return (
            <span key={`${part.text}-${index}`}>
              {leading}
              <span className="rounded-md bg-[#86B8FF]/14 px-0.5 py-px font-semibold text-[#2A6FA3]">{core}</span>
              {trailing}
            </span>
          );
        }
        if (part.kind === 'slash') {
          return (
            <span key={`${part.text}-${index}`} className="px-1 text-[0.95em] font-semibold text-[#2A6FA3]">
              /
            </span>
          );
        }
        return <span key={`${part.text}-${index}`}>{part.text}</span>;
      })}
    </>
  );
}

function parseBulletBlock(paragraph: string) {
  const normalized = paragraph
    .replace(/\s*([•●▪◦▸]\s*)/g, '\n$1')
    .replace(/([：；。])\s*(\d+[.)]\s*)/g, '$1\n$2');

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const bulletRegex = /^(?:[•●▪◦▸]|\d+[.)])/;
  const firstBulletIndex = lines.findIndex((line) => bulletRegex.test(line));
  if (firstBulletIndex === -1) {
    return { intro: '', items: [] as string[] };
  }

  const intro = lines
    .slice(0, firstBulletIndex)
    .join(' ')
    .trim();
  const items = lines
    .slice(firstBulletIndex)
    .map((line) => line.replace(/^(?:[•●▪◦▸]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);

  if (isQuestionOptionBlock(intro, items)) {
    return { intro: '', items: [] as string[] };
  }

  if (!isSemanticListIntro(intro) && items.length < 2) {
    return { intro: '', items: [] as string[] };
  }

  return { intro, items };
}

function splitBulletBlockByTrailingText(block: { intro: string; items: string[] }): CoachTextBlock[] {
  const listItems: string[] = [];
  const trailingTexts: string[] = [];

  block.items.forEach((item) => {
    const split = splitTrailingSemanticShift(item);
    if (split.before) listItems.push(split.before);
    if (split.after) trailingTexts.push(split.after);
  });

  const blocks: CoachTextBlock[] = [];
  let listIntro = block.intro;
  if (block.intro) {
    const introBlocks = splitParagraphIntoBlocks(normalizeQuestionOptions(block.intro));
    const lastIntroBlock = introBlocks[introBlocks.length - 1];
    if (lastIntroBlock?.kind === 'paragraph' && /[：]$/.test(lastIntroBlock.text)) {
      blocks.push(...introBlocks.slice(0, -1));
      listIntro = lastIntroBlock.text;
    } else {
      blocks.push(...introBlocks);
      listIntro = '';
    }
  }

  if (listItems.length > 0) {
    blocks.push({ kind: 'list', intro: listIntro, items: listItems });
  }

  trailingTexts.forEach((text) => {
    blocks.push(...splitParagraphIntoBlocks(normalizeQuestionOptions(text)));
  });

  return blocks;
}

function splitTrailingSemanticShift(text: string) {
  const trimmed = text.trim();
  const sentences = trimmed.match(/[^。！？；]+[。！？；]?/g)?.map((item) => item.trim()).filter(Boolean) || [];
  if (sentences.length < 2) return { before: trimmed, after: '' };

  // 列表项可能同时包含“岗位工作内容”和“用户能力映射/追问”。
  // 按语义角色寻找切换点，而不是为某一句具体文案添加例外。
  const semanticShiftStart = /^(?:你(?:提到|刚才(?:提到|说)|做过|已经|在经历中)|从你(?:刚才|的经历|的描述)|这(?:说明|意味着|项经历|条经历|些经验)|放到(?:这个|目标)岗位|在(?:这个|目标)岗位(?:里|中)|对应(?:到|的是)?目标岗位|因此|所以|接下来|下一步|如果你|你想|你最想|你对这个岗位|你为什么对|看一条真实|或者|或直接|可以只说|我来帮你)/;
  const shiftIndex = sentences.findIndex((sentence, index) => index > 0 && semanticShiftStart.test(sentence));
  if (shiftIndex === -1) return { before: trimmed, after: '' };

  return {
    before: sentences.slice(0, shiftIndex).join('').trim(),
    after: sentences.slice(shiftIndex).join('').trim(),
  };
}

function isQuestionOptionBlock(intro: string, items: string[]) {
  const text = `${intro}${items.join('')}`;
  if (isFollowUpQuestion(text)) return true;
  const questionLikeItems = items.filter((item) => /[？?]/.test(item)).length;
  return items.length > 0 && questionLikeItems >= Math.max(1, items.length - 1);
}

function isFollowUpQuestion(text: string) {
  return /你对这个岗位|你为什么对|你更想先看清|你想先看|你想先了解|你最想先了解|我可以帮你拆|哪一类任务|哪些数据看板|建议文档|协作节奏|还是它和|还是想聊聊/.test(text);
}

function isSemanticListIntro(text: string) {
  return /常见岗位名称|真实工作日常|常见的岗位需求|职位要求|能力要求|还需要验证|待验证点|还需要补齐|候选方向|相邻岗位|真实岗位|现实验证点|核心工作|工作内容|典型一天|一天可能包括|日常任务|流程示例|协作对象|公司类型差异|聚焦于/.test(text);
}

function normalizeQuestionOptions(text: string) {
  if (!isFollowUpQuestion(text)) return text;
  return text
    .replace(/[ \t]*[-•●▪◦▸·][ \t]*/g, '，')
    .replace(/比如：，/g, '比如：')
    .replace(/，([，。！？；：])/g, '$1');
}

type CoachSegment = {
  text: string;
  kind: 'text' | 'highlight' | 'slash';
};

function segmentCoachText(text: string): CoachSegment[] {
  const tokenPattern = /(@@HL_OPEN@@.*?@@HL_CLOSE@@|可能的贴合点：|还需要看清：|你和这些要求的连接点：|下一步只观察：|微行动：|常见岗位名称：|核心工作常包含：|核心工作包括：|真实工作日常：|常见的岗位需求：|还需要补齐的证据：|待验证点：|真实岗位摘录：|岗位链接：|薪资粗略范围：|还需要验证：)/g;
  const baseParts = text.split(tokenPattern).filter(Boolean);
  const segments: CoachSegment[] = [];

  for (const part of baseParts) {
    if (
      /^@@HL_OPEN@@.*@@HL_CLOSE@@$/.test(part) ||
      /^(可能的贴合点：|还需要看清：|你和这些要求的连接点：|下一步只观察：|微行动：|常见岗位名称：|核心工作常包含：|核心工作包括：|真实工作日常：|常见的岗位需求：|还需要补齐的证据：|待验证点：|真实岗位摘录：|岗位链接：|薪资粗略范围：|还需要验证：)$/.test(part)
    ) {
      segments.push({
        text: part
          .replace(/^@@HL_OPEN@@|@@HL_CLOSE@@$/g, ''),
        kind: 'highlight',
      });
      continue;
    }

    const slashParts = part.split(/(\s\/\s|\/)/g).filter(Boolean);
    for (const slashPart of slashParts) {
      if (/^\s\/\s$|^\/$/.test(slashPart)) {
        segments.push({ text: '/', kind: 'slash' });
      } else {
        segments.push({ text: slashPart, kind: 'text' });
      }
    }
  }

  return segments.filter((segment) => segment.text.trim().length > 0 || segment.kind === 'slash');
}

function splitHighlightPunctuation(text: string) {
  // 高亮只包住语义核心，所有中文标点（包括并列顿号）原样留在外围。
  const match = text.match(/^([\s，。；：、！？…（）《》“”‘’「」,.!?;:()[\]{}]*)([\s\S]*?)([\s，。；：、！？…（）《》“”‘’「」,.!?;:()[\]{}]*)$/);
  if (!match || !match[2]) return { leading: '', core: text, trailing: '' };
  return { leading: match[1], core: match[2], trailing: match[3] };
}

type PathStep = 1 | 2 | 3;

/** Step 2 需求对照面板：主线岗位需求逐项对照已有证据（教练输出 [[REQUIREMENT]] 标记后落位） */
function RequirementFocusPanel({ brief }: { brief: SelectedPathBrief }) {
  const checks = brief.requirementChecks;
  const checkedCount = checks.filter((check) => check.status === 'checked').length;
  const willingnessLabel =
    brief.willingness === 'want'
      ? '想做'
      : brief.willingness === 'unsure'
        ? '观望'
        : brief.willingness === 'no'
          ? '不想做 · 回 Step 1 换路径'
          : null;
  return (
    <Card className="rounded-[1.6rem] border border-[#86B8FF]/26 bg-[linear-gradient(180deg,rgba(243,248,255,0.96)_0%,rgba(255,255,255,0.86)_100%)] shadow-[0_18px_50px_rgba(134,184,255,0.15)] backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base font-semibold text-[#2A6FA3]">
          <Target className="h-4 w-4" />
          Step 2 · 信息聚焦
          <span className="rounded-full bg-[#F3F8FF] px-2 py-0.5 text-[11px] font-semibold text-[#4A789C]">
            主线：{brief.pathTitle}
          </span>
          {checks.length ? (
            <span className="ml-auto text-[11px] font-medium text-[#7A97B5]">
              已有证据 {checkedCount}/{checks.length}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {checks.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#86B8FF]/40 bg-white/60 px-4 py-3 text-xs leading-6 text-[#7A97B5]">
            教练正在提炼这条路径最看重的岗位需求，逐项对照会出现在这里——已经证实过的能力会直接对上，不用重新讲一遍经历。
          </p>
        ) : (
          checks.map((check) => {
            const statusMeta = REQUIREMENT_STATUS_META[check.status];
            return (
              <div key={check.requirement} className="rounded-2xl border border-[#86B8FF]/20 bg-white/75 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[#2A6FA3]">{check.requirement}</span>
                  <span className={`ml-auto shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusMeta.className}`}>
                    {statusMeta.label}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-6 text-[#4A789C]">
                  {check.evidenceSummary || '还没有这方面的证据线索——想到相关经历时随时告诉教练。'}
                </p>
              </div>
            );
          })
        )}
        {brief.valueNotes.length ? (
          <div className="rounded-2xl border border-[#D8E8DC] bg-[#F2F8F3]/70 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5E8A70]">价值观对照小结</div>
            <ul className="mt-1 space-y-1">
              {brief.valueNotes.map((note) => (
                <li key={note} className="text-xs leading-6 text-[#4A789C]">· {note}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {willingnessLabel ? (
          <div className="text-right text-[11px] font-medium text-[#7A97B5]">意愿状态：{willingnessLabel}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Step 3 准备度卡：综合准备度 + 已具备 / 仍需验证 / 下一步（教练输出 [[READINESS]] 标记后落位） */
function ReadinessPanel({ readiness }: { readiness: ReadinessSummary }) {
  const columns: Array<{ title: string; items: string[]; className: string; text: string }> = [
    { title: '已具备', items: readiness.have, className: 'border-[#D8E8DC] bg-[#F2F8F3]/70', text: 'text-[#5E8A70]' },
    { title: '仍需验证', items: readiness.verify, className: 'border-[#D5E6F5] bg-[#F3F8FF]/70', text: 'text-[#4A789C]' },
    { title: '下一步', items: readiness.next, className: 'border-[#E8E2D5] bg-[#FAF7F0]/80', text: 'text-[#8A7A5E]' },
  ];
  return (
    <Card className="rounded-[1.6rem] border border-[#86B8FF]/26 bg-[linear-gradient(180deg,rgba(243,248,255,0.96)_0%,rgba(255,255,255,0.86)_100%)] shadow-[0_18px_50px_rgba(134,184,255,0.15)] backdrop-blur">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base font-semibold text-[#2A6FA3]">
          <ClipboardCheck className="h-4 w-4" />
          Step 3 · 行动收束
          <span className="ml-auto flex items-baseline gap-1">
            <span className="text-2xl font-bold text-[#2A6FA3]">{readiness.score}</span>
            <span className="text-xs font-medium text-[#7A97B5]">/100 准备度</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 md:grid-cols-3">
          {columns.map((column) => (
            <div key={column.title} className={`rounded-2xl border px-4 py-3 ${column.className}`}>
              <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${column.text}`}>{column.title}</div>
              {column.items.length ? (
                <ul className="mt-1.5 space-y-1.5">
                  {column.items.map((item) => (
                    <li key={item} className="text-xs leading-6 text-[#4A789C]">· {item}</li>
                  ))}
                </ul>
              ) : (
                <div className="mt-1.5 text-xs leading-6 text-[#A9BDD1]">暂无</div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-5 text-[#A9BDD1]">
          分数只来自你已确认的证据——它衡量的是"现在能拿出什么"，不是"你这个人行不行"。
        </p>
      </CardContent>
    </Card>
  );
}

const PATH_STEP_META: Record<PathStep, { label: string; subtitle: string }> = {
  1: { label: '路径积木', subtitle: '拆理想职业，碰撞现实可能路径' },
  2: { label: '信息聚焦', subtitle: '选定路径拆解：能力 / 意愿 / 价值观' },
  3: { label: '行动收束', subtitle: '综合准备度 + 剩下 30% 最小行动' },
};

function PathStepIndicator({
  currentStep,
  completedSteps,
  displayedStep,
  onSelect,
}: {
  currentStep: PathStep;
  completedSteps: PathStep[];
  displayedStep: PathStep;
  onSelect: (step: PathStep) => void;
}) {
  const steps: PathStep[] = [1, 2, 3];
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-0">
      {steps.map((step, idx) => {
        const isCurrent = step === currentStep;
        const isCompleted = completedSteps.includes(step);
        const isDisplayed = step === displayedStep;
        const isClickable = isCurrent || isCompleted;
        const meta = PATH_STEP_META[step];
        const stateLabel = isCurrent ? '进行中' : isCompleted ? '已完成' : '未解锁';
        return (
          <div key={step} className="flex flex-1 items-center md:gap-0">
            <button
              type="button"
              onClick={() => onSelect(step)}
              disabled={!isClickable}
              aria-current={isDisplayed ? 'step' : undefined}
              className={`group flex flex-1 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                isDisplayed
                  ? 'border-[#86B8FF]/60 bg-[linear-gradient(180deg,rgba(243,248,255,0.98)_0%,rgba(255,255,255,0.9)_100%)] shadow-[0_12px_30px_rgba(134,184,255,0.18)]'
                  : isClickable
                    ? 'border-[#86B8FF]/22 bg-white/70 hover:border-[#86B8FF]/40 hover:bg-white/85'
                    : 'cursor-not-allowed border-slate-200/70 bg-slate-50/50 opacity-60'
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  isCompleted
                    ? 'bg-emerald-500 text-white'
                    : isCurrent
                      ? 'bg-[#2A6FA3] text-white'
                      : 'bg-slate-200 text-slate-500'
                }`}
                aria-hidden
              >
                {isCompleted ? '✓' : step}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-800">
                  Step {step} · {meta.label}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">{meta.subtitle}</span>
              </span>
              <span
                className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  isCurrent
                    ? 'bg-[#2A6FA3]/10 text-[#2A6FA3]'
                    : isCompleted
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200/70 text-slate-500'
                }`}
              >
                {stateLabel}
              </span>
            </button>
            {idx < steps.length - 1 ? (
              <div
                aria-hidden
                className={`mx-1 hidden h-px w-6 shrink-0 md:block ${
                  isCompleted || isCurrent ? 'bg-[#86B8FF]/60' : 'bg-slate-200'
                }`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function PathStepContent({ step, children }: { step: PathStep; children: React.ReactNode }) {
  return (
    <div data-path-step={step} className="space-y-6">
      {children}
    </div>
  );
}

export default function PathPage() {
  const router = useRouter();
  const [report, setReport] = useState<CareerReport | null>(null);
  const [preview, setPreview] = useState<PathMapPreview | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockedNoticeOpen, setLockedNoticeOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [draftToken, setDraftToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<PathMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isCoachTyping, setIsCoachTyping] = useState(false);
  const [tasks, setTasks] = useState<PathTask[]>([]);
  const [reflections, setReflections] = useState<PathReflection[]>([]);
  const [conversationArchives, setConversationArchives] = useState<PathConversationArchive[]>([]);
  const [openArchive, setOpenArchive] = useState<PathConversationArchive | null>(null);
  const [reflectionText, setReflectionText] = useState('');
  const [reflectionMood, setReflectionMood] = useState<PathMood>('steady');
  const [reflectionSavedAt, setReflectionSavedAt] = useState<string | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toDateKey(new Date()));
  const [boardSummary, setBoardSummary] = useState<PathBoardSummary | null>(null);
  const [pendingBoardSummary, setPendingBoardSummary] = useState<PathBoardSummary | null>(null);
  const [evidenceCards, setEvidenceCards] = useState<EvidenceCard[]>([]);
  const [realityConstraints, setRealityConstraints] = useState<RealityConstraints>(EMPTY_CONSTRAINTS);
  const [archiveUpdatedAt, setArchiveUpdatedAt] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedExplorationRole, setSelectedExplorationRole] = useState('');
  const [explorationChecksByRole, setExplorationChecksByRole] = useState<Record<string, CareerExplorationCheckId[]>>({});
  // Phase A: 横向步骤条 + 当前 Step 主区域
  const [currentStep, setCurrentStep] = useState<PathStep>(1);
  const [completedSteps, setCompletedSteps] = useState<PathStep[]>([]);
  const [viewingStep, setViewingStep] = useState<PathStep | null>(null); // null = 看当前 step
  const displayedStep: PathStep = viewingStep ?? currentStep;
  // 测试模式（仅开发环境）：加载预置画像，跳过天赋教练环节
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [activeTestPersona, setActiveTestPersona] = useState<PathTestPersona | null>(null);
  // 演示对话播放（测试模式）：自动流入预置脚本，验证证据卡解析与确认联动
  const [demoPlaying, setDemoPlaying] = useState(false);
  const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 现实路径对话埋点序号（同一场对话内递增，供后台按顺序还原）
  const pathAnalyticsSequenceRef = useRef(0);
  // 积木②交付形态：演示对话确认后同步（真实用户后续由教练确认流写入）
  const [confirmedDeliveryFormat, setConfirmedDeliveryFormat] = useState<DeliveryFormat | null>(null);
  // Step 2/3：选定主线快照与准备度（会话内状态，与证据卡一致不持久化）
  const [selectedBrief, setSelectedBrief] = useState<SelectedPathBrief | null>(null);
  const [readiness, setReadiness] = useState<ReadinessSummary | null>(null);
  const isDevEnvironment = process.env.NODE_ENV !== 'production';
  const showTestEntry = isDevEnvironment;
  const [visiblePanels, setVisiblePanels] = useState<PanelId[]>(DEFAULT_VISIBLE_PANELS);
  const [expandedPanels, setExpandedPanels] = useState<Record<PanelId, boolean>>({
    overview: true,
    tasks: true,
    reflection: false,
    calendar: false,
    modules: false,
    exploration: false,
    profile: false,
    updates: false,
  });
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);

  // 测试模式：加载预置画像，跳过天赋教练环节
  const loadTestPersona = (persona: PathTestPersona) => {
    setActiveTestPersona(persona);
    setReport(persona.report);
    setLocked(false);
    // 交付形态尚未确认，Step 1 路径积木是当前主线
    setCurrentStep(1);
    setCompletedSteps([]);
    setViewingStep(null);
    // 种子数据：画像自带的能力证据卡与现实约束（pending 卡挂在开场白上，可直接确认）
    setEvidenceCards(persona.evidenceCards);
    setRealityConstraints(persona.realityConstraints);
    setConfirmedDeliveryFormat(null);
    setSelectedBrief(null);
    setReadiness(null);
    stopDemoConversation();
    setMessages([
      {
        role: 'assistant',
        content: `你好，${persona.name}。我已经读完你的天赋报告。你之前在思考"${persona.idealRoles.join('、')}"。我们先把理想职业拆成三块积木：天赋动作、交付形态、利基主题——左侧的象限图里已经放了几个现实组合，你可以点开看看。积木①和③报告里已经有初步判断，我们先聊积木②交付形态：比起工位和打卡，你更能接受哪种"钱从哪里来"的方式？`,
        evidenceCards: persona.evidenceCards.filter((card) => card.status === 'pending'),
      },
    ]);
    const nextPreview = buildPathMapPreview(persona.report, []);
    setPreview(nextPreview);
    const initialBoard = buildInitialBoardSummary(persona.report, nextPreview);
    setBoardSummary(initialBoard);
  };

  const exitTestMode = () => {
    setTestModeEnabled(false);
    setActiveTestPersona(null);
    stopDemoConversation();
    window.location.reload();
  };

  useEffect(() => () => stopDemoConversation(), []);

  useEffect(() => {
    const load = async () => {
      // 真实用户模式：证据卡与现实约束从空开始，由教练对话逐步生成
      setEvidenceCards([]);
      setRealityConstraints(EMPTY_CONSTRAINTS);
      try {
        const savedVisiblePanels = JSON.parse(window.localStorage.getItem(PATH_VISIBLE_PANELS_KEY) || '[]') as PanelId[];
        // 过滤掉现实教练阶段隐藏的面板（历史存储里可能有 overview/tasks/reflection）
        const validVisiblePanels = savedVisiblePanels.filter(
          (panelId) => ALL_PANEL_IDS.includes(panelId) && !HIDDEN_PANEL_IDS.includes(panelId)
        );
        setVisiblePanels(validVisiblePanels);
      } catch {
        setVisiblePanels(DEFAULT_VISIBLE_PANELS);
      }
      const savedReport = window.localStorage.getItem(REPORT_STORAGE_KEY);
      const parsedReport = savedReport ? (JSON.parse(savedReport) as CareerReport) : null;
      const activeSample = readActiveCareerSample()?.report || null;
      const params = new URLSearchParams(window.location.search);
      const demoCaseId = params.get('demo');
      const demoCase = demoCaseId ? getDemoCaseById(demoCaseId) : null;
      const demoActive = isDemoModeActive() ? getDemoCaseById(window.localStorage.getItem('career_demo_case_v1')) : null;
      const resolved = parsedReport || activeSample || demoCase?.report || demoActive?.report || null;

      if (!resolved) {
        setLocked(true);
        setLockedNoticeOpen(true);
        setMessages([
          {
            role: 'assistant',
            content:
              '这里还没解锁。先去做一次天赋教练对话，把你的报告和基础资料生成出来，现实路径地图才会打开。',
          },
        ]);
        return;
      }

      setLocked(false);
      setReport(resolved);
      void trackEvent({ eventName: 'path_opened', page: '/path', status: 'success', metadata: { hasReport: true } });
      setTasks(readPathTasks());
      setExplorationChecksByRole(readCareerExplorationChecks());
      setConversationArchives(readConversationArchives());
      const savedReflections = readPathReflections();
      setReflections(savedReflections);
      const todayReflection = savedReflections.find((item) => item.dateKey === toDateKey(new Date())) || null;
      if (todayReflection) {
        setReflectionText(todayReflection.content);
        setReflectionMood(todayReflection.mood);
        setReflectionSavedAt(new Date(todayReflection.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
      }
      let pathSourceMessages: StoredCareerSampleMessage[] = [];
      try {
        const savedMessages = JSON.parse(window.localStorage.getItem(CHAT_STORAGE_KEY) || '[]');
        if (Array.isArray(savedMessages)) pathSourceMessages = savedMessages;
      } catch {
        pathSourceMessages = [];
      }
      const nextPreview = buildPathMapPreview(resolved, pathSourceMessages);
      const savedBoard = window.localStorage.getItem(PATH_BOARD_SUMMARY_KEY);
      const initialBoard = buildInitialBoardSummary(resolved, nextPreview);
      setPreview(nextPreview);
      if (savedBoard) {
        try {
          setBoardSummary(normalizeBoardSummary(JSON.parse(savedBoard) as Partial<PathBoardSummary>, initialBoard));
        } catch {
          setBoardSummary(initialBoard);
        }
      } else {
        setBoardSummary(initialBoard);
      }
      const savedDraftToken = window.localStorage.getItem(CAREER_DRAFT_TOKEN_KEY) || null;
      setDraftToken(savedDraftToken);
      setMessages([{ role: 'assistant', content: buildCoachIntro(resolved, nextPreview) }]);

      // Default to the protected state so an unavailable auth request never exposes
      // the persistent career workspace to an anonymous visitor.
      setShowAuth(true);
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        setShowAuth(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    const scrollToBottom = () => {
      const el = messagesScrollRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    };
    queueMicrotask(() => {
      requestAnimationFrame(scrollToBottom);
      window.setTimeout(scrollToBottom, 120);
    });
  }, [messages]);

  const topRoles = useMemo(() => pickTopItems(preview?.direction_clusters.flatMap((item) => item.sample_roles) || extractPotentialRoles(report || ({} as CareerReport)), 3), [preview, report]);
  const currentExplorationRole = selectedExplorationRole || topRoles[0] || boardSummary?.leastResistancePath || '待探索岗位';
  const currentExplorationChecks = explorationChecksByRole[currentExplorationRole] || [];
  const canSuggestBoardUpdate = hasEnoughEvidenceForPathUpdate(messages, currentExplorationChecks);
  const allPanelModules: Array<{ id: PanelId; label: string; description: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'overview', label: '路径总览', description: '当前方向与下一步', icon: Compass },
    { id: 'tasks', label: '任务列表', description: '已确认的行动安排', icon: ClipboardCheck },
    { id: 'reflection', label: '今日觉察', description: '记录感受与发现', icon: Heart },
    { id: 'calendar', label: '行动日历', description: '回看行动与记录', icon: CalendarDays },
    { id: 'modules', label: '资源与资料', description: '整理能力、经验和资源', icon: LayoutGrid },
    { id: 'exploration', label: '探索入口', description: '选择想了解的现实角度', icon: BriefcaseBusiness },
    { id: 'profile', label: '资料概览', description: '查看当前主线资料', icon: Target },
    { id: 'updates', label: '资料更新', description: '确认新的整理结果', icon: FilePenLine },
  ];
  const panelModules = allPanelModules.filter((panel) => !HIDDEN_PANEL_IDS.includes(panel.id));

  useEffect(() => {
    if (!selectedExplorationRole && topRoles[0]) {
      setSelectedExplorationRole(topRoles[0]);
    }
  }, [selectedExplorationRole, topRoles]);

  const togglePanel = (id: PanelId) => {
    setExpandedPanels((current) => ({ ...current, [id]: !current[id] }));
  };

  const setPanelVisibility = (panelId: PanelId, visible: boolean) => {
    setVisiblePanels((current) => {
      const next = visible
        ? Array.from(new Set([...current, panelId]))
        : current.filter((item) => item !== panelId);
      window.localStorage.setItem(PATH_VISIBLE_PANELS_KEY, JSON.stringify(next));
      return next;
    });
    if (visible) {
      setExpandedPanels((current) => ({ ...current, [panelId]: true }));
    }
  };

  const restoreRecommendedPanels = () => {
    setVisiblePanels(DEFAULT_VISIBLE_PANELS);
    window.localStorage.setItem(PATH_VISIBLE_PANELS_KEY, JSON.stringify(DEFAULT_VISIBLE_PANELS));
    setExpandedPanels((current) => ({ ...current, overview: true, tasks: true, reflection: true }));
  };

  const toggleCareerExplorationCheck = (id: CareerExplorationCheckId) => {
    const role = currentExplorationRole;
    const currentChecks = explorationChecksByRole[role] || [];
    const nextChecks = currentChecks.includes(id)
      ? currentChecks.filter((item) => item !== id)
      : [...currentChecks, id];
    const next = { ...explorationChecksByRole, [role]: nextChecks };
    setExplorationChecksByRole(next);
    saveCareerExplorationChecks(next);
    void trackEvent({ eventName: 'capability_confirmed', page: '/path', status: nextChecks.includes(id) ? 'confirmed' : 'unconfirmed', metadata: { roleName: role, capability: id } });
  };

  const handleSelectExplorationRole = (role: string) => {
    setSelectedExplorationRole(role);
    void trackEvent({ eventName: 'role_selected', page: '/path', status: 'success', metadata: { roleName: role } });
  };

  const closeMenuAndGo = (href: string) => {
    setMenuOpen(false);
    if (href.startsWith('#')) {
      const panelId = href.slice(1) as PanelId | 'coach';
      if (panelId === 'overview' || panelId === 'tasks' || panelId === 'reflection' || panelId === 'calendar' || panelId === 'modules' || panelId === 'exploration' || panelId === 'profile' || panelId === 'updates') {
        setPanelVisibility(panelId, true);
        setExpandedPanels((current) => ({ ...current, [panelId]: true }));
      }
      window.setTimeout(() => {
        document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
      return;
    }
    router.push(href);
  };

  // 现实路径页访问埋点：每次进入记录一次（访客去重在统计侧完成）
  useEffect(() => {
    void trackEvent({
      eventName: 'path_opened',
      page: '/path',
      status: 'success',
      metadata: {
        testMode: Boolean(activeTestPersona),
        entry: typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('from') || 'direct' : 'direct',
      },
    });
    // 仅在首次挂载时记录
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 证据卡三出口确认：同步更新总览面板与对话内卡片副本
  const updateEvidenceCardStatus = (cardId: string, status: EvidenceCard['status'], userAmendment?: string) => {
    const applyUpdate = (card: EvidenceCard): EvidenceCard => ({
      ...card,
      status,
      userAmendment: userAmendment ?? (status === 'confirmed' || status === 'rejected' ? undefined : card.userAmendment),
    });
    setEvidenceCards((prev) => prev.map((card) => (card.id === cardId ? applyUpdate(card) : card)));
    setMessages((prev) => prev.map((message) => {
      if (!message.evidenceCards?.some((card) => card.id === cardId)) return message;
      return {
        ...message,
        evidenceCards: message.evidenceCards.map((card) => (card.id === cardId ? applyUpdate(card) : card)),
      };
    }));
    const card = evidenceCards.find((item) => item.id === cardId);
    void trackEvent({
      eventName: 'path_evidence_confirmed',
      page: '/path',
      status,
      metadata: {
        capability: card?.capability || null,
        hasArtifact: Boolean(card?.artifact),
        pathTitle: selectedBrief?.pathTitle || null,
        testMode: Boolean(activeTestPersona),
      },
    });
  };

  // 当前积木快照：报告提取看家本领（1-3 个）+ 画像行业赛道作利基 + 演示确认的交付形态覆盖
  // 注意：利基主题只接受市场/行业/赛道语言（nicheThemes），direction_clusters 是岗位职能语言，不混入
  const currentLegoProfile = () => {
    if (!report) return null;
    let niches: string[] = [];
    if (activeTestPersona) {
      niches = activeTestPersona.nicheThemes?.length
        ? activeTestPersona.nicheThemes
        : [activeTestPersona.nicheTheme];
    }
    const profile = buildLegoProfileFromReport(report, niches);
    if (!profile) return null;
    if (confirmedDeliveryFormat) profile.deliveryFormat = confirmedDeliveryFormat;
    return profile;
  };

  // Step 2 解锁门槛（完成度门槛）：积木②确认 + 积木③确认 + 已证实证据卡 ≥2
  const activeLegoProfile = currentLegoProfile();
  const step2Unlocked = isStep2Unlocked(activeLegoProfile, evidenceCards);

  // Step 条解锁联动：完成度门槛满足后自动推进（Step 1 → 2）
  useEffect(() => {
    if (locked) return;
    if (step2Unlocked && currentStep === 1) {
      setCompletedSteps((prev) => (prev.includes(1) ? prev : ([...prev, 1] as PathStep[])));
      setCurrentStep(2);
      void trackEvent({
        eventName: 'path_step2_unlocked',
        page: '/path',
        status: 'success',
        metadata: {
          confirmedEvidence: evidenceCards.filter((card) => card.status === 'confirmed').length,
          deliveryFormat: activeLegoProfile?.deliveryFormat || 'undecided',
          testMode: Boolean(activeTestPersona),
        },
      });
    }
  }, [locked, step2Unlocked, currentStep]);

  // Step 3 解锁：准备度卡出现（教练在意愿确认后输出），自动推进并把 1/2 标记为完成
  useEffect(() => {
    if (locked) return;
    if (readiness && currentStep !== 3) {
      setCompletedSteps((prev) => {
        const next = prev.includes(1) ? prev : ([...prev, 1] as PathStep[]);
        return next.includes(2) ? next : ([...next, 2] as PathStep[]);
      });
      setCurrentStep(3);
      void trackEvent({
        eventName: 'path_step3_unlocked',
        page: '/path',
        status: 'success',
        metadata: { readinessScore: readiness.score, testMode: Boolean(activeTestPersona) },
      });
    }
  }, [locked, readiness, currentStep]);

  // 行动力面板逐个激活：准备度卡 → 探索焦点；首个微行动 → 任务列表；第一次复盘 → 今日觉察
  // （会话内激活：与证据卡/准备度一致不持久化，刷新后随进度重新点亮）
  const activatePanel = (panelId: PanelId) => {
    setVisiblePanels((current) => (current.includes(panelId) ? current : [...current, panelId]));
    setExpandedPanels((current) => ({ ...current, [panelId]: true }));
  };

  // 现实路径对话埋点：逐条写入 anonymous_chat_message（page=/path），
  // 后台「原始对话」与周报都能按对话 id 查看和统计
  const logPathCoachTurn = (role: 'user' | 'assistant', content: string, step: PathStep) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const conversationId = getPathAnalyticsConversationId();
    const sequence = pathAnalyticsSequenceRef.current;
    pathAnalyticsSequenceRef.current += 1;
    void trackEvent({
      eventName: 'anonymous_chat_message',
      page: '/path',
      metadata: {
        role,
        content: trimmed,
        chars: trimmed.length,
        coach: 'reality_path',
        step,
        anonymousConversationId: conversationId,
        conversationId,
        batchId: `path_${Math.floor(sequence / 2)}`,
        sequence,
        testMode: Boolean(activeTestPersona),
      },
    });
  };

  // 停止演示播放：清理计时器（resetPlaying=false 时保留播放状态，用于播放前的预清理）
  const stopDemoConversation = (resetPlaying = true) => {
    if (demoTimerRef.current) { clearTimeout(demoTimerRef.current); demoTimerRef.current = null; }
    if (ackTimerRef.current) { clearTimeout(ackTimerRef.current); ackTimerRef.current = null; }
    setIsCoachTyping(false);
    if (resetPlaying) setDemoPlaying(false);
  };

  // 演示对话播放：按脚本节奏逐条注入消息，教练消息走真实解析管线（证据卡可交互确认）
  const playDemoConversation = () => {
    if (!activeTestPersona) return;
    const conversation = getMockConversation(activeTestPersona.id);
    if (!conversation) return;
    stopDemoConversation();
    setMessages([]);
    setDemoPlaying(true);
    const turns = conversation.turns;
    // 演示播放期间本地维护已播消息，供微行动确认检测使用（闭包里的 messages 会过期）
    const played: PathMessage[] = [];
    let index = 0;
    const step = () => {
      if (index >= turns.length) {
        setDemoPlaying(false);
        // 播放完成：把对话里确认的交付形态同步到积木面板
        if (conversation.confirmedLego?.deliveryFormat) {
          setConfirmedDeliveryFormat(conversation.confirmedLego.deliveryFormat);
        }
        return;
      }
      const turn = turns[index];
      if (turn.role === 'assistant') {
        setIsCoachTyping(true);
        demoTimerRef.current = setTimeout(() => {
          // 教练消息走真实解析管线：证据卡 → 需求对照 → 准备度
          const evidenceParsed = parseEvidenceCardsFromReply(turn.content);
          const requirementParsed = parseRequirementCardsFromReply(evidenceParsed.cleanText);
          const readinessParsed = parseReadinessFromReply(requirementParsed.cleanText);
          const parts = splitAssistantReply(readinessParsed.cleanText || turn.content);
          if (evidenceParsed.cards.length && parts.length) {
            const lastIndex = parts.length - 1;
            parts[lastIndex] = { ...parts[lastIndex], evidenceCards: evidenceParsed.cards };
            setEvidenceCards((prev) => {
              const known = new Set(prev.map((card) => card.capability));
              return [...prev, ...evidenceParsed.cards.filter((card) => !known.has(card.capability))];
            });
          }
          if (requirementParsed.checks.length) {
            // 演示脚本：首个需求对照出现时，若主线未设定则按脚本快照同步，并把 Step 1 标记完成
            setSelectedBrief((prev) => {
              const base: SelectedPathBrief = prev || {
                pathId: conversation.confirmedMainline?.pathId || 'demo_mainline',
                pathTitle: conversation.confirmedMainline?.pathTitle || '当前聚焦路径',
                requirementChecks: [],
                valueNotes: [],
              };
              return { ...base, requirementChecks: mergeRequirementChecks(base.requirementChecks, requirementParsed.checks) };
            });
            setCompletedSteps((prevSteps) => (prevSteps.includes(1) ? prevSteps : ([...prevSteps, 1] as PathStep[])));
            setCurrentStep((current) => (current === 1 ? 2 : current));
          }
          if (readinessParsed.readiness) {
            setReadiness(readinessParsed.readiness);
            setSelectedBrief((prev) => (prev && !prev.willingness ? { ...prev, willingness: 'want' } : prev));
            activatePanel('overview');
            setCompletedSteps((prevSteps) => {
              const next = prevSteps.includes(1) ? prevSteps : ([...prevSteps, 1] as PathStep[]);
              return next.includes(2) ? next : ([...next, 2] as PathStep[]);
            });
            setCurrentStep(3);
          }
          setMessages((prev) => [...prev, ...parts]);
          played.push({ role: 'assistant', content: readinessParsed.cleanText || turn.content });
          logPathCoachTurn('assistant', readinessParsed.cleanText || turn.content, currentStep);
          setIsCoachTyping(false);
          index += 1;
          demoTimerRef.current = setTimeout(step, 850);
        }, 1050);
      } else {
        demoTimerRef.current = setTimeout(() => {
          // 演示脚本中的微行动确认同样写入任务列表，并点亮任务面板
          const nextTasks = maybeAddConfirmedMicroAction(tasks, played, turn.content);
          if (nextTasks !== tasks) {
            setTasks(nextTasks);
            savePathTasks(nextTasks);
            activatePanel('tasks');
            void trackEvent({
              eventName: 'path_micro_action_confirmed',
              page: '/path',
              status: 'success',
              metadata: { taskCount: nextTasks.filter((task) => !task.completedAt).length, source: 'demo', testMode: true },
            });
          }
          setMessages((prev) => [...prev, { role: 'user', content: turn.content }]);
          played.push({ role: 'user', content: turn.content });
          logPathCoachTurn('user', turn.content, currentStep);
          index += 1;
          step();
        }, 650);
      }
    };
    step();
  };

  // 证据卡三出口确认 + 教练即时回应（本地模板，不调 LLM；演示播放中脚本已含确认对话，不插话）
  const confirmEvidenceCardAction = (cardId: string, status: EvidenceCard['status'], userAmendment?: string) => {
    updateEvidenceCardStatus(cardId, status, userAmendment);
    if (demoPlaying) return;
    const ack = status === 'confirmed'
      ? '好的，这条已记为"已证实"，写进你的路径证据里了。接下来可以核对下一项，也可以先聊聊别的。'
      : status === 'partial'
        ? '已经按你的补充记录，这条先按"部分证实"放好——真实发生过的部分不作废。我们继续。'
        : '好，这条先不记。你的经历里还有别的线索，随时告诉我，我们从新的经历里找。';
    if (ackTimerRef.current) clearTimeout(ackTimerRef.current);
    setIsCoachTyping(true);
    ackTimerRef.current = setTimeout(() => {
      setMessages((prev) => [...prev, { role: 'assistant', content: ack }]);
      setIsCoachTyping(false);
    }, 700);
  };

  // 设为主线（Step 2 入口）：从路径详情按钮进入；完成度门槛未满足时给引导而非硬拦
  const selectMainlinePath = (path: LegoPath) => {
    if (path.id === selectedBrief?.pathId) return;
    if (!step2Unlocked) {
      void trackEvent({
        eventName: 'path_mainline_blocked',
        page: '/path',
        status: 'blocked',
        metadata: {
          pathTitle: displayPathTitle(path.title),
          confirmedEvidence: evidenceCards.filter((card) => card.status === 'confirmed').length,
          deliveryFormat: activeLegoProfile?.deliveryFormat || 'undecided',
        },
      });
      if (ackTimerRef.current) clearTimeout(ackTimerRef.current);
      setIsCoachTyping(true);
      ackTimerRef.current = setTimeout(() => {
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: '先别急，我们把 Step 1 的完成度攒够再来聚焦这条路径：确认你的交付形态（积木②）、聊清利基主题（积木③），并且至少证实 2 张能力证据卡。现在继续和我聊就对了，门槛到了我会提醒你回来选主线。',
        }]);
        setIsCoachTyping(false);
      }, 700);
      return;
    }
    setSelectedBrief({
      pathId: path.id,
      pathTitle: displayPathTitle(path.title),
      requirementChecks: [],
      valueNotes: [],
    });
    void trackEvent({
      eventName: 'path_mainline_selected',
      page: '/path',
      status: 'success',
      metadata: {
        pathId: path.id,
        pathTitle: displayPathTitle(path.title),
        quadrant: path.quadrant || null,
        marketDensity: path.marketDensity,
        testMode: Boolean(activeTestPersona),
      },
    });
    setCompletedSteps((prev) => (prev.includes(1) ? prev : ([...prev, 1] as PathStep[])));
    setCurrentStep(2);
    if (ackTimerRef.current) clearTimeout(ackTimerRef.current);
    setIsCoachTyping(true);
    ackTimerRef.current = setTimeout(() => {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `好，我把「${displayPathTitle(path.title)}」同步为你的主线，Step 2 从现在开始。接下来我们做信息聚焦：我会把这条路径最看重的几个岗位需求拎出来，逐个对照你已有的证据——已经证实过的能力直接对上，不用重新讲一遍经历；对不上的地方我们再看要不要补。我们从第一个需求开始。`,
      }]);
      setIsCoachTyping(false);
    }, 700);
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || isCoachTyping) return;
    // 意愿三态捕捉：Step 2 对照期间用户对"还想做吗"的回答（轻量正则；教练对话仍是权威，误判无害）
    if (selectedBrief && selectedBrief.requirementChecks.length > 0 && !selectedBrief.willingness) {
      const willingness = /不想做|不适合我|还是算了|先不弄了/.test(text)
        ? 'no' as const
        : /想做|还想做|挺想做|愿意|可以试试|想试试|有兴趣/.test(text)
          ? 'want' as const
          : /观望|不确定|还没想好|再看看/.test(text)
            ? 'unsure' as const
            : null;
      if (willingness) {
        setSelectedBrief((prev) => (prev ? { ...prev, willingness } : prev));
        void trackEvent({
          eventName: 'path_willingness_selected',
          page: '/path',
          status: willingness,
          metadata: { pathTitle: selectedBrief.pathTitle, checkCount: selectedBrief.requirementChecks.length },
        });
      }
    }
    const nextTasks = maybeAddConfirmedMicroAction(tasks, messages, text);
    if (nextTasks !== tasks) {
      setTasks(nextTasks);
      savePathTasks(nextTasks);
      activatePanel('tasks');
      void trackEvent({
        eventName: 'path_micro_action_confirmed',
        page: '/path',
        status: 'success',
        metadata: { taskCount: nextTasks.filter((task) => !task.completedAt).length, source: 'chat', step: currentStep },
      });
    }
    const inferredResourceNotes = inferResourceNotesFromUserText(text, currentExplorationRole);
    if (inferredResourceNotes.length) {
      setPendingBoardSummary((current) => {
        const base = current || boardSummary || buildInitialBoardSummary(report, preview);
        return {
          ...base,
          resources: pickTopItems([...base.resources, ...inferredResourceNotes.map((note) => note.text)], 8),
          resourceNotes: mergeResourceNotes(base.resourceNotes || [], inferredResourceNotes),
          updatedAt: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
          source: '待你确认的现实路径对话线索',
        };
      });
      setExpandedPanels((current) => ({ ...current, modules: true }));
    }
    const nextMessages = [...messages, { role: 'user' as const, content: text }];
    void trackEvent({
      eventName: 'path_chat_message_sent',
      page: '/path',
      status: 'success',
      metadata: { turnNumber: messages.filter((message) => message.role === 'user').length + 1, roleName: currentExplorationRole || null },
    });
    logPathCoachTurn('user', text, currentStep);
    setMessages(nextMessages);
    setDraft('');
    setIsCoachTyping(true);

    try {
      const res = await fetch('/api/coach/path/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          messages: nextMessages,
          report,
          preview,
          tasks: nextTasks,
          lego: currentLegoProfile(),
          evidenceCards,
          realityConstraints,
          step: currentStep,
          selectedBrief,
          readiness,
          pathOptions: (activeTestPersona?.legoPaths ?? []).map((path) => ({
            title: path.title,
            deliveryFormat: path.deliveryFormat,
            marketDensity: path.marketDensity,
            feasibility: path.feasibility,
          })),
        }),
      });
      const data = (await res.json()) as { reply?: string };
      // 解析教练回复标记：证据卡 → 需求对照 → 准备度，逐层剥离后正文再分段渲染
      const evidenceParsed = parseEvidenceCardsFromReply(data.reply || '');
      const requirementParsed = parseRequirementCardsFromReply(evidenceParsed.cleanText);
      const readinessParsed = parseReadinessFromReply(requirementParsed.cleanText);
      const assistantMessages = splitAssistantReply(readinessParsed.cleanText || '现实路径教练暂时没有返回内容，请稍后再试。');
      if (evidenceParsed.cards.length && assistantMessages.length) {
        const lastAssistantIndex = assistantMessages.length - 1;
        assistantMessages[lastAssistantIndex] = {
          ...assistantMessages[lastAssistantIndex],
          evidenceCards: evidenceParsed.cards,
        };
        setEvidenceCards((prev) => {
          const knownCapabilities = new Set(prev.map((card) => card.capability));
          return [...prev, ...evidenceParsed.cards.filter((card) => !knownCapabilities.has(card.capability))];
        });
      }
      if (requirementParsed.checks.length) {
        // 需求对照只在已选定主线时落位；主线未选（真实用户未点按钮）时暂存到教练正文，不强建主线
        setSelectedBrief((prev) => {
          if (!prev) return prev;
          return { ...prev, requirementChecks: mergeRequirementChecks(prev.requirementChecks, requirementParsed.checks) };
        });
        for (const check of requirementParsed.checks) {
          void trackEvent({
            eventName: 'path_requirement_checked',
            page: '/path',
            status: check.status,
            metadata: { requirement: check.requirement, pathTitle: selectedBrief?.pathTitle || null },
          });
        }
      }
      if (readinessParsed.readiness) {
        setReadiness(readinessParsed.readiness);
        setSelectedBrief((prev) => (prev && !prev.willingness ? { ...prev, willingness: 'want' } : prev));
        activatePanel('overview');
        void trackEvent({
          eventName: 'path_readiness_generated',
          page: '/path',
          status: 'success',
          metadata: {
            score: readinessParsed.readiness.score,
            haveCount: readinessParsed.readiness.have.length,
            verifyCount: readinessParsed.readiness.verify.length,
            nextCount: readinessParsed.readiness.next.length,
            pathTitle: selectedBrief?.pathTitle || null,
          },
        });
      }
      setMessages((prev) => [...prev, ...assistantMessages]);
      logPathCoachTurn('assistant', readinessParsed.cleanText, currentStep);
      void trackEvent({ eventName: 'path_chat_reply_received', page: '/path', status: 'success', metadata: { roleName: currentExplorationRole || null } });
      const checksForRole = explorationChecksByRole[currentExplorationRole] || [];
      if (hasEnoughEvidenceForPathUpdate(nextMessages, checksForRole)) {
        const nextSummary = buildBoardSummaryFromConversation(report, preview, nextMessages);
        setPendingBoardSummary((current) => current ? {
          ...nextSummary,
          resources: pickTopItems([...nextSummary.resources, ...current.resources], 8),
          resourceNotes: mergeResourceNotes(nextSummary.resourceNotes || [], current.resourceNotes || []),
        } : nextSummary);
      }
      // 教练回复后自动持久化档案快照（不触碰待确认的资料板建议）
      const autoArchiveBoard = pendingBoardSummary || boardSummary;
      if (autoArchiveBoard) {
        persistArchiveSummary(report, autoArchiveBoard, nextMessages, nextTasks, findTodayReflection());
        setArchiveUpdatedAt(autoArchiveBoard.updatedAt || new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
      }
    } catch {
      void trackEvent({ eventName: 'path_chat_reply_received', page: '/path', status: 'error' });
      setMessages((prev) => [...prev, { role: 'assistant', content: '现实路径教练暂时没有返回内容，请稍后再试。' }]);
    } finally {
      setIsCoachTyping(false);
    }
  };

  const archivePathConversation = () => {
    const materialMessages = messages.filter((message) => message.content.trim());
    if (materialMessages.some((message) => message.role === 'user')) {
      const now = new Date();
      const archive: PathConversationArchive = {
        id: createArchiveId(),
        title: buildArchiveTitle(materialMessages),
        archivedAt: now.toISOString(),
        dateKey: toDateKey(now),
        messages: materialMessages,
      };
      const nextArchives = [archive, ...conversationArchives];
      setConversationArchives(nextArchives);
      saveConversationArchives(nextArchives);
      setSelectedCalendarDate(archive.dateKey);
    }
    setDraft('');
    setPendingBoardSummary(null);
    setMessages([
      {
        role: 'assistant',
        content: buildCoachIntro(report, preview),
      },
    ]);
  };

  const confirmBoardUpdate = (nextBoard: PathBoardSummary) => {
    const confirmedBoard = {
      ...nextBoard,
      source: nextBoard.source === '待你确认的现实路径对话线索' ? '经你确认的现实路径对话线索' : nextBoard.source,
    };
    setBoardSummary(confirmedBoard);
    persistPathBoardSummary(confirmedBoard);
    setPendingBoardSummary(null);
  };

  const toggleTaskCompletion = (taskId: string) => {
    const nextTasks = tasks.map((task) => {
      if (task.id !== taskId) return task;
      return {
        ...task,
        completedAt: task.completedAt ? null : new Date().toISOString(),
      };
    });
    const toggledTask = tasks.find((task) => task.id === taskId);
    void trackEvent({ eventName: toggledTask?.completedAt ? 'action_reopened' : 'action_completed', page: '/path', status: 'success', metadata: { taskId, taskTitle: toggledTask?.title || '' } });
    setTasks(nextTasks);
    savePathTasks(nextTasks);
  };

  const saveTodayReflection = () => {
    const content = reflectionText.trim();
    if (!content) return;
    const now = new Date();
    const nextReflection = {
      dateKey: toDateKey(now),
      content,
      mood: reflectionMood,
      updatedAt: now.toISOString(),
    };
    savePathReflection(nextReflection);
    setReflections((current) => [
      nextReflection,
      ...current.filter((item) => item.dateKey !== nextReflection.dateKey),
    ]);
    setSelectedCalendarDate(nextReflection.dateKey);
    activatePanel('reflection');
    setReflectionSavedAt(now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
    setReflectionText('');
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#F3F8FF_0%,#FFFFFF_55%,#F7FBFF_100%)] text-slate-900">
      <div className="mx-auto max-w-[1600px] px-4 py-4 md:px-6 md:py-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#86B8FF]/35 bg-white/70 text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-white"
            aria-label="打开菜单"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Reality Path</div>
            <div className="truncate text-base font-bold text-[#2A6FA3]">现实路径地图</div>
          </div>
          {showTestEntry ? (
            <Button
              onClick={() => setTestModeEnabled((v) => !v)}
              variant={testModeEnabled ? 'default' : 'outline'}
              className={testModeEnabled
                ? 'rounded-full bg-amber-500 text-white shadow-sm hover:bg-amber-600'
                : 'rounded-full border-amber-300/50 bg-amber-50/50 text-amber-700 shadow-sm hover:bg-amber-100/70'}
            >
              {testModeEnabled ? '退出测试模式' : '测试模式'}
            </Button>
          ) : null}
        </div>

        <div className="mt-6 rounded-[1.4rem] border border-[#86B8FF]/22 bg-white/78 px-5 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur">
          <PathStepIndicator
            currentStep={currentStep}
            completedSteps={completedSteps}
            displayedStep={displayedStep}
            onSelect={(step) => {
              // 已完成或当前 step 都可以看；未解锁的 step 不能跳
              if (step === currentStep || completedSteps.includes(step)) {
                setViewingStep(step === currentStep ? null : step);
              }
            }}
          />
        </div>

        {testModeEnabled ? (
          <div className="mt-4 rounded-[1.4rem] border border-amber-200/60 bg-amber-50/60 px-5 py-4 shadow-[0_12px_30px_rgba(251,191,36,0.08)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">测试画像</span>
                <div className="flex items-center gap-2">
                  {PATH_TEST_PERSONAS.map((persona) => {
                    const isActive = activeTestPersona?.id === persona.id;
                    return (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() => loadTestPersona(persona)}
                        className={`group flex flex-col items-center gap-1 rounded-2xl px-3 py-2 transition ${
                          isActive
                            ? 'bg-amber-500 text-white shadow-md'
                            : 'bg-white/70 text-slate-700 hover:bg-white hover:shadow-sm'
                        }`}
                        aria-pressed={isActive}
                      >
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                            isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                          }`}
                          aria-hidden
                        >
                          {persona.name.charAt(0)}
                        </span>
                        <span className="text-xs font-medium">{persona.name}</span>
                        <span className={`text-[10px] ${isActive ? 'text-amber-50' : 'text-slate-500'}`}>
                          {persona.domain === 'business' ? '商科' : persona.domain === 'engineering' ? '理工科' : '艺术'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {activeTestPersona ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={exitTestMode}
                  className="rounded-full border-amber-300/50 bg-white/85 text-amber-700 hover:bg-amber-100/70"
                >
                  清除画像
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {testModeEnabled && activeTestPersona ? (
          <Card className="mt-4 rounded-[1.4rem] border border-amber-200/60 bg-white/85 shadow-[0_12px_30px_rgba(251,191,36,0.08)]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-amber-800">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                  {activeTestPersona.name.charAt(0)}
                </span>
                {activeTestPersona.name} · {activeTestPersona.currentRole} · {activeTestPersona.yearsOfExperience} 年
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <p className="leading-6 text-slate-600">{activeTestPersona.background}</p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 px-3 py-2">
                  <div className="text-[11px] font-medium text-slate-500">核心价值观</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {activeTestPersona.coreValues.map((v) => (
                      <Badge key={v} variant="outline" className="border-amber-300/60 bg-amber-50/80 text-amber-800 text-xs">
                        {CORE_VALUE_LABELS[v]}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 px-3 py-2">
                  <div className="text-[11px] font-medium text-slate-500">稳定性 / 收入 / 节奏</div>
                  <div className="mt-1 text-xs leading-5 text-slate-700">
                    {activeTestPersona.stabilityPreference === 'high' ? '高稳定' : activeTestPersona.stabilityPreference === 'medium' ? '中等稳定' : '低稳定容忍'}
                    {' · '}
                    {activeTestPersona.incomeExpectation === 'high' ? '高收入' : activeTestPersona.incomeExpectation === 'medium' ? '中等收入' : '低收入容忍'}
                    {' · '}
                    {activeTestPersona.pacePreference === 'structured' ? '结构化' : activeTestPersona.pacePreference === 'flexible' ? '灵活' : '爆发式'}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 px-3 py-2">
                  <div className="text-[11px] font-medium text-slate-500">理想职业</div>
                  <div className="mt-1 text-xs leading-5 text-slate-700">{activeTestPersona.idealRoles.join(' · ')}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="mt-6 grid gap-6 min-[768px]:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="order-2 min-w-0 space-y-6 min-[768px]:order-1">
            {displayedStep !== currentStep ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-900">
                正在查看 Step {displayedStep} 的历史记录。<button type="button" className="ml-2 font-semibold underline" onClick={() => setViewingStep(null)}>返回 Step {currentStep}</button>
              </div>
            ) : null}
            <PathStepContent step={displayedStep}>
              <div className="hidden rounded-[1.6rem] border border-[#86B8FF]/16 bg-white/72 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur md:block">
                <h1 className="text-3xl font-bold tracking-tight text-[#2A6FA3]">把报告里的方向变成可推进的职业路径</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                  先跟现实路径教练聊聊你的想法，然后在面板里进行下一步整理、分析和记录。
                </p>
              </div>

            {locked ? (
              <Card className="rounded-[1.6rem] border border-amber-200/80 bg-amber-50/70 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
                <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                  <div className="max-w-2xl">
                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                      <Sparkles className="h-4 w-4" />
                      现实路径地图未解锁
                    </div>
                    <p className="mt-2 text-sm leading-7 text-amber-900/80">
                      未读取到天赋能力报告，请和天赋教练对话获取报告后，再进行现实路径探索。
                    </p>
                  </div>
                  <Button className="rounded-full bg-[#86B8FF]/80 text-[#225F91] shadow-sm hover:bg-[#78AAEE]" onClick={() => setLockedNoticeOpen(true)}>
                    查看解锁提示
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {!locked && report ? (
              <PathLegoPanel
                profile={currentLegoProfile()}
                paths={activeTestPersona?.legoPaths ?? []}
                shareName={activeTestPersona?.name}
                shareArchetype={report?.archetype}
                mainlinePathId={selectedBrief?.pathId ?? null}
                onSelectAsMainline={selectMainlinePath}
                valueProfile={
                  activeTestPersona
                    ? {
                        coreValues: activeTestPersona.coreValues,
                        stabilityPreference: activeTestPersona.stabilityPreference,
                        incomeExpectation: activeTestPersona.incomeExpectation,
                        pacePreference: activeTestPersona.pacePreference,
                      }
                    : null
                }
              />
            ) : null}

            {!locked ? <EvidenceProgressPanel cards={evidenceCards} constraints={realityConstraints} /> : null}

            {!locked && selectedBrief ? <RequirementFocusPanel brief={selectedBrief} /> : null}

            {!locked && readiness ? <ReadinessPanel readiness={readiness} /> : null}

            {visiblePanels.includes('overview') || visiblePanels.includes('tasks') ? (
              <ActionCenterCard
                locked={locked}
                mainlineTitle={selectedBrief?.pathTitle || boardSummary?.leastResistancePath || null}
                ownedAbility={(() => {
                  const haveLine = readiness?.have[0];
                  if (haveLine) return haveLine.split(/[：:]/)[0].trim();
                  const confirmed = [...evidenceCards].reverse().find((card) => card.status === 'confirmed');
                  return confirmed?.capability || null;
                })()}
                readinessScore={readiness?.score ?? null}
                tasks={tasks}
                onToggleTask={toggleTaskCompletion}
              />
            ) : null}

            {visiblePanels.includes('reflection') ? <MobilePanel
              id="reflection"
              title="今日觉察"
              description="记录对话、行动和心情贴纸。"
              expanded={expandedPanels.reflection}
              onToggle={togglePanel}
            >
              <TodayReflectionCard
                value={reflectionText}
                mood={reflectionMood}
                savedAt={reflectionSavedAt}
                locked={locked}
                onChange={setReflectionText}
                onMoodChange={setReflectionMood}
                onSave={saveTodayReflection}
              />
            </MobilePanel> : null}

            {visiblePanels.includes('calendar') ? <MobilePanel
              id="calendar"
              title="行动力日历"
              description="用图标回看任务、觉察和心情。"
              expanded={expandedPanels.calendar}
              onToggle={togglePanel}
              collapsedOnDesktop
            >
              <PathActionCalendar
                tasks={tasks}
                reflections={reflections}
                archives={conversationArchives}
                selectedDate={selectedCalendarDate}
                onSelectDate={setSelectedCalendarDate}
                onOpenArchive={setOpenArchive}
              />
            </MobilePanel> : null}

            {visiblePanels.includes('modules') ? <MobilePanel
              id="modules"
              title="资料模块"
              description="愿景板和按岗位整理的资源支持。"
              expanded={expandedPanels.modules}
              onToggle={togglePanel}
              collapsedOnDesktop
            >
              <div className="grid gap-4 min-[1500px]:grid-cols-[minmax(280px,0.85fr)_minmax(560px,1.15fr)]">
                <PathModule
                  icon={Sparkles}
                  title="愿景板"
                  description="你想靠近的工作感受、场景和成就感。"
                  accent="bg-amber-50 text-amber-600"
                  items={['把最想要的工作状态贴在这里', '优先保留 1-2 个方向']}
                />
                <ResourceSupportModule
                  resourceNotes={boardSummary?.resourceNotes || []}
                  fallbackAccess={pickTopItems([
                    ...(boardSummary?.tools || ['招聘信息', '信息面谈', '作品/经历盘点']),
                    ...(boardSummary?.places || ['招聘平台', '从业者社群', '朋友/同事网络']),
                  ], 6)}
                  currentRole={currentExplorationRole}
                  checksByRole={explorationChecksByRole}
                />
              </div>
            </MobilePanel> : null}

            {visiblePanels.includes('exploration') ? <MobilePanel
              id="exploration"
              title="探索入口"
              description="从你感兴趣的角度继续了解，不要求一次完成。"
              expanded={expandedPanels.exploration}
              onToggle={togglePanel}
              collapsedOnDesktop
            >
              <CareerExplorationBoard
                roles={topRoles}
                selectedRole={currentExplorationRole}
                checks={currentExplorationChecks}
                locked={locked}
                onSelectRole={handleSelectExplorationRole}
                onToggleCheck={toggleCareerExplorationCheck}
                onOpenSearch={() => router.push('/coach/action/tools/opportunity-search')}
              />
            </MobilePanel> : null}

            {visiblePanels.includes('profile') || visiblePanels.includes('updates') ? (
            <div className={`grid gap-4 ${visiblePanels.includes('profile') && visiblePanels.includes('updates') ? 'min-[1280px]:grid-cols-2' : ''}`}>
            {visiblePanels.includes('profile') ? <MobilePanel
              id="profile"
              title="资料概览"
              description="当前主线能力和岗位方向。"
              expanded={expandedPanels.profile}
              onToggle={togglePanel}
              collapsedOnDesktop
            >
              <div className="space-y-4">
                <div className="rounded-[1.6rem] border border-[#86B8FF]/16 bg-white/76 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#2A6FA3]">
                    <Target className="h-4 w-4 text-sky-500" />
                    你目前的主线
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl bg-[#F3F8FF] px-4 py-3">
                      <div className="text-xs font-semibold text-slate-500">首选职业方向</div>
                      <div className="mt-1 text-sm font-semibold text-[#2A6FA3]">{currentExplorationRole}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs font-semibold text-slate-500">当前行动</div>
                      <div className="mt-1 text-sm leading-6 text-slate-700">
                        {boardSummary?.nextStep || '你可以从岗位日常、真实职位描述、相邻岗位或从业者经验里选择一个入口。'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.6rem] border border-[#86B8FF]/16 bg-white/76 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#2A6FA3]">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    先看这些岗位
                  </div>
                  <div className="mt-4 space-y-2">
                    {topRoles.map((item) => (
                      <Badge key={item} variant="secondary" className="mr-2 mb-2 bg-slate-100 text-slate-700">
                        {item}
                      </Badge>
                    ))}
                    {!topRoles.length ? <div className="text-sm text-slate-400">岗位建议会在这里展示。</div> : null}
                  </div>
                </div>
              </div>
            </MobilePanel> : null}

            {visiblePanels.includes('updates') ? <MobilePanel
              id="updates"
              title="资料板更新"
              description="确认右侧教练整理出的新判断。"
              expanded={expandedPanels.updates}
              onToggle={togglePanel}
              collapsedOnDesktop
            >
              <div className="rounded-[1.6rem] border border-[#86B8FF]/16 bg-white/76 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#2A6FA3]">
                <FilePenLine className="h-4 w-4 text-violet-500" />
                资料板更新
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {pendingBoardSummary
                  ? '右侧教练已经整理出一版新的资料板建议，确认后会更新中间总览。'
                  : '右侧教练聊到足够线索后，会先生成更新建议，由你确认后再写入资料板。'}
              </p>
              {archiveUpdatedAt ? (
                <p className="mt-2 rounded-2xl bg-emerald-50 px-4 py-2 text-xs leading-5 text-emerald-700">
                  已整合当前对话、报告和资料板，并更新用户记录摘要。更新时间：{archiveUpdatedAt}
                </p>
              ) : null}
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="rounded-full"
                  disabled={locked || !canSuggestBoardUpdate}
                  onClick={() => setPendingBoardSummary(buildBoardSummaryFromConversation(report, preview, messages))}
                >
                  {canSuggestBoardUpdate ? '重新整理资料板' : '线索足够后整理资料板'}
                </Button>
                {pendingBoardSummary ? (
                  <Button
                    className="rounded-full bg-[#86B8FF]/80 text-[#225F91] shadow-sm hover:bg-[#78AAEE]"
                    onClick={() => {
                      confirmBoardUpdate(pendingBoardSummary);
                    }}
                  >
                    确认更新资料板
                  </Button>
                ) : null}
              </div>
            </div>
            </MobilePanel> : null}
            </div>
            ) : null}

            {visiblePanels.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-[#86B8FF]/28 bg-white/65 px-6 py-10 text-center shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
                <LayoutGrid className="mx-auto h-6 w-6 text-sky-400" />
                <div className="mt-3 text-sm font-semibold text-[#2A6FA3]">面板暂时是空的</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">打开左上角菜单，添加你现在需要的模块。</p>
              </div>
            ) : null}
            </PathStepContent>
          </div>

          <aside id="coach" className="order-1 min-w-0 space-y-4 min-[768px]:order-2">
            <div className="overflow-hidden rounded-[1.6rem] border border-[#86B8FF]/18 bg-white/76 shadow-[0_18px_55px_rgba(15,23,42,0.07)] backdrop-blur min-[768px]:sticky min-[768px]:top-4 min-[768px]:flex min-[768px]:h-[calc(100dvh-7rem)] min-[768px]:min-h-[520px] min-[768px]:max-h-[760px] min-[768px]:flex-col">
              <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#2A6FA3]">
                    <PanelRight className="h-4 w-4 text-sky-500" />
                    现实路径教练
                  </div>
                  <p className="mt-1 text-xs leading-6 text-slate-500">帮助你更好地把理想向现实推进。</p>
                </div>
                {showTestEntry && activeTestPersona ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isCoachTyping && !demoPlaying}
                    className="shrink-0 rounded-full border-amber-300/70 bg-amber-50/70 text-xs font-semibold text-amber-800 hover:bg-amber-100/80"
                    onClick={() => (demoPlaying ? stopDemoConversation() : playDemoConversation())}
                  >
                    {demoPlaying ? '■ 停止演示' : '▶ 播放演示对话'}
                  </Button>
                ) : null}
              </div>

              <div ref={messagesScrollRef} className="scroll-pb-8 overflow-y-auto px-5 py-4 min-[768px]:min-h-0 min-[768px]:flex-1">
                {locked ? (
                  <div className="mb-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-500">
                    你还没有基础资料，所以这里先锁住。去完成天赋教练对话后，现实路径教练会自动接上。
                  </div>
                ) : null}
                <div className="space-y-3">
                  {pendingBoardSummary && !locked ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-900">
                      <div className="font-semibold">我整理出一版资料板更新建议</div>
                      <p className="mt-1">
                        我把刚才对话里出现的岗位、能力和资源线索整理成了一版候选更新。候选方向是：{pendingBoardSummary.leastResistancePath}。确认后才会写入资料板，也不会替你做最终决定。
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          className="rounded-full bg-[#86B8FF]/80 text-[#225F91] shadow-sm hover:bg-[#78AAEE]"
                          onClick={() => {
                            confirmBoardUpdate(pendingBoardSummary);
                          }}
                        >
                          确认更新资料板
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-full bg-white" onClick={() => setPendingBoardSummary(null)}>
                          先不更新
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[90%] rounded-2xl border px-4 py-3 text-sm leading-7 shadow-sm ${msg.role === 'user' ? 'border-[#D9D0EE]/55 bg-[#F7F3FF] text-slate-700' : 'border-[#B9D8F2]/60 bg-[#F2F8FF] text-slate-700'}`}>
                        <CoachMessageContent content={msg.content} />
                        {msg.role === 'assistant' && msg.evidenceCards?.length ? (
                          <div className="mt-2 space-y-2">
                            {msg.evidenceCards.map((card) => (
                              <EvidenceConfirmCard
                                key={card.id}
                                card={card}
                                onConfirm={() => confirmEvidenceCardAction(card.id, 'confirmed')}
                                onSupplement={(amendment) => confirmEvidenceCardAction(card.id, 'partial', amendment)}
                                onReject={() => confirmEvidenceCardAction(card.id, 'rejected')}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {isCoachTyping ? <CoachTypingBubble /> : null}
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-200/70 p-4">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  placeholder={locked ? '先去天赋教练对话生成基础资料。' : '讲讲你最关心的现实问题'}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-300"
                  disabled={locked || isCoachTyping}
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    className="rounded-full border-[#86B8FF]/35 bg-white/85 text-[#2A6FA3] shadow-sm hover:bg-[#F3F8FF]"
                    onClick={archivePathConversation}
                  >
                    归档
                  </Button>
                  <Button className="rounded-full bg-[#86B8FF]/85 text-[#225F91] shadow-sm hover:bg-[#78AAEE]" onClick={() => void handleSend()} disabled={locked || isCoachTyping}>
                    发送
                  </Button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-[90]">
          <button
            type="button"
            aria-label="关闭菜单"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <nav className="absolute left-0 top-0 flex h-full w-[82vw] max-w-sm flex-col border-r border-[#86B8FF]/20 bg-white/95 p-5 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Menu</div>
                <div className="mt-1 text-lg font-bold text-[#2A6FA3]">现实路径导航</div>
              </div>
              <button
                type="button"
                aria-label="关闭菜单"
                onClick={() => setMenuOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
              <section>
                <div className="flex items-center justify-between gap-3 px-2">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">我的面板</div>
                    <p className="mt-1 text-xs text-slate-500">选择要在左侧显示的内容</p>
                  </div>
                  <button
                    type="button"
                    onClick={restoreRecommendedPanels}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-[#2A6FA3] hover:bg-[#F3F8FF]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    恢复推荐
                  </button>
                </div>
                <div className="mt-3 space-y-1.5">
                  {panelModules.map((item) => {
                    const visible = visiblePanels.includes(item.id);
                    return (
                      <div key={item.id} className="flex items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-[#F3F8FF]">
                        <button
                          type="button"
                          onClick={() => visible ? closeMenuAndGo(`#${item.id}`) : setPanelVisibility(item.id, true)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F3F8FF] text-sky-500">
                            <item.icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-700">{item.label}</span>
                            <span className="mt-0.5 block truncate text-[11px] text-slate-400">{item.description}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={visible ? `从面板隐藏${item.label}` : `添加${item.label}到面板`}
                          onClick={() => setPanelVisibility(item.id, !visible)}
                          className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold transition-colors ${
                            visible
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-slate-100 hover:text-slate-600'
                              : 'bg-[#86B8FF]/16 text-[#2A6FA3] hover:bg-[#86B8FF]/25'
                          }`}
                        >
                          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                          {visible ? '隐藏' : '添加'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="border-t border-[#86B8FF]/14 pt-4">
                <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">固定入口</div>
                <div className="mt-2 space-y-1">
                  {[
                    { label: '现实路径教练', href: '#coach', icon: PanelRight },
                    { label: '职业报告', href: '/report', icon: FileText },
                    { label: '岗位搜索', href: '/coach/action/tools/opportunity-search', icon: Search },
                    { label: '个人中心', href: '/user', icon: UserRound },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => closeMenuAndGo(item.href)}
                      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-[#F3F8FF] hover:text-[#2A6FA3]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F3F8FF] text-sky-500">
                        <item.icon className="h-4 w-4" />
                      </span>
                      {item.label}
                    </button>
                  ))}
                </div>
              </section>
            </div>
            <div className="mt-4 shrink-0 border-t border-[#86B8FF]/16 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-[#2A6FA3]">
                  <FileText className="h-4 w-4 text-sky-500" />
                  历史对话
                </div>
                <Badge variant="secondary" className="bg-[#86B8FF]/14 text-[#2A6FA3]">
                  {conversationArchives.length}
                </Badge>
              </div>
              <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                {conversationArchives.length ? conversationArchives.map((archive) => (
                  <button
                    key={archive.id}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setOpenArchive(archive);
                    }}
                    className="w-full rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 text-left shadow-sm"
                  >
                    <div className="truncate text-sm font-semibold text-slate-700">{archive.title}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {new Date(archive.archivedAt).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </button>
                )) : (
                  <div className="rounded-2xl border border-dashed border-[#86B8FF]/22 bg-[#F3F8FF]/45 px-4 py-4 text-sm leading-6 text-slate-500">
                    点击教练对话下方的“归档”，这里会保存测试对话。
                  </div>
                )}
              </div>
            </div>
          </nav>
        </div>
      ) : null}

      {locked && lockedNoticeOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[1.5rem] border border-white/70 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.22)]">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2A6FA3]">
              <Sparkles className="h-4 w-4 text-amber-500" />
              现实路径探索未解锁
            </div>
            <h2 className="mt-4 text-xl font-bold tracking-tight text-[#2A6FA3]">
              未读取到天赋能力报告
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              未读取到天赋能力报告，请和天赋教练对话获取报告后，再进行现实路径探索。
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" className="rounded-full" onClick={() => setLockedNoticeOpen(false)}>
                先留在这里
              </Button>
              <Button className="rounded-full bg-[#86B8FF]/80 text-[#225F91] shadow-sm hover:bg-[#78AAEE]" onClick={() => router.push('/chat?new=true')}>
                和天赋教练对话
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConversationArchiveModal archive={openArchive} onClose={() => setOpenArchive(null)} />
      <AuthDialog isOpen={showAuth} onClose={() => setShowAuth(false)} onAuthSuccess={() => setShowAuth(false)} nextPath="/path" draftToken={draftToken} />
    </main>
  );
}
