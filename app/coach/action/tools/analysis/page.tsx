'use client';

import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  Compass,
  ExternalLink,
  FileSearch,
  Gamepad2,
  Layers3,
  Lightbulb,
  MessageSquareText,
  Network,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  UsersRound,
} from 'lucide-react';

type AnalysisType = 'product' | 'industry' | 'career' | 'feedback' | 'resource';

type AnalysisMode = {
  id: AnalysisType;
  title: string;
  description: string;
  icon: typeof BarChart3;
};

type SampleCase = {
  name: string;
  role: string;
  takeaway: string;
  sourceLabel: string;
  sourceUrl: string;
  scores: {
    fit: number;
    evidence: number;
    action: number;
  };
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

type OpportunityReport = {
  profileSummary: string;
  pathVerdict: string;
  feasibilityScore: number;
  searchQueries: string[];
  recommendedChannels: Array<{ name: string; why: string; queryHint: string }>;
  opportunityRoles: Array<{ title: string; companyType: string; matchReason: string; risk: string; evidenceToCollect: string }>;
  skillGaps: string[];
  firstWeekActions: string[];
  caveats: string[];
};

type AnalysisApiResponse = {
  report?: AnalysisReport | null;
  provider?: string;
  providerNote?: string | null;
  error?: string;
};

type OpportunityApiResponse = {
  report?: OpportunityReport | null;
  provider?: string;
  providerNote?: string | null;
  error?: string;
};

type ModePreset = {
  defaultTopic: string;
  summaryLabel: string;
  reportLabel: string;
  briefDeliverable: string;
  insightHeadline: string;
  insightFocus: string;
  insightOpportunity: string;
  opportunityMap: Array<{ label: string; value: string; color: string }>;
  risks: string[];
  experiments: string[];
  confidenceNotes: string[];
};

const ANALYSIS_MODES: AnalysisMode[] = [
  { id: 'product', title: '产品 / 竞品分析', description: '拆截图、功能、流程、竞品和可迁移设计', icon: Gamepad2 },
  { id: 'industry', title: '行业机会分析', description: '看趋势、玩家、商业模式、进入门槛', icon: TrendingUp },
  { id: 'career', title: '职业前景分析', description: '看岗位路径、能力要求、风险和转型入口', icon: BriefcaseBusiness },
  { id: 'feedback', title: '用户反馈分析', description: '整理评论、访谈、社群反馈和真实需求', icon: MessageSquareText },
  { id: 'resource', title: '资源地图分析', description: '把可访问的人、平台、案例和渠道变成路线', icon: Network },
];

const SAMPLE_CASES: SampleCase[] = [
  {
    name: 'A Short Hike',
    role: '低压力探索样例',
    takeaway: '用很近的小目标和自由路线，让用户获得“我可以慢慢抵达”的掌控感。',
    sourceLabel: 'A Short Hike',
    sourceUrl: 'https://en.wikipedia.org/wiki/A_Short_Hike',
    scores: { fit: 91, evidence: 78, action: 88 },
  },
  {
    name: 'Unpacking',
    role: '动作叙事样例',
    takeaway: '把心理变化藏进整理动作里，用户不是被说服，而是在摆放中恢复秩序。',
    sourceLabel: 'Unpacking',
    sourceUrl: 'https://www.unpackinggame.com/',
    scores: { fit: 87, evidence: 82, action: 76 },
  },
  {
    name: 'Animal Crossing',
    role: '日常陪伴样例',
    takeaway: '通过每日轻任务、收集和空间装饰，让成长变成长期关系而不是短期打卡。',
    sourceLabel: 'Nintendo',
    sourceUrl: 'https://animalcrossing.nintendo.com/new-horizons/',
    scores: { fit: 84, evidence: 86, action: 81 },
  },
];

const CASES_BY_MODE: Record<AnalysisType, SampleCase[]> = {
  product: SAMPLE_CASES,
  industry: [
    {
      name: 'McKinsey Technology Trends Outlook',
      role: '技术趋势/赛道判断',
      takeaway: '适合判断 AI、agentic AI、软件开发等趋势是否有企业采用、投资、人才需求支撑。',
      sourceLabel: 'McKinsey',
      sourceUrl: 'https://www.mckinsey.com/capabilities/mckinsey-digital/our-insights/the-top-trends-in-tech',
      scores: { fit: 88, evidence: 92, action: 74 },
    },
    {
      name: 'Gartner Strategic Technology Trends',
      role: '企业技术采购信号',
      takeaway: '适合观察企业级技术主题如何进入 CIO 议程，以及哪些趋势更偏短期部署。',
      sourceLabel: 'Gartner',
      sourceUrl: 'https://www.gartner.com/en/newsroom/press-releases/2025-10-20-gartner-identifies-the-top-strategic-technology-trends-for-2026',
      scores: { fit: 82, evidence: 88, action: 70 },
    },
    {
      name: 'World Economic Forum Future of Jobs',
      role: '宏观就业/技能变化',
      takeaway: '适合把行业机会和岗位技能变化连接起来，避免只看产品热度。',
      sourceLabel: 'WEF',
      sourceUrl: 'https://www.weforum.org/publications/the-future-of-jobs-report-2025/digest/',
      scores: { fit: 80, evidence: 90, action: 76 },
    },
  ],
  career: [
    {
      name: 'BLS Occupational Outlook Handbook',
      role: '职业前景基础盘',
      takeaway: '适合查岗位职责、薪资、教育要求、增长预期，作为职业判断的底层事实来源。',
      sourceLabel: 'BLS OOH',
      sourceUrl: 'https://www.bls.gov/ooh/',
      scores: { fit: 90, evidence: 94, action: 78 },
    },
    {
      name: 'BLS Computer & IT Occupations',
      role: '技术岗位路径',
      takeaway: '适合比较软件开发、数据、网页/数字设计等岗位的职责和进入门槛。',
      sourceLabel: 'BLS',
      sourceUrl: 'https://www.bls.gov/ooh/computer-and-information-technology/home.htm',
      scores: { fit: 84, evidence: 92, action: 82 },
    },
    {
      name: 'WEF Skills Outlook',
      role: '未来技能要求',
      takeaway: '适合判断分析思维、AI/大数据、韧性、创造力等技能是否值得优先补齐。',
      sourceLabel: 'WEF',
      sourceUrl: 'https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/',
      scores: { fit: 82, evidence: 88, action: 80 },
    },
  ],
  feedback: [
    {
      name: 'Appbot App Review Analysis Guide',
      role: '应用商店评论分析',
      takeaway: '适合把评论按主题、情绪和版本变化拆开，找出真实痛点和功能需求。',
      sourceLabel: 'Appbot',
      sourceUrl: 'https://appbot.co/blog/how-to-analyze-app-reviews/',
      scores: { fit: 86, evidence: 80, action: 88 },
    },
    {
      name: 'Microsoft INFAR',
      role: '评论洞察抽取研究',
      takeaway: '强调评论需要跨时间和维度比较，适合做竞品反馈和版本变化分析。',
      sourceLabel: 'Microsoft Research',
      sourceUrl: 'https://www.microsoft.com/en-us/research/publication/infar-insight-extraction-from-app-reviews/',
      scores: { fit: 78, evidence: 90, action: 72 },
    },
    {
      name: 'UserCall Voice of Customer',
      role: 'VOC 反馈归因',
      takeaway: '适合把访谈、问卷、客服和评论统一成主题、需求、情绪和优先级。',
      sourceLabel: 'UserCall',
      sourceUrl: 'https://www.usercall.co/voice-of-customer-analysis',
      scores: { fit: 82, evidence: 76, action: 84 },
    },
  ],
  resource: [
    {
      name: '信息面试',
      role: '可访问的人',
      takeaway: '用 20 分钟低压力访谈验证岗位真实工作、行业入口和隐性门槛。',
      sourceLabel: 'BLS OOH',
      sourceUrl: 'https://www.bls.gov/ooh/',
      scores: { fit: 88, evidence: 72, action: 92 },
    },
    {
      name: '竞品评论区',
      role: '可观察的平台',
      takeaway: '从 App Store、Google Play、Reddit、小红书等评论里收集用户原话和抱怨频次。',
      sourceLabel: 'Appbot',
      sourceUrl: 'https://appbot.co/blog/how-to-analyze-app-reviews/',
      scores: { fit: 86, evidence: 82, action: 90 },
    },
    {
      name: '岗位 JD 反推',
      role: '现实入口',
      takeaway: '用招聘 JD 反推能力差距、作品集证据和第一批可申请岗位。',
      sourceLabel: 'BLS IT',
      sourceUrl: 'https://www.bls.gov/ooh/computer-and-information-technology/home.htm',
      scores: { fit: 84, evidence: 84, action: 88 },
    },
  ],
};

const OPPORTUNITY_COLORS = ['#86b8ff', '#6fc7b1', '#9d8cff', '#ffb86c', '#f5a6a6'];

const CUSTOM_CASE_TAKEAWAY_BY_MODE: Record<AnalysisType, string> = {
  product: '这是你提交的分析对象。当前会优先从功能、流程、机制和可迁移设计角度组织报告。',
  industry: '这是你提交的赛道或方向。当前会优先从趋势、玩家、商业模式和进入门槛角度组织报告。',
  career: '这是你提交的职业方向或岗位材料。当前会优先从路径可行性、能力门槛和入口证据角度组织报告。',
  feedback: '这是你提交的反馈材料。当前会优先从高频主题、情绪信号和真实需求角度组织报告。',
  resource: '这是你提交的资源线索。当前会优先从可访问的人、平台、案例和触达路线角度组织报告。',
};

const MODE_PRESETS: Record<AnalysisType, ModePreset> = {
  product: {
    defaultTopic: '治愈型游戏流程体验可以如何借鉴到行动力教练和行动日历？',
    summaryLabel: '分析样例',
    reportLabel: '产品视角报告',
    briefDeliverable: '结论、证据、案例矩阵、风险、行动卡',
    insightHeadline: '治愈型游戏可借鉴的核心不是可爱包装，而是把压力拆成可完成的小动作，并让用户看见自己正在恢复掌控感。',
    insightFocus: '看它们如何设置微目标、反馈节奏、失败成本、回访理由，以及用户愿意持续投入的情绪收益。',
    insightOpportunity: '行动日历可以从打卡表升级为个人成长场域：记录行动、收集证据、沉淀身份感和现实资源。',
    opportunityMap: [
      { label: '用户状态', value: '低能量、想改变但害怕被催促。', color: '#86b8ff' },
      { label: '可借鉴机制', value: '轻任务、收集、可视化进展、低失败成本。', color: '#6fc7b1' },
      { label: '产品切入点', value: '行动日历、教练记忆、贴纸奖励、资源地图。', color: '#9d8cff' },
      { label: '验证方式', value: '让用户连续 3 天记录，并观察是否愿意回看。', color: '#ffb86c' },
    ],
    risks: ['不要把游戏化做成新的任务压力，奖励应该服务于“看见自己”，不是催促用户连续打卡。'],
    experiments: ['先做 3 天小实验：每天记录一个行动碎片，生成一个贴纸和一句可回看的证据。', '观察用户是否愿意点击日历回看，以及是否能说出“我比前一天更清楚一点”。'],
    confidenceNotes: ['如果你想继续判断这个方向，下一步最好补 3 类证据：真实用户反馈、可持续回看的行为信号，以及用户愿不愿意为这种体验持续投入时间。', '我已经先帮你整理了可借鉴机制和初步判断，剩下最关键的是拿真实使用记录或访谈，确认这些判断在你的用户身上也成立。'],
  },
  industry: {
    defaultTopic: '如果要做陪伴低能量用户行动的产品，这个赛道的行业机会是否足够成立？',
    summaryLabel: '行业机会',
    reportLabel: '行业视角报告',
    briefDeliverable: '趋势判断、赛道结构、进入门槛、验证动作',
    insightHeadline: '行业机会分析的重点不是判断“热不热”，而是判断需求是否持续、竞争是否可进入、我们是否有独特切口。',
    insightFocus: '看市场趋势、关键玩家、商业模式、替代品、用户支付意愿和进入壁垒。',
    insightOpportunity: '如果陪伴型成长工具能连接职业、心理能量和现实资源，它可能站在多个赛道的交叉口，但需要验证谁最先愿意持续使用。',
    opportunityMap: [
      { label: '需求张力', value: '用户想改变，但现有工具常常只会催促而不会陪伴。', color: '#86b8ff' },
      { label: '竞争格局', value: '习惯养成、心理陪伴、职业教练都在切这块，但多半分散。', color: '#6fc7b1' },
      { label: '商业入口', value: '报告、订阅陪伴、职业转型工具包、企业员工支持服务。', color: '#9d8cff' },
      { label: '进入门槛', value: '难点在长期留存、可信内容和对真实职业路径的支撑。', color: '#ffb86c' },
    ],
    risks: ['不要把“行业趋势”误当成“用户一定会留存”。', '如果没有清晰细分人群，赛道判断会显得很大但无从进入。'],
    experiments: ['先选一个最具体的人群场景，验证他们是否愿意持续记录和回看。', '比较 3 个相邻赛道产品，提炼出真正未被满足的部分。'],
    confidenceNotes: ['如果你准备认真判断这个赛道，下一步要补的是更具体的外部信号：目标人群是否持续存在、同类产品怎么切入、以及这个方向有没有清晰的进入位置。', '我已经先把可讨论的趋势和结构整理出来了，剩下最值得补的是用户需求强度、竞争切口和商业成立条件。'],
  },
  career: {
    defaultTopic: '如果一个人想转向更适合自己的职业方向，这条路径的现实可行性如何判断？',
    summaryLabel: '职业前景',
    reportLabel: '职业路径报告',
    briefDeliverable: '岗位路径、技能门槛、转型入口、搜索策略',
    insightHeadline: '职业前景分析要回答的不是“这个岗位听起来好不好”，而是“这条路径对这个用户现在是否进得去”。',
    insightFocus: '看岗位名称分布、能力要求、经验门槛、作品证据、城市机会和替代路径。',
    insightOpportunity: '如果用户的天赋、行动记录和愿景能指向一条更窄的职业路径，咨询工具就能帮助他更快判断该投哪里、补什么、怎么验证。',
    opportunityMap: [
      { label: '方向适配', value: '结合天赋报告、记忆和近期行动，先缩小到 1-2 条职业主线。', color: '#86b8ff' },
      { label: '岗位入口', value: '同一能力常以不同岗位名出现，不能只搜一种名称。', color: '#6fc7b1' },
      { label: '证据要求', value: '市场更看重作品、案例和表达出的理解，而不是空泛兴趣。', color: '#9d8cff' },
      { label: '验证方式', value: '通过 JD、公司官网和从业者访谈判断路径是否现实。', color: '#ffb86c' },
    ],
    risks: ['不要把单个 JD 的要求误认为整个路径的统一标准。', '职业转型的真实门槛常藏在作品和经历证据里。'],
    experiments: ['收集 5 条岗位样本，找出高频能力要求。', '为最想去的路径写一版作品证据清单，再看还差什么。'],
    confidenceNotes: ['如果你要把这条职业路径判断得更准，下一步要补的是 5 条左右真实岗位样本，看看岗位名、能力要求和作品证据到底反复出现什么。', '我已经先帮你缩小了判断范围，接下来最需要你补的是城市、薪资、年限和岗位真实存在感这些现实信号。'],
  },
  feedback: {
    defaultTopic: '如果我们要理解低能量用户真正卡住的地方，应该怎样分析真实反馈？',
    summaryLabel: '反馈洞察',
    reportLabel: '用户反馈报告',
    briefDeliverable: '主题聚类、情绪信号、需求判断、优先级动作',
    insightHeadline: '用户反馈分析的价值不在于“收集很多评论”，而在于从原话里看出高频痛点、情绪张力和真正阻碍行动的场景。',
    insightFocus: '看评论、访谈、问卷、社群讨论中的重复主题、原话力度和场景差异。',
    insightOpportunity: '如果能把用户的真实语言转成明确问题陈述，行动力教练和咨询工具就能更少自说自话，更贴近真实卡点。',
    opportunityMap: [
      { label: '高频主题', value: '优先看重复出现的困惑，而不是最尖锐的一条。', color: '#86b8ff' },
      { label: '情绪信号', value: '分清失落、害怕、疲惫、犹豫，它们对应不同支持方式。', color: '#6fc7b1' },
      { label: '需求层次', value: '用户可能要的不是更多建议，而是更轻的启动条件。', color: '#9d8cff' },
      { label: '产品机会', value: '把反馈转成微动作、回看机制和证据沉淀。', color: '#ffb86c' },
    ],
    risks: ['不要只看最热闹的平台评论，容易放大极端声音。', '脱离原话做总结，容易把真实需求磨平。'],
    experiments: ['收集 20 条原话并按主题分类。', '对比“用户说自己想要的”和“真实抱怨的场景”是否一致。'],
    confidenceNotes: ['如果你想让这份反馈分析更扎实，下一步要补的是更多原话样本，并分清它们来自什么用户、什么时间、什么场景。', '我已经先帮你整理出问题结构，接下来最值得补的是高频主题到底有多高频，以及哪些声音只是个别样本。'],
  },
  resource: {
    defaultTopic: '如果用户想把模糊方向落到现实世界，我们可以怎样帮他梳理一张资源地图？',
    summaryLabel: '资源地图',
    reportLabel: '资源路径报告',
    briefDeliverable: '资源清单、触达路径、外部线索、低成本试探动作',
    insightHeadline: '资源地图分析的核心不是列很多渠道，而是帮用户看见哪些人、平台、案例和入口是他现在就够得到的。',
    insightFocus: '看可访问的人、平台、社群、案例库、招聘入口、公司官网和低门槛试探路径。',
    insightOpportunity: '当用户被困在“我不知道下一步找谁、看哪、问什么”时，资源地图能把方向感转成现实接触面。',
    opportunityMap: [
      { label: '可接近的人', value: '前同事、朋友的朋友、社群里的从业者、信息访谈对象。', color: '#86b8ff' },
      { label: '可观察的平台', value: '招聘网站、公司官网、评论区、作品平台、论坛和小众社区。', color: '#6fc7b1' },
      { label: '可复制的案例', value: '选择 3 个最接近的路径样本，反推他们是怎样开始的。', color: '#9d8cff' },
      { label: '触达动作', value: '把资源地图转成一周内能执行的 2-3 次现实接触。', color: '#ffb86c' },
    ],
    risks: ['资源太多会让用户再次失焦，地图需要有优先级。', '只收藏不接触，资源地图会重新变成信息焦虑。'],
    experiments: ['先建立一个 3x3 的资源表：人、平台、案例各 3 个。', '为每类资源写一个最小触达动作，比如私信、搜索、记录或访谈。'],
    confidenceNotes: ['如果你想让这张资源地图真的能用，下一步要补的是优先级：哪些资源你这周就够得到，哪些只是先收藏。', '我已经先把路径和入口帮你摊开了，剩下最需要补的是具体联系人、平台时效性和实际触达结果。'],
  },
};

export default function ConsultingAnalysisToolPage() {
  const [activeMode, setActiveMode] = useState<AnalysisType>('product');
  const [topic, setTopic] = useState(MODE_PRESETS.product.defaultTopic);
  const [customCase, setCustomCase] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [submittedTopic, setSubmittedTopic] = useState(MODE_PRESETS.product.defaultTopic);
  const [submittedCase, setSubmittedCase] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSucceeded, setAnalysisSucceeded] = useState(false);
  const [analysisStage, setAnalysisStage] = useState('');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [providerNote, setProviderNote] = useState<string | null>(null);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [careerTarget, setCareerTarget] = useState('');
  const [careerCity, setCareerCity] = useState('');
  const [workStyle, setWorkStyle] = useState('不限，可接受远程或混合办公');
  const [pastedJobs, setPastedJobs] = useState('');
  const [userContext, setUserContext] = useState<Record<string, unknown>>({});
  const [opportunityReport, setOpportunityReport] = useState<OpportunityReport | null>(null);
  const [isSearchingOpportunity, setIsSearchingOpportunity] = useState(false);
  const [opportunityStage, setOpportunityStage] = useState('');
  const [opportunityError, setOpportunityError] = useState<string | null>(null);
  const [opportunityProviderNote, setOpportunityProviderNote] = useState<string | null>(null);
  const [viewportMode, setViewportMode] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [lastPresetTopic, setLastPresetTopic] = useState(MODE_PRESETS.product.defaultTopic);
  const lastPresetTopicRef = useRef(MODE_PRESETS.product.defaultTopic);
  const active = useMemo(() => ANALYSIS_MODES.find((mode) => mode.id === activeMode) || ANALYSIS_MODES[0], [activeMode]);
  const activePreset = MODE_PRESETS[activeMode];
  const isCompact = viewportMode === 'mobile';
  const isTablet = viewportMode === 'tablet';
  const baseCases = CASES_BY_MODE[activeMode];
  const reportCases = useMemo(() => {
    if (report?.cases?.length) {
      return report.cases.map((item) => ({
        name: item.name,
        role: item.role,
        takeaway: item.takeaway,
        sourceLabel: '模型分析',
        sourceUrl: '',
        scores: { fit: item.fit, evidence: item.evidence, action: item.action },
      }));
    }
    if (!submittedCase.trim()) return baseCases;
    return [
      {
        name: submittedCase.trim(),
        role: '自定义分析对象',
        takeaway: CUSTOM_CASE_TAKEAWAY_BY_MODE[activeMode],
        sourceLabel: '自定义',
        sourceUrl: '',
        scores: { fit: 76, evidence: 42, action: 82 },
      },
      ...baseCases.slice(0, 2),
    ];
  }, [activeMode, baseCases, report, submittedCase]);
  const renderedOpportunityMap = report?.opportunityMap?.length
    ? report.opportunityMap.map((item, index) => ({ ...item, color: OPPORTUNITY_COLORS[index % OPPORTUNITY_COLORS.length] }))
    : activePreset.opportunityMap;
  const renderedRisks = report?.risks?.length
    ? report.risks
    : activePreset.risks;
  const renderedExperiments = report?.nextExperiments?.length
    ? report.nextExperiments
    : activePreset.experiments;
  const renderedEvidenceSources = report?.evidenceSources?.length
    ? report.evidenceSources
    : buildDefaultEvidenceSources({ customCase: submittedCase, referenceCases: baseCases, userContext });
  const renderedActionCards = report?.actionCards?.length
    ? report.actionCards
    : buildDefaultActionCards(activeMode);
  const renderedConfidenceNotes = report?.confidenceNotes?.length
    ? report.confidenceNotes
    : activePreset.confidenceNotes;
  const renderedExecutiveBrief = report?.executiveBrief?.length
    ? report.executiveBrief
    : buildDefaultExecutiveBrief(activeMode, report?.researchFocus || activePreset.insightFocus, report?.opportunity || activePreset.insightOpportunity);
  const renderedNarrative = report?.analysisNarrative?.length
    ? report.analysisNarrative
    : buildDefaultNarrative(activeMode, report?.researchFocus || activePreset.insightFocus, report?.opportunity || activePreset.insightOpportunity, renderedRisks);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateLayout = () => {
      if (window.innerWidth < 760) {
        setViewportMode('mobile');
      } else if (window.innerWidth < 1180) {
        setViewportMode('tablet');
      } else {
        setViewportMode('desktop');
      }
    };
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  useEffect(() => {
    const context = readUserCareerContext();
    setUserContext(context);
    setCareerTarget((current) => current || inferTargetFromContext(context));
    setCareerCity((current) => current || inferCityFromContext(context));
  }, []);

  useEffect(() => {
    const nextDefaultTopic = activePreset.defaultTopic;
    setSubmittedTopic(nextDefaultTopic);
    setReport(null);
    setAnalysisError(null);
    setProviderNote(null);
    setAnalysisSucceeded(false);
    setCustomCase('');
    setUploadedFileName('');
    setTopic((current) => (!current.trim() || current === lastPresetTopicRef.current ? nextDefaultTopic : current));
    setLastPresetTopic(nextDefaultTopic);
    lastPresetTopicRef.current = nextDefaultTopic;
  }, [activePreset.defaultTopic]);

  const submitAnalysis = async () => {
    const nextTopic = topic.trim() || '请补充这次想分析的问题。';
    const nextCase = customCase.trim();
    setSubmittedTopic(nextTopic);
    setSubmittedCase(nextCase);
    setHasSubmitted(true);
    setIsAnalyzing(true);
    setAnalysisSucceeded(false);
    setAnalysisStage('连接模型');
    setAnalysisError(null);
    setProviderNote(null);
    setReport(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 18000);
    const stageTimer = window.setTimeout(() => setAnalysisStage('整理结构化报告'), 4500);
    try {
      const res = await fetch('/api/coach/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          analysisType: activeMode,
          topic: nextTopic,
          customCase: nextCase,
          referenceCases: baseCases.map(({ name, role, takeaway }) => ({ name, role, takeaway })),
          userContext,
        }),
      });
      const data = await readApiJson<AnalysisApiResponse>(res);
      if (!res.ok) throw new Error(data?.error || '分析接口请求失败');
      setReport(data.report || null);
      setProviderNote(data.providerNote || (data.provider ? `模型：${data.provider}` : null));
      setAnalysisSucceeded(true);
    } catch (error: unknown) {
      const message = isAbortError(error) ? '模型响应超时，已停止本次请求。可以稍后重试，或缩短分析问题。' : getErrorMessage(error, '分析失败，请稍后重试。');
      setAnalysisError(message);
    } finally {
      window.clearTimeout(timeout);
      window.clearTimeout(stageTimer);
      setIsAnalyzing(false);
      setAnalysisStage('');
    }
  };

  const handleMaterialFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^text\/|json|csv|markdown/.test(file.type) && !/\.(txt|md|csv|json)$/i.test(file.name)) {
      setUploadedFileName('');
      setAnalysisError('当前版本先支持 txt、md、csv、json 文本文件。PDF 和图片需要后续接解析器。');
      return;
    }
    setUploadedFileName(file.name);
    setAnalysisError(null);
    const text = await file.text();
    setCustomCase((prev) => [prev, `文件：${file.name}\n${text.slice(0, 5000)}`].filter(Boolean).join('\n\n'));
  };

  const submitOpportunitySearch = async () => {
    const target = careerTarget.trim() || topic.trim() || '职业机会方向';
    setIsSearchingOpportunity(true);
    setOpportunityStage('读取画像并生成搜索策略');
    setOpportunityError(null);
    setOpportunityProviderNote(null);
    setOpportunityReport(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 22000);
    const stageTimer = window.setTimeout(() => setOpportunityStage('分析岗位路径和渠道'), 6000);
    try {
      const res = await fetch('/api/coach/opportunity-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          target,
          city: careerCity,
          workStyle,
          pastedJobs,
          userContext,
        }),
      });
      const data = await readApiJson<OpportunityApiResponse>(res);
      if (!res.ok) throw new Error(data?.error || '职业机会搜索失败');
      setOpportunityReport(data.report || null);
      setOpportunityProviderNote(data.providerNote || (data.provider ? `模型：${data.provider}` : null));
    } catch (error: unknown) {
      const message = isAbortError(error) ? '职业机会分析超时，已停止本次请求。建议先粘贴更短的 JD 样本再试。' : getErrorMessage(error, '职业机会搜索失败，请稍后重试。');
      setOpportunityError(message);
    } finally {
      window.clearTimeout(timeout);
      window.clearTimeout(stageTimer);
      setIsSearchingOpportunity(false);
      setOpportunityStage('');
    }
  };

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#F3F8FF 0%, #FFFFFF 55%, #F7FBFF 100%)' }}>
      <div style={{ maxWidth: isTablet ? 1024 : 1160, margin: '0 auto', padding: isTablet ? '20px 18px 32px' : '22px 18px 36px' }}>
        <header style={{ display: 'flex', alignItems: isTablet ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/coach/action" aria-label="返回行动力教练" style={iconButtonStyle}>
              <ArrowLeft size={16} strokeWidth={2.2} />
            </Link>
            <div>
              <span style={kickerStyle}>Consulting Toolbox</span>
              <h1 style={{ marginTop: 5, fontSize: isTablet ? 22 : 24, fontWeight: 900, color: '#0f172a' }}>咨询分析工具箱</h1>
            </div>
          </div>
        </header>
        {isCompact && (
          <div style={mobileNoticeStyle}>
            <BriefcaseBusiness size={15} strokeWidth={2.2} />
            <span>推荐使用电脑端体验完整功能。</span>
          </div>
        )}

        <section style={{ marginTop: 18, display: 'grid', gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : isTablet ? '280px minmax(0, 1fr)' : '260px minmax(0, 1fr) 300px', gap: isTablet ? 14 : 16, alignItems: 'start' }}>
          <aside style={{ ...panelStyle, alignSelf: 'start', display: isCompact ? 'none' : 'block' }}>
            <div style={kickerStyle}>分析类型</div>
            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              {ANALYSIS_MODES.map((mode) => {
                const Icon = mode.icon;
                const selected = activeMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setActiveMode(mode.id)}
                    style={{
                      ...modeButtonStyle,
                      background: selected ? 'rgba(134,184,255,0.16)' : 'rgba(255,255,255,0.62)',
                      borderColor: selected ? 'rgba(116,169,255,0.42)' : 'rgba(134,184,255,0.16)',
                    }}
                  >
                    <span style={modeIconStyle}><Icon size={16} strokeWidth={2.2} /></span>
                    <span style={{ textAlign: 'left', minWidth: 0 }}>
                      <span style={{ display: 'block', color: '#1f3b5f', fontSize: 13, fontWeight: 900 }}>{mode.title}</span>
                      <span style={{ display: 'block', marginTop: 2, color: 'rgba(74,104,140,0.58)', fontSize: 11, lineHeight: 1.35 }}>{mode.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <Link href="/coach/action/tools/opportunity-search" style={{ marginTop: 12, ...toolboxLinkStyle }}>
              <span style={modeIconStyle}><BriefcaseBusiness size={16} strokeWidth={2.2} /></span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', color: '#1f3b5f', fontSize: 13, fontWeight: 900 }}>岗位聚合搜索</span>
                <span style={{ display: 'block', marginTop: 2, color: 'rgba(74,104,140,0.58)', fontSize: 11, lineHeight: 1.35 }}>按偏好匹配岗位、生成搜索入口和验证动作</span>
              </span>
            </Link>

            <div style={{ marginTop: 16 }}>
              <div style={kickerStyle}>本次分析问题</div>
              <textarea
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                rows={5}
                style={textareaStyle}
              />
              <textarea
                value={customCase}
                onChange={(event) => setCustomCase(event.target.value)}
                rows={4}
                placeholder="可选：粘贴链接、JD、网页摘要、评论、访谈记录或其他分析材料"
                style={{ ...textareaStyle, minHeight: 104 }}
              />
              <label style={uploadStyle}>
                <FileSearch size={15} strokeWidth={2.2} />
                <span>{uploadedFileName ? `已添加：${uploadedFileName}` : '上传文本附件'}</span>
                <input type="file" accept=".txt,.md,.csv,.json,text/*,application/json" onChange={handleMaterialFile} style={{ display: 'none' }} />
              </label>
              <button
                type="button"
                onClick={submitAnalysis}
                disabled={isAnalyzing}
                style={{
                  ...submitButtonStyle,
                  opacity: isAnalyzing ? 0.78 : 1,
                  background: analysisSucceeded && !analysisError
                    ? 'linear-gradient(180deg, rgba(111,199,177,0.30) 0%, rgba(111,199,177,0.18) 100%)'
                    : submitButtonStyle.background,
                  border: analysisSucceeded && !analysisError ? '1px solid rgba(111,199,177,0.34)' : submitButtonStyle.border,
                }}
              >
                {isAnalyzing ? (
                  <span className="analysis-spinner" aria-hidden="true" />
                ) : analysisSucceeded && !analysisError ? (
                  <CheckCircle2 size={15} strokeWidth={2.2} />
                ) : (
                  <FileSearch size={15} strokeWidth={2.2} />
                )}
                <span>{isAnalyzing ? '分析中' : analysisSucceeded && !analysisError ? '分析成功' : analysisError ? '重试生成' : '生成报告'}</span>
              </button>
              {hasSubmitted && (
                <div style={{ marginTop: 9, color: 'rgba(74,104,140,0.62)', fontSize: 12, lineHeight: 1.55 }}>
                  {isAnalyzing ? `${analysisStage || '分析中'}，通常需要 5-15 秒。` : providerNote || '已生成当前报告。'}
                </div>
              )}
              {analysisError && <div style={{ marginTop: 8, color: '#ef4444', fontSize: 12 }}>{analysisError}</div>}
            </div>

            <div style={{ marginTop: 16, ...briefBoxStyle }}>
              <PanelTitle icon={Compass} title="项目简报" />
              <ContextLine label="分析对象" value={active.title} />
              <ContextLine label="材料状态" value={customCase.trim() || uploadedFileName ? '已有用户补充材料' : '当前使用预置案例和本地记忆'} />
              <ContextLine label="交付形式" value={activePreset.briefDeliverable} />
            </div>
          </aside>

          {isCompact && (
            <details style={mobileDetailsStyle}>
              <summary style={mobileSummaryStyle}>
                <span>分析设置与材料</span>
                <span style={evidenceCountStyle}>{active.title}</span>
              </summary>
              <div style={{ marginTop: 12 }}>
                <div style={kickerStyle}>分析类型</div>
                <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                  {ANALYSIS_MODES.map((mode) => {
                    const Icon = mode.icon;
                    const selected = activeMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setActiveMode(mode.id)}
                        style={{
                          ...modeButtonStyle,
                          background: selected ? 'rgba(134,184,255,0.16)' : 'rgba(255,255,255,0.62)',
                          borderColor: selected ? 'rgba(116,169,255,0.42)' : 'rgba(134,184,255,0.16)',
                        }}
                      >
                        <span style={modeIconStyle}><Icon size={16} strokeWidth={2.2} /></span>
                        <span style={{ textAlign: 'left', minWidth: 0 }}>
                          <span style={{ display: 'block', color: '#1f3b5f', fontSize: 13, fontWeight: 900 }}>{mode.title}</span>
                          <span style={{ display: 'block', marginTop: 2, color: 'rgba(74,104,140,0.58)', fontSize: 11, lineHeight: 1.35 }}>{mode.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ marginTop: 16 }}>
                  <div style={kickerStyle}>本次分析问题</div>
                  <textarea value={topic} onChange={(event) => setTopic(event.target.value)} rows={4} style={textareaStyle} />
                  <textarea
                    value={customCase}
                    onChange={(event) => setCustomCase(event.target.value)}
                    rows={3}
                    placeholder="可选：粘贴链接、JD、网页摘要、评论、访谈记录或其他分析材料"
                    style={{ ...textareaStyle, minHeight: 92 }}
                  />
                  <label style={uploadStyle}>
                    <FileSearch size={15} strokeWidth={2.2} />
                    <span>{uploadedFileName ? `已添加：${uploadedFileName}` : '上传文本附件'}</span>
                    <input type="file" accept=".txt,.md,.csv,.json,text/*,application/json" onChange={handleMaterialFile} style={{ display: 'none' }} />
                  </label>
                  <button
                    type="button"
                    onClick={submitAnalysis}
                    disabled={isAnalyzing}
                    style={{
                      ...submitButtonStyle,
                      opacity: isAnalyzing ? 0.78 : 1,
                      background: analysisSucceeded && !analysisError
                        ? 'linear-gradient(180deg, rgba(111,199,177,0.30) 0%, rgba(111,199,177,0.18) 100%)'
                        : submitButtonStyle.background,
                      border: analysisSucceeded && !analysisError ? '1px solid rgba(111,199,177,0.34)' : submitButtonStyle.border,
                    }}
                  >
                    {isAnalyzing ? <span className="analysis-spinner" aria-hidden="true" /> : analysisSucceeded && !analysisError ? <CheckCircle2 size={15} strokeWidth={2.2} /> : <FileSearch size={15} strokeWidth={2.2} />}
                    <span>{isAnalyzing ? '分析中' : analysisSucceeded && !analysisError ? '分析成功' : analysisError ? '重试生成' : '生成报告'}</span>
                  </button>
                  {hasSubmitted && (
                    <div style={{ marginTop: 9, color: 'rgba(74,104,140,0.62)', fontSize: 12, lineHeight: 1.55 }}>
                      {isAnalyzing ? `${analysisStage || '分析中'}，通常需要 5-15 秒。` : providerNote || '已生成当前报告。'}
                    </div>
                  )}
                  {analysisError && <div style={{ marginTop: 8, color: '#ef4444', fontSize: 12 }}>{analysisError}</div>}
                </div>
              </div>
            </details>
          )}

          <section style={{ ...panelStyle, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={kickerStyle}>{activePreset.summaryLabel}</div>
                <h2 style={{ marginTop: 5, fontSize: 22, fontWeight: 900, color: '#1f3b5f' }}>{active.title}</h2>
                <p style={{ marginTop: 6, maxWidth: 620, color: 'rgba(62,79,106,0.70)', fontSize: 13, lineHeight: 1.75 }}>
                  {submittedTopic}
                </p>
              </div>
              <span style={badgeStyle}>
                <FileSearch size={14} />
                <span>{report ? activePreset.reportLabel : '参考报告'}</span>
              </span>
            </div>

            <div style={{ marginTop: 16, ...reportHeroStyle }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={kickerStyle}>核心判断</div>
                  <h3 style={{ marginTop: 6, color: '#17345c', fontSize: 16, lineHeight: 1.7, fontWeight: 700 }}>
                    {report?.headline || activePreset.insightHeadline}
                  </h3>
                </div>
                <span style={{ ...badgeStyle, background: 'rgba(255,255,255,0.48)' }}>
                  <Sparkles size={14} />
                  <span>{report ? '已生成报告正文' : '正在显示参考报告'}</span>
                </span>
              </div>
              <p style={{ marginTop: 14, color: 'rgba(31,59,95,0.78)', fontSize: 14, lineHeight: 1.8 }}>
                {report?.summary || activePreset.insightOpportunity}
              </p>
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
                {renderedExecutiveBrief.map((item) => (
                  <MiniMetricCard
                    key={item.label}
                    title={item.label}
                    content={item.value}
                    icon={item.label.includes('机会') ? Compass : Search}
                  />
                ))}
              </div>
            </div>

            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : '1.15fr 0.85fr', gap: 14 }}>
              <div style={miniPanelStyle}>
                <PanelTitle icon={Lightbulb} title="具体判断" />
                <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                  {renderedOpportunityMap.map((item) => (
                    <div key={item.label} style={judgementRowStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ ...judgementDotStyle, background: item.color }} />
                        <span style={{ color: '#1f3b5f', fontSize: 13, fontWeight: 900 }}>{item.label}</span>
                      </div>
                      <p style={{ margin: '4px 0 0', color: 'rgba(62,79,106,0.74)', fontSize: 13, lineHeight: 1.7 }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div style={miniPanelStyle}>
                <PanelTitle icon={ShieldAlert} title="为什么这样判断" />
                <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                  {renderedEvidenceSources.slice(0, 4).map((item, index) => (
                    <div key={`${item.sourceType}-${item.sourceName}-${index}-reason`} style={reasonRowStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <span style={sourceTypeStyle}>{item.sourceType}</span>
                        <span style={{ color: 'rgba(31,59,95,0.84)', fontSize: 12, fontWeight: 900 }}>{item.sourceName}</span>
                      </div>
                      <p style={{ margin: '6px 0 0', color: 'rgba(62,79,106,0.72)', fontSize: 12, lineHeight: 1.65 }}>{item.usedFor}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, ...miniPanelStyle }}>
              <PanelTitle icon={FileSearch} title="分析展开" />
              <div style={{ marginTop: 14, display: 'grid', gap: 16 }}>
                {renderedNarrative.map((section) => (
                  <NarrativeSection key={section.title} title={section.title} content={section.paragraph} />
                ))}
              </div>
            </div>

            <div style={{ marginTop: 14, ...miniPanelStyle }}>
              <PanelTitle icon={Layers3} title="参考案例怎么借" />
              <div style={{ marginTop: 6, color: 'rgba(62,79,106,0.68)', fontSize: 12, lineHeight: 1.65 }}>
                这里不是简单打分，而是把每个案例真正值得借的部分、不要照搬的部分，以及它对你这次分析的启发拆开来看。
              </div>
              <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                {reportCases.map((item) => (
                  <div key={item.name} style={caseRowStyle(isCompact)}>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <div>
                        <div style={{ color: '#1f3b5f', fontSize: 13, fontWeight: 900 }}>{item.name}</div>
                        <div style={{ marginTop: 2, color: 'rgba(74,104,140,0.58)', fontSize: 11 }}>{item.role}</div>
                        {item.sourceUrl ? (
                          <a href={item.sourceUrl} target="_blank" rel="noreferrer" style={sourceLinkStyle}>{item.sourceLabel}</a>
                        ) : (
                          <span style={sourceLinkStyle}>{item.sourceLabel}</span>
                        )}
                      </div>
                      <CaseTakeaway text={item.takeaway} />
                    </div>
                    <div style={{ display: 'grid', gap: 10 }}>
                      <CaseAnalysisBlock
                        label="可借鉴点"
                        content={buildCaseLens(activeMode, item, 'borrow')}
                        tone="positive"
                      />
                      <CaseAnalysisBlock
                        label="不要直接照搬"
                        content={buildCaseLens(activeMode, item, 'avoid')}
                        tone="warning"
                      />
                      <CaseAnalysisBlock
                        label="对这次分析的启发"
                        content={buildCaseLens(activeMode, item, 'apply')}
                        tone="neutral"
                      />
                    </div>
                    <div style={caseScorePanelStyle}>
                      <div style={{ color: '#1f3b5f', fontSize: 12, fontWeight: 900 }}>辅助参考</div>
                      <div style={{ marginTop: 9, display: 'grid', gap: 8 }}>
                        <ScoreBar label="适配度" value={item.scores.fit} color="#86b8ff" />
                        <ScoreBar label="证据强度" value={item.scores.evidence} color="#6fc7b1" />
                        <ScoreBar label="可行动" value={item.scores.action} color="#9d8cff" />
                      </div>
                      <div style={{ marginTop: 8, color: 'rgba(74,104,140,0.58)', fontSize: 11, lineHeight: 1.55 }}>
                        分数只是辅助你快速排序，真正有用的是左侧的具体分析。
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
              <div style={miniPanelStyle}>
                <PanelTitle icon={ShieldAlert} title="主要风险" />
                <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                  {renderedRisks.map((item) => <Bullet key={`risk-${item}`}>{item}</Bullet>)}
                </div>
              </div>

              <div style={miniPanelStyle}>
                <PanelTitle icon={Sparkles} title="建议先做的验证动作" />
                <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                  {renderedExperiments.map((item) => <Bullet key={`experiment-${item}`}>{item}</Bullet>)}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, ...miniPanelStyle }}>
              <PanelTitle icon={CheckCircle2} title="可放回行动日历的行动卡" />
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
                {renderedActionCards.map((card) => <ActionCard key={card.title} card={card} />)}
              </div>
            </div>

            <div style={{ marginTop: 14, ...miniPanelStyle }}>
              <PanelTitle icon={ShieldAlert} title="接下来还要补什么" />
              <div style={{ marginTop: 12, display: 'grid', gap: 9 }}>
              {renderedConfidenceNotes.map((item) => <Bullet key={item}>{item}</Bullet>)}
              </div>
            </div>
          </section>

          <aside style={{ ...panelStyle, position: isTablet ? 'static' : isCompact ? 'static' : 'sticky', top: 18, alignSelf: 'start', display: isCompact ? 'none' : 'block', gridColumn: isTablet ? '1 / -1' : 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <PanelTitle icon={FileSearch} title="证据来源" />
              <span style={evidenceCountStyle}>{renderedEvidenceSources.length} 条</span>
            </div>
            <p style={{ margin: '9px 0 0', color: 'rgba(62,79,106,0.66)', fontSize: 12, lineHeight: 1.65 }}>
              这里会把每条判断背后的依据摊开给你看，方便你分清哪些已经比较扎实，哪些还要继续确认。
            </p>
            <div style={{ marginTop: 12, display: 'grid', gap: 9, gridTemplateColumns: isTablet ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)' }}>
              {renderedEvidenceSources.map((item, index) => (
                <EvidenceSource key={`${item.sourceType}-${item.sourceName}-${index}`} source={item} />
              ))}
            </div>

            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: isTablet ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)', gap: 14 }}>
              <div style={briefBoxStyle}>
                <PanelTitle icon={ShieldAlert} title="待验证项" />
                <div style={{ marginTop: 10, display: 'grid', gap: 9 }}>
                  {renderedRisks.slice(0, 3).map((item) => <Bullet key={`side-risk-${item}`}>{item}</Bullet>)}
                </div>
              </div>

              <div style={briefBoxStyle}>
                <PanelTitle icon={CheckCircle2} title="还建议补的证据" />
                <div style={{ marginTop: 10, display: 'grid', gap: 9 }}>
                  {renderedConfidenceNotes.slice(0, 3).map((item) => <Bullet key={`side-note-${item}`}>{item}</Bullet>)}
                </div>
              </div>
            </div>
          </aside>

          {isCompact && (
            <details style={mobileDetailsStyle}>
              <summary style={mobileSummaryStyle}>
                <span>证据来源与可信度</span>
                <span style={evidenceCountStyle}>{renderedEvidenceSources.length} 条</span>
              </summary>
              <div style={{ marginTop: 12, display: 'grid', gap: 9 }}>
                {renderedEvidenceSources.map((item, index) => (
                  <EvidenceSource key={`${item.sourceType}-${item.sourceName}-mobile-${index}`} source={item} />
                ))}
              </div>
              <div style={{ marginTop: 14, ...briefBoxStyle }}>
                <PanelTitle icon={ShieldAlert} title="待验证项" />
                <div style={{ marginTop: 10, display: 'grid', gap: 9 }}>
                  {renderedRisks.slice(0, 3).map((item) => <Bullet key={`mobile-risk-${item}`}>{item}</Bullet>)}
                </div>
              </div>
            </details>
          )}
        </section>
        {activeMode === 'career' && (
          <section style={{ marginTop: 16, ...panelStyle }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <div style={kickerStyle}>Career Search</div>
                <h2 style={{ marginTop: 5, fontSize: 20, fontWeight: 900, color: '#1f3b5f' }}>职业可行性搜索</h2>
                <p style={{ marginTop: 6, maxWidth: 680, color: 'rgba(62,79,106,0.70)', fontSize: 13, lineHeight: 1.75 }}>
                  把你想尝试的方向、地点和工作方式先放进来，我们再一起判断这条路径在现实里是否走得通。
                </p>
              </div>
              <span style={badgeStyle}><BriefcaseBusiness size={14} />职业方向判断</span>
            </div>

            <div style={{ marginTop: 14, ...miniPanelStyle }}>
              <PanelTitle icon={UsersRound} title="先缩小你要搜索的条件" />
              <p style={{ margin: '8px 0 0', color: 'rgba(62,79,106,0.66)', fontSize: 12, lineHeight: 1.6 }}>
                条件越具体，后面的岗位判断、搜索词和验证动作就越接近现实。
              </p>
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <input value={careerTarget} onChange={(event) => setCareerTarget(event.target.value)} placeholder="想试的方向，例如 AI 产品经理 / 游戏体验设计 / 用户研究" style={inputStyle} />
                  <input value={careerCity} onChange={(event) => setCareerCity(event.target.value)} placeholder="地点，例如 上海 / 北京 / 远程 / 海外" style={inputStyle} />
                  <input value={workStyle} onChange={(event) => setWorkStyle(event.target.value)} placeholder="工作方式偏好，例如 远程 / 稳定团队 / 初创 / 自由职业" style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <textarea value={pastedJobs} onChange={(event) => setPastedJobs(event.target.value)} rows={7} placeholder="可选：贴一段 JD、岗位链接、招聘帖或公司 careers 文本。样本越接近真实，判断越具体。" style={{ ...textareaStyle, minHeight: 148, marginTop: 0 }} />
                  <button type="button" onClick={submitOpportunitySearch} disabled={isSearchingOpportunity} style={{ ...submitButtonStyle, marginTop: 0, opacity: isSearchingOpportunity ? 0.72 : 1 }}>
                    {isSearchingOpportunity ? <span className="analysis-spinner" aria-hidden="true" /> : <Search size={15} strokeWidth={2.2} />}
                    <span>{isSearchingOpportunity ? '分析职业机会中' : '分析职业机会'}</span>
                  </button>
                  {(isSearchingOpportunity || opportunityProviderNote) && <div style={{ color: 'rgba(74,104,140,0.62)', fontSize: 12 }}>{isSearchingOpportunity ? `${opportunityStage || '分析职业机会中'}，通常需要 8-20 秒。` : opportunityProviderNote}</div>}
                  {opportunityError && <div style={{ color: '#ef4444', fontSize: 12 }}>{opportunityError}</div>}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 14 }}>
              <div style={miniPanelStyle}>
                <PanelTitle icon={Network} title="我们已经知道的背景" />
                <ContextLine label="天赋报告" value={String(userContext.reportSummary || '暂时还没有可用内容')} />
                <ContextLine label="身份愿景" value={String(userContext.visionSummary || '暂时还没有可用内容')} />
                <ContextLine label="最近行动" value={String(userContext.recentAction || '暂时还没有可用内容')} />
                <ContextLine label="教练记忆" value={String(userContext.memorySummary || '暂时还没有可用内容')} />
              </div>

              <div style={miniPanelStyle}>
                <PanelTitle icon={Lightbulb} title="这一步会帮你看什么" />
                <div style={{ marginTop: 10, display: 'grid', gap: 9 }}>
                  <Bullet>哪些岗位名称和路径最接近你现在的状态。</Bullet>
                  <Bullet>它们通常要求什么能力、作品和经验。</Bullet>
                  <Bullet>下一步该优先搜什么、问谁、补哪块证据。</Bullet>
                </div>
              </div>
            </div>

            {opportunityReport && (
              <div style={{ marginTop: 14, display: 'grid', gap: 14 }}>
                <div style={miniPanelStyle}>
                  <PanelTitle icon={Lightbulb} title="路径可行性判断" />
                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: isCompact || isTablet ? 'minmax(0, 1fr)' : '120px minmax(0, 1fr)', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 96, height: 96, borderRadius: 999, background: 'rgba(134,184,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1f3b5f', fontSize: 24, fontWeight: 900 }}>
                      {opportunityReport.feasibilityScore}
                    </div>
                    <div>
                      <p style={{ margin: 0, color: 'rgba(62,79,106,0.78)', fontSize: 13, lineHeight: 1.7 }}>{opportunityReport.profileSummary}</p>
                      <p style={{ marginTop: 8, color: '#1f3b5f', fontSize: 14, lineHeight: 1.7, fontWeight: 800 }}>{opportunityReport.pathVerdict}</p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
                  <div style={miniPanelStyle}>
                    <PanelTitle icon={Search} title="建议先搜这些词" />
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {opportunityReport.searchQueries.map((query) => <span key={query} style={queryChipStyle}>{query}</span>)}
                    </div>
                  </div>
                  <div style={miniPanelStyle}>
                    <PanelTitle icon={ExternalLink} title="可以先看的渠道" />
                    <div style={{ marginTop: 10, display: 'grid', gap: 9 }}>
                      {opportunityReport.recommendedChannels.map((channel) => (
                        <div key={channel.name} style={smallBlockStyle}>
                          <div style={{ color: '#1f3b5f', fontSize: 13, fontWeight: 900 }}>{channel.name}</div>
                          <div style={{ marginTop: 3, color: 'rgba(62,79,106,0.72)', fontSize: 12, lineHeight: 1.55 }}>{channel.why}</div>
                          {channel.queryHint && <div style={{ marginTop: 4, color: 'rgba(74,104,140,0.58)', fontSize: 11 }}>可以这样搜：{channel.queryHint}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={miniPanelStyle}>
                  <PanelTitle icon={BriefcaseBusiness} title="值得优先验证的岗位方向" />
                  <div style={{ marginTop: 10, display: 'grid', gap: 9 }}>
                    {opportunityReport.opportunityRoles.map((role) => (
                      <div key={`${role.title}-${role.companyType}`} style={roleRowStyle(isCompact)}>
                        <div>
                          <div style={{ color: '#1f3b5f', fontSize: 13, fontWeight: 900 }}>{role.title}</div>
                          <div style={{ marginTop: 3, color: 'rgba(74,104,140,0.58)', fontSize: 11 }}>{role.companyType}</div>
                        </div>
                        <div style={{ color: 'rgba(62,79,106,0.74)', fontSize: 12, lineHeight: 1.6 }}>{role.matchReason}</div>
                        <div style={{ color: 'rgba(62,79,106,0.68)', fontSize: 12, lineHeight: 1.6 }}>
                          风险：{role.risk}
                          <br />
                          还要补的证据：{role.evidenceToCollect}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
                  <ListPanel title="还缺哪些能力证据" icon={ShieldAlert} items={opportunityReport.skillGaps} />
                  <ListPanel title="接下来一周可以做什么" icon={CheckCircle2} items={opportunityReport.firstWeekActions} />
                  <ListPanel title="还需要继续确认的地方" icon={FileSearch} items={opportunityReport.caveats} />
                </div>
              </div>
            )}
          </section>
        )}
      </div>
      <style jsx>{`
        .analysis-spinner {
          width: 15px;
          height: 15px;
          border-radius: 999px;
          border: 2px solid rgba(31, 59, 95, 0.22);
          border-top-color: rgba(31, 59, 95, 0.88);
          display: inline-block;
          flex: 0 0 auto;
          animation: analysisSpin 0.9s linear infinite;
        }
        @keyframes analysisSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}

function InsightCard({ icon: Icon, title, content }: { icon: typeof Lightbulb; title: string; content: string }) {
  return (
    <div style={miniPanelStyle}>
      <PanelTitle icon={Icon} title={title} />
      <p style={{ marginTop: 10, color: 'rgba(62,79,106,0.75)', fontSize: 13, lineHeight: 1.7 }}>{content}</p>
    </div>
  );
}

function PanelTitle({ icon: Icon, title }: { icon: typeof Lightbulb; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#1f3b5f', fontSize: 13, fontWeight: 900 }}>
      <Icon size={15} color="rgba(58,91,130,0.72)" />
      <span>{title}</span>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', gap: 7, color: 'rgba(62,79,106,0.76)', fontSize: 13, lineHeight: 1.65 }}>
      <CheckCircle2 size={15} color="#6fc7b1" style={{ marginTop: 4 }} />
      <span>{children}</span>
    </div>
  );
}

function EvidenceSource({ source }: { source: AnalysisReport['evidenceSources'][number] }) {
  const color = source.confidence === '高' ? '#6fc7b1' : source.confidence === '低' ? '#ffb86c' : '#86b8ff';
  return (
    <div style={evidenceRowStyle}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span style={sourceTypeStyle}>{source.sourceType}</span>
          <span style={{ ...confidenceStyle, background: `${color}22`, color }}>{source.confidence}</span>
        </div>
        <div style={{ marginTop: 6, color: '#1f3b5f', fontSize: 13, fontWeight: 900 }}>{source.sourceName}</div>
        <p style={{ margin: '5px 0 0', color: 'rgba(62,79,106,0.72)', fontSize: 12, lineHeight: 1.6 }}>{source.usedFor}</p>
      </div>
    </div>
  );
}

function ActionCard({ card }: { card: AnalysisReport['actionCards'][number] }) {
  return (
    <div style={actionCardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ color: '#1f3b5f', fontSize: 13, fontWeight: 900 }}>{card.title}</div>
        <span style={effortPillStyle}>{card.effort}</span>
      </div>
      <p style={{ margin: '8px 0 0', color: 'rgba(62,79,106,0.72)', fontSize: 12, lineHeight: 1.6 }}>{card.why}</p>
      <div style={{ marginTop: 10, display: 'grid', gap: 7 }}>
        <div style={actionDetailStyle}><span>第一步</span>{card.firstStep}</div>
        <div style={actionDetailStyle}><span>证据</span>{card.evidenceToCollect}</div>
      </div>
    </div>
  );
}

function CaseTakeaway({ text }: { text: string }) {
  const parts = splitTakeaway(text);
  return (
    <div style={{ display: 'grid', gap: 7 }}>
      {parts.map((part, index) => (
        <p key={`${part}-${index}`} style={caseTextStyle(index === 0)}>
          {part}
        </p>
      ))}
    </div>
  );
}

function splitTakeaway(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return ['暂无分析内容。'];
  const chunks = normalized
    .replace(/；/g, '。')
    .split(/(?<=。)|(?=启示：)|(?=风险：)|(?=动作：)|(?=建议：)/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (chunks.length <= 1 && normalized.length > 90) {
    return normalized.match(/.{1,78}(?:。|，|$)/g)?.map((item) => item.trim()).filter(Boolean) || [normalized];
  }
  return chunks.slice(0, 5);
}

function ContextLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ color: 'rgba(74,104,140,0.58)', fontSize: 11, fontWeight: 900 }}>{label}</div>
      <div style={{ marginTop: 3, color: 'rgba(62,79,106,0.76)', fontSize: 12, lineHeight: 1.55 }}>{value}</div>
    </div>
  );
}

function ListPanel({ title, icon, items }: { title: string; icon: typeof Lightbulb; items: string[] }) {
  return (
    <div style={miniPanelStyle}>
      <PanelTitle icon={icon} title={title} />
      <div style={{ marginTop: 10, display: 'grid', gap: 9 }}>
        {items.map((item) => <Bullet key={item}>{item}</Bullet>)}
      </div>
    </div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: 'rgba(74,104,140,0.66)', fontSize: 11, fontWeight: 900 }}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div style={{ marginTop: 4, height: 7, borderRadius: 999, background: 'rgba(134,184,255,0.12)', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 999, background: color }} />
      </div>
    </div>
  );
}

function MiniMetricCard({ title, content, icon: Icon }: { title: string; content: string; icon: typeof Lightbulb }) {
  return (
    <div style={heroMetricStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#1f3b5f', fontSize: 12, fontWeight: 900 }}>
        <Icon size={15} color="rgba(58,91,130,0.72)" />
        <span>{title}</span>
      </div>
      <p style={{ margin: '8px 0 0', color: 'rgba(62,79,106,0.75)', fontSize: 13, lineHeight: 1.7 }}>{content}</p>
    </div>
  );
}

function NarrativeSection({ title, content }: { title: string; content: string }) {
  return (
    <div style={narrativeSectionStyle}>
      <div style={{ color: '#1f3b5f', fontSize: 14, fontWeight: 900 }}>{title}</div>
      <p style={{ margin: '10px 0 0', color: 'rgba(62,79,106,0.78)', fontSize: 13, lineHeight: 1.95, maxWidth: 720 }}>{content}</p>
    </div>
  );
}

function buildDefaultExecutiveBrief(mode: AnalysisType, focus: string, opportunity: string) {
  if (mode === 'product') {
    return [
      { label: '判断重点', value: '先看它是否真的降低了用户开始行动的心理阻力，而不是只看它是否“治愈”。' },
      { label: '最值得抓住的机会', value: opportunity },
    ];
  }
  if (mode === 'industry') {
    return [
      { label: '判断重点', value: '先判断需求是否持续存在，再判断这个方向是否值得作为赛道切入。' },
      { label: '最值得抓住的机会', value: opportunity },
    ];
  }
  if (mode === 'career') {
    return [
      { label: '判断重点', value: '先确认现实岗位路径和能力证据，再决定是否投入转型。' },
      { label: '最值得抓住的机会', value: opportunity },
    ];
  }
  return [
    { label: '判断重点', value: focus },
    { label: '最值得抓住的机会', value: opportunity },
  ];
}

function buildDefaultNarrative(mode: AnalysisType, focus: string, opportunity: string, risks: string[]) {
  if (mode === 'product') {
    return [
      {
        title: '为什么这个方向值得继续分析',
        paragraph: '这件事值得继续看，不是因为“治愈型游戏”这个标签本身听起来吸引人，而是因为它们已经证明：当一个产品把目标拆小、把反馈做得及时、把失败成本压低时，用户会更容易进入状态，也更愿意持续回来。对行动力教练来说，这类机制比任何表面的温柔文案都更重要，因为真正决定留存的不是被安慰，而是用户是否一次次感到“我真的能开始”。',
      },
      {
        title: '我现在更倾向的判断',
        paragraph: '我现在更倾向的判断是：真正值得借鉴的不是治愈型游戏的外观气质，而是它们如何把“继续往前”设计成一件不需要太多意志力的事。换句话说，行动日历最有潜力的方向，不是继续强化任务管理，而是把记录、回看、证据沉淀和轻量奖励做成一个更有陪伴感的成长空间。这个判断的关键不在风格，而在体验机制是否真的帮助用户降低启动阻力。',
      },
      {
        title: '还不能直接下结论的地方',
        paragraph: `现在还不能直接下结论的地方主要有两类。第一类是需求强度：我们知道这种更温和的支持方式可能吸引用户，但还不知道用户会不会因此持续回来。第二类是产品边界：如果把游戏化做得过重，反而可能重新制造任务压力。${risks[0] ? `当前最需要继续盯住的风险是：${risks[0]}` : ''} 所以下一步不是继续抽象讨论，而是尽快拿真实记录样本和用户反馈，验证用户是否更愿意开始、回看，以及哪些机制真的带来掌控感。`,
      },
    ];
  }
  return [
    { title: '为什么这个方向值得继续分析', paragraph: focus },
    { title: '我现在更倾向的判断', paragraph: opportunity },
    { title: '还不能直接下结论的地方', paragraph: risks.join(' ') || '还需要补充更多现实证据。' },
  ];
}

function CaseAnalysisBlock({
  label,
  content,
  tone,
}: {
  label: string;
  content: string;
  tone: 'positive' | 'warning' | 'neutral';
}) {
  const toneColor =
    tone === 'positive' ? 'rgba(111,199,177,0.20)' : tone === 'warning' ? 'rgba(255,184,108,0.18)' : 'rgba(134,184,255,0.16)';
  return (
    <div style={{ borderRadius: 14, border: '1px solid rgba(134,184,255,0.12)', background: 'rgba(255,255,255,0.54)', padding: 11 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 999, background: toneColor, color: '#1f3b5f', fontSize: 11, fontWeight: 900 }}>
        {label}
      </div>
      <p style={{ margin: '8px 0 0', color: 'rgba(62,79,106,0.74)', fontSize: 12, lineHeight: 1.65 }}>{content}</p>
    </div>
  );
}

function buildCaseLens(
  mode: AnalysisType,
  item: {
    name: string;
    takeaway: string;
    role: string;
    scores: { fit: number; evidence: number; action: number };
  },
  lens: 'borrow' | 'avoid' | 'apply',
) {
  if (mode === 'product') {
    if (/A Short Hike/i.test(item.name)) {
      if (lens === 'borrow') return '值得借的是它把目标放得很近，用户总能看到一个够得着的下一步，所以不会一开始就被终点压垮。';
      if (lens === 'avoid') return '不要照搬它的“轻松感”外观，以为只要视觉柔和、文案温柔就够了，真正有效的是路径短、反馈快、失败代价低。';
      return '对行动力教练的启发是：把行动拆成很近的小步，并且让用户始终知道“下一步只需要做到哪里”。';
    }
    if (/Unpacking/i.test(item.name)) {
      if (lens === 'borrow') return '值得借的是它用具体动作承载情绪整理，用户不是被讲道理，而是在做事过程中慢慢恢复秩序感。';
      if (lens === 'avoid') return '不要直接模仿它的叙事形式或收纳题材，关键不是“整理”本身，而是让用户通过动作看见内在变化。';
      return '对这次分析的启发是：行动日历和教练记录可以少讲抽象激励，多让用户在记录、回看和归类中感受到自己正在变化。';
    }
    if (/Animal Crossing/i.test(item.name)) {
      if (lens === 'borrow') return '值得借的是它把成长做成长期关系，通过轻任务、装饰、收集和日常回访，让用户愿意持续回来。';
      if (lens === 'avoid') return '不要照搬它的大量收集和日常义务感，否则会很快把陪伴产品重新做成负担。';
      return '这说明行动产品可以有“持续回来”的理由，但这个理由最好来自温和积累和身份感，而不是连续打卡压力。';
    }
  }

  if (lens === 'borrow') return `${item.takeaway} 这里真正值得借的是它已经被验证过、并且用户能感知到的那一层机制。`;
  if (lens === 'avoid') return '不要只看表层形式或单个高分项就直接移植，必须先确认它成立的前提条件在你的场景里是否也存在。';
  return `对这次分析来说，它更适合作为“如何组织路径与反馈”的参考，而不是直接复制成你的最终方案。`;
}

async function readApiJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('服务返回异常，页面没有拿到可识别的数据。请重试一次。');
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function safeParseStorage(key: string) {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function compactText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim().slice(0, 220);
  if (Array.isArray(value)) return value.map((item) => compactText(item)).filter(Boolean).join('；').slice(0, 220);
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).map((item) => compactText(item)).filter(Boolean).join('；').slice(0, 220);
  }
  return fallback;
}

function readUserCareerContext() {
  const report = safeParseStorage('career_report_v1') as Record<string, unknown> | null;
  const vision = safeParseStorage('career_action_identity_vision') as Record<string, unknown> | null;
  const records = safeParseStorage('career_action_coach_records') as Array<Record<string, unknown>> | null;
  const memory = safeParseStorage('career_action_coach_memory') as Array<Record<string, unknown>> | null;
  const latestRecord = Array.isArray(records) ? records[records.length - 1] : null;
  const recentMemory = Array.isArray(memory) ? memory.slice(-3) : [];
  return {
    reportSummary: compactText([report?.archetype, report?.summary, report?.current_state, report?.career_direction], '暂无'),
    visionSummary: compactText(vision, '暂无'),
    recentAction: compactText(latestRecord?.content || latestRecord?.summary, '暂无'),
    memorySummary: compactText(recentMemory.map((item) => item.summary || item.userText), '暂无'),
  };
}

function inferTargetFromContext(context: Record<string, unknown>) {
  const text = `${context.reportSummary || ''} ${context.visionSummary || ''} ${context.recentAction || ''} ${context.memorySummary || ''}`;
  if (/AI|人工智能|智能体|agent/i.test(text)) return 'AI 产品经理 / AI 应用产品';
  if (/游戏|治愈|体验|流程/.test(text)) return '游戏体验设计 / 产品策划 / 用户体验';
  if (/用户研究|访谈|需求/.test(text)) return '用户研究 / 产品研究';
  if (/内容|社区|运营/.test(text)) return '内容产品 / 社区运营';
  return '';
}

function inferCityFromContext(context: Record<string, unknown>) {
  const text = `${context.reportSummary || ''} ${context.visionSummary || ''} ${context.memorySummary || ''}`;
  const match = text.match(/北京|上海|深圳|广州|杭州|成都|南京|武汉|苏州|远程|海外/);
  return match?.[0] || '';
}

function buildDefaultEvidenceSources({
  customCase,
  referenceCases,
  userContext,
}: {
  customCase: string;
  referenceCases: SampleCase[];
  userContext: Record<string, unknown>;
}): AnalysisReport['evidenceSources'] {
  const sources: AnalysisReport['evidenceSources'] = [];
  if (customCase.trim()) {
    sources.push({ sourceType: '用户材料', sourceName: '本次粘贴或上传的材料', usedFor: '确认用户真正想分析的对象和现实语境。', confidence: '高' });
  }
  if (userContext.reportSummary && userContext.reportSummary !== '暂无') {
    sources.push({ sourceType: '天赋报告', sourceName: '本地天赋/职业画像摘要', usedFor: '判断建议是否贴合用户长期倾向。', confidence: '中' });
  }
  if (userContext.memorySummary && userContext.memorySummary !== '暂无') {
    sources.push({ sourceType: '教练记忆', sourceName: '最近教练对话记忆', usedFor: '识别用户反复出现的关切、资源线索和卡点。', confidence: '中' });
  }
  referenceCases.slice(0, 3).forEach((item) => {
    sources.push({ sourceType: '预置案例', sourceName: item.name, usedFor: item.takeaway, confidence: '中' });
  });
  sources.push({ sourceType: '需外部验证', sourceName: '实时网页、招聘信息、用户反馈或公司官网', usedFor: '验证机会强度、岗位存在性和当前市场变化。', confidence: '低' });
  return sources.slice(0, 7);
}

function buildDefaultActionCards(mode: AnalysisType): AnalysisReport['actionCards'] {
  if (mode === 'career') {
    return [
      { title: '收集 5 条目标 JD', why: '岗位描述能直接暴露真实能力门槛和公司期待。', firstStep: '用目标方向加城市搜索，保存 5 条代表性 JD。', effort: '45分钟', evidenceToCollect: '岗位名、公司类型、反复出现的能力词。' },
      { title: '反推作品证据', why: '职业转型需要证明“我能做”，不只是表达“我想做”。', firstStep: '选 1 条 JD，把要求拆成可展示的作品项目。', effort: '30分钟', evidenceToCollect: '作品题目、目标用户、交付物形式。' },
    ];
  }
  if (mode === 'feedback') {
    return [
      { title: '整理 20 条用户原话', why: '原话比总结更容易暴露真实需求和情绪强度。', firstStep: '从评论区或访谈里复制 20 条典型反馈。', effort: '40分钟', evidenceToCollect: '原话、情绪、提到的场景。' },
      { title: '标记高频主题', why: '先找反复出现的问题，再决定产品优先级。', firstStep: '给每条反馈加一个主题标签。', effort: '30分钟', evidenceToCollect: '主题频次和最刺痛的一句话。' },
    ];
  }
  return [
    { title: '保存 3 个对照案例', why: '用真实案例帮想法落地，避免只在概念里打转。', firstStep: '找 3 个相似产品、行业案例或资源入口。', effort: '30分钟', evidenceToCollect: '链接、截图、可借鉴机制。' },
    { title: '写一条验证假设', why: '让分析有明确判断标准。', firstStep: '写下“如果 X 成立，我应该能观察到 Y”。', effort: '10分钟', evidenceToCollect: '可观察信号和反证条件。' },
    { title: '安排一次现实触达', why: '行动力教练需要把内部想法带向现实资源。', firstStep: '联系一个用户、从业者、朋友或社群。', effort: '本周', evidenceToCollect: '对方反馈、愿意继续聊的问题。' },
  ];
}

const panelStyle: CSSProperties = {
  borderRadius: 24,
  border: '1px solid rgba(134,184,255,0.14)',
  background: 'rgba(255,255,255,0.62)',
  boxShadow: '0 18px 46px rgba(80,145,240,0.08), inset 0 1px 0 rgba(255,255,255,0.72)',
  padding: 16,
};

const miniPanelStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid rgba(134,184,255,0.13)',
  background: 'rgba(255,255,255,0.66)',
  padding: 14,
};

const briefBoxStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid rgba(134,184,255,0.12)',
  background: 'rgba(244,249,255,0.56)',
  padding: 12,
};

const mobileNoticeStyle: CSSProperties = {
  marginTop: 14,
  borderRadius: 16,
  border: '1px solid rgba(134,184,255,0.18)',
  background: 'rgba(134,184,255,0.10)',
  color: 'rgba(31,59,95,0.72)',
  padding: '11px 12px',
  display: 'grid',
  gridTemplateColumns: '18px minmax(0, 1fr)',
  gap: 8,
  alignItems: 'start',
  fontSize: 12,
  lineHeight: 1.6,
};

const mobileDetailsStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid rgba(134,184,255,0.16)',
  background: 'rgba(255,255,255,0.66)',
  padding: 12,
  boxShadow: '0 12px 28px rgba(80,145,240,0.06)',
};

const mobileSummaryStyle: CSSProperties = {
  cursor: 'pointer',
  listStyle: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  color: '#1f3b5f',
  fontSize: 14,
  fontWeight: 900,
};

const reportHeroStyle: CSSProperties = {
  borderRadius: 22,
  border: '1px solid rgba(134,184,255,0.14)',
  background: 'linear-gradient(180deg, rgba(244,249,255,0.88) 0%, rgba(255,255,255,0.74) 100%)',
  padding: 18,
  boxShadow: '0 14px 34px rgba(80,145,240,0.08)',
};

const iconButtonStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 13,
  border: '1px solid rgba(134,184,255,0.24)',
  color: 'rgba(58,91,130,0.76)',
  background: 'rgba(255,255,255,0.64)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
};

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 10px',
  borderRadius: 999,
  background: 'rgba(134,184,255,0.12)',
  color: 'rgba(58,91,130,0.72)',
  fontSize: 12,
  fontWeight: 900,
};

const evidenceCountStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 34,
  height: 24,
  borderRadius: 999,
  background: 'rgba(134,184,255,0.14)',
  color: 'rgba(31,59,95,0.72)',
  fontSize: 11,
  fontWeight: 900,
};

const kickerStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: 2,
  textTransform: 'uppercase',
  color: 'rgba(74,104,140,0.50)',
  fontWeight: 900,
};

const modeButtonStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '34px minmax(0, 1fr)',
  gap: 9,
  alignItems: 'center',
  borderRadius: 15,
  border: '1px solid rgba(134,184,255,0.16)',
  padding: 10,
  cursor: 'pointer',
};

const toolboxLinkStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '34px minmax(0, 1fr)',
  gap: 9,
  alignItems: 'center',
  borderRadius: 15,
  border: '1px solid rgba(134,184,255,0.24)',
  padding: 10,
  textDecoration: 'none',
  background: 'rgba(134,184,255,0.10)',
};

const modeIconStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 12,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'rgba(58,91,130,0.75)',
  background: 'rgba(255,255,255,0.66)',
};

const textareaStyle: CSSProperties = {
  width: '100%',
  marginTop: 10,
  boxSizing: 'border-box',
  border: '1px solid rgba(134,184,255,0.18)',
  background: 'rgba(255,255,255,0.72)',
  borderRadius: 16,
  padding: '11px 12px',
  outline: 'none',
  resize: 'none',
  color: 'rgba(62,79,106,0.88)',
  fontSize: 13,
  lineHeight: 1.65,
};

const inputStyle: CSSProperties = {
  width: '100%',
  marginTop: 9,
  boxSizing: 'border-box',
  border: '1px solid rgba(134,184,255,0.18)',
  background: 'rgba(255,255,255,0.72)',
  borderRadius: 14,
  padding: '10px 12px',
  outline: 'none',
  color: 'rgba(62,79,106,0.88)',
  fontSize: 13,
};

const submitButtonStyle: CSSProperties = {
  width: '100%',
  marginTop: 10,
  height: 42,
  border: 'none',
  borderRadius: 14,
  background: 'linear-gradient(180deg, rgba(134,184,255,0.34) 0%, rgba(134,184,255,0.22) 100%)',
  color: 'rgba(31,59,95,0.92)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  fontSize: 13,
  fontWeight: 900,
  cursor: 'pointer',
  boxShadow: '0 8px 18px rgba(80,145,240,0.10), inset 0 1px 0 rgba(255,255,255,0.45)',
};

const uploadStyle: CSSProperties = {
  width: '100%',
  marginTop: 9,
  minHeight: 40,
  boxSizing: 'border-box',
  borderRadius: 14,
  border: '1px dashed rgba(134,184,255,0.34)',
  background: 'rgba(134,184,255,0.08)',
  color: 'rgba(31,59,95,0.74)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  fontSize: 13,
  fontWeight: 900,
  cursor: 'pointer',
  padding: '9px 10px',
};

const sourceLinkStyle: CSSProperties = {
  display: 'inline-flex',
  marginTop: 7,
  color: 'rgba(58,91,130,0.68)',
  fontSize: 11,
  fontWeight: 900,
  textDecoration: 'none',
};

function caseTextStyle(isLead: boolean): CSSProperties {
  return {
    margin: 0,
    maxWidth: 680,
    color: isLead ? 'rgba(31,59,95,0.82)' : 'rgba(62,79,106,0.72)',
    fontSize: 13,
    lineHeight: 1.75,
    letterSpacing: 0,
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
  };
}

const queryChipStyle: CSSProperties = {
  display: 'inline-flex',
  padding: '6px 9px',
  borderRadius: 999,
  background: 'rgba(134,184,255,0.12)',
  color: 'rgba(31,59,95,0.78)',
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.2,
};

const smallBlockStyle: CSSProperties = {
  borderRadius: 13,
  border: '1px solid rgba(134,184,255,0.12)',
  background: 'rgba(255,255,255,0.58)',
  padding: 10,
};

const caseScorePanelStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid rgba(134,184,255,0.12)',
  background: 'rgba(247,250,255,0.76)',
  padding: 11,
};

const evidenceRowStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid rgba(134,184,255,0.12)',
  background: 'rgba(255,255,255,0.56)',
  padding: 10,
};

const sourceTypeStyle: CSSProperties = {
  display: 'inline-flex',
  padding: '4px 7px',
  borderRadius: 999,
  background: 'rgba(134,184,255,0.12)',
  color: 'rgba(31,59,95,0.72)',
  fontSize: 10,
  fontWeight: 900,
  lineHeight: 1,
};

const confidenceStyle: CSSProperties = {
  display: 'inline-flex',
  padding: '4px 7px',
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 900,
  lineHeight: 1,
};

const actionCardStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid rgba(134,184,255,0.14)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.74) 0%, rgba(244,249,255,0.62) 100%)',
  padding: 13,
  boxShadow: '0 8px 18px rgba(80,145,240,0.06)',
};

const effortPillStyle: CSSProperties = {
  flex: '0 0 auto',
  padding: '5px 7px',
  borderRadius: 999,
  background: 'rgba(111,199,177,0.14)',
  color: 'rgba(31,95,81,0.78)',
  fontSize: 10,
  fontWeight: 900,
};

const actionDetailStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '44px minmax(0, 1fr)',
  gap: 8,
  color: 'rgba(62,79,106,0.72)',
  fontSize: 12,
  lineHeight: 1.55,
};

const heroMetricStyle: CSSProperties = {
  borderRadius: 16,
  border: '1px solid rgba(134,184,255,0.14)',
  background: 'rgba(255,255,255,0.58)',
  padding: 12,
};

const judgementRowStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid rgba(134,184,255,0.12)',
  background: 'rgba(255,255,255,0.56)',
  padding: 12,
};

const judgementDotStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  flex: '0 0 auto',
};

const reasonRowStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid rgba(134,184,255,0.12)',
  background: 'rgba(255,255,255,0.52)',
  padding: 11,
};

const narrativeSectionStyle: CSSProperties = {
  borderRadius: 14,
  border: '1px solid rgba(134,184,255,0.10)',
  background: 'rgba(255,255,255,0.52)',
  padding: 12,
};

function caseRowStyle(isCompact: boolean): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'minmax(220px, 0.92fr) minmax(0, 1.35fr)',
    gap: 14,
    alignItems: 'start',
    borderRadius: 15,
    border: '1px solid rgba(134,184,255,0.12)',
    background: 'rgba(255,255,255,0.58)',
    padding: isCompact ? 12 : 16,
  };
}

function roleRowStyle(isCompact: boolean): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : '150px minmax(0, 1fr) minmax(0, 1fr)',
    gap: 12,
    alignItems: 'start',
    borderRadius: 15,
    border: '1px solid rgba(134,184,255,0.12)',
    background: 'rgba(255,255,255,0.58)',
    padding: 12,
  };
}
