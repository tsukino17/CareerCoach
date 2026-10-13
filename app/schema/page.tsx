'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, Compass, Lightbulb, MapPinned, MessagesSquare, Pin, Sparkles, Target, Trash2 } from 'lucide-react';
import realCasePresets from '@/data/real-case-presets.json';
import {
  buildPathMapPreview,
  CAREER_DEMO_CASE_KEY,
  CAREER_DEMO_MODE_KEY,
  CAREER_DRAFT_TOKEN_KEY,
  CAREER_ACTIVE_REAL_SAMPLE_ID_KEY,
  CHAT_STORAGE_KEY,
  CONVERSATION_META_STORAGE_KEY,
  deleteCareerSample,
  readActiveCareerSample,
  readCareerSampleLibrary,
  REPORT_STORAGE_KEY,
  setActiveCareerSample,
} from '@/lib/career-path';
import { cn } from '@/lib/utils';
import { DEMO_CASES, seedDemoCaseToStorage, persistDemoToStorage, clearDemoStorage } from '@/lib/demo-cases';

type TargetPath = '/chat' | '/report' | '/path';

const DEMO_TARGETS: Array<{ path: TargetPath; label: string; description: string }> = [
  { path: '/chat', label: '进入对话体验', description: '查看用户如何从真实困惑开始表达' },
  { path: '/report', label: '查看职业报告', description: '查看系统如何沉淀职业画像' },
  { path: '/path', label: '打开路径地图', description: '查看新版现实路径地图与职业探索面板' },
];

const journeyStages = [
  {
    label: 'Awareness',
    title: '困惑进入',
    icon: MessagesSquare,
    color: 'from-[#ffbd44] to-[#f59e0b]',
    text: '用户不需要先知道岗位名，只需要说出真实卡点。',
    points: ['困惑高', '目标远'],
  },
  {
    label: 'Discovery',
    title: '对话理解',
    icon: Compass,
    color: 'from-[#ff7b8a] to-[#f43f5e]',
    text: '通过自然对话提炼偏好、能力、天赋与工作方式。',
    points: ['被听见', '开始聚焦'],
  },
  {
    label: 'Insight',
    title: '职业报告',
    icon: Lightbulb,
    color: 'from-[#4dd6c8] to-[#14b8a6]',
    text: '把潜在优势和方向感总结成可被看见的画像。',
    points: ['被理解', '看见方向'],
  },
  {
    label: 'Decision',
    title: '现实路径地图',
    icon: MapPinned,
    color: 'from-[#5cc8f5] to-[#2f80ed]',
    text: '把画像翻译成现实职业方向、岗位差异和准备重点。',
    points: ['更笃定', '接近目标'],
  },
  {
    label: 'Progress',
    title: '策略推进',
    icon: Target,
    color: 'from-[#6d8cff] to-[#4f46e5]',
    text: '方向清楚后，再进入适合自己的准备节奏。',
    points: ['有策略', '可持续'],
  },
];

const companionFlowStages = [
  {
    step: '01',
    title: '天赋对话',
    icon: MessagesSquare,
    goal: '先让用户感觉自己被理解，而不是被判断。',
    outcome: '收集真实动机、偏好、阻力、工作方式与环境线索。',
    next: '生成天赋报告',
  },
  {
    step: '02',
    title: '天赋报告',
    icon: Lightbulb,
    goal: '把分散表达整理成可被看见的自我画像。',
    outcome: '沉淀优势、驱动力、脆弱点、适配环境与潜在方向。',
    next: '收敛一个当前主方向',
  },
  {
    step: '03',
    title: '方向收敛',
    icon: Compass,
    goal: '从很多可能里，先选一条最值得验证的路。',
    outcome: '选定当前主方向，并进入愿景板与行动指北。',
    next: '进入行动力陪伴',
  },
  {
    step: '04',
    title: '行动力陪伴',
    icon: Sparkles,
    goal: '让用户不是被催着做事，而是在现实中慢慢推进。',
    outcome: '形成行动记录、教练记忆、阶段卡点与下一步动作。',
    next: '按需调用分析工具箱或路径地图',
  },
  {
    step: '05',
    title: '现实验证',
    icon: MapPinned,
    goal: '把“感觉适合”翻译成现实世界是否可行。',
    outcome: '借助分析工具箱、路径地图、岗位与资源线索补齐判断。',
    next: '回到行动与复盘',
  },
  {
    step: '06',
    title: '长期沉淀',
    icon: CalendarDays,
    goal: '让用户看见自己在长期靠近某种身份。',
    outcome: '在行动日历、愿景板和行动指北里持续回看、修正、积累。',
    next: '开始下一轮更清晰的推进',
  },
];

const returnRoutes = [
  {
    title: '首次使用',
    route: '天赋对话 → 天赋报告 → 选方向 → 愿景板 → 行动指北 → 行动力教练',
    detail: '第一次体验的重点不是让用户看很多功能，而是让他自然进入“我先试哪条路”的状态。',
  },
  {
    title: '日常回访',
    route: '行动力教练 → 行动记录 → 行动日历 → 下一步小行动',
    detail: '第二次以后，主场应该是行动力教练。用户回来时要自然承接上一次，而不是重新开始。',
  },
  {
    title: '卡住时回访',
    route: '行动力教练 → 分析工具箱 / 现实路径地图 → 更新判断 → 回到行动',
    detail: '用户卡住时，不是让他自己翻功能，而是自然引入更专业的分析与现实资源验证。',
  },
];

const routingMatrix = [
  {
    stage: '首次访客',
    login: '未登录',
    trigger: '从分享链接、内容页或首页进入，只想先试试看',
    home: '直接进入天赋对话，不先拦登录',
    archive: '暂不建档，只保留本次会话体验',
    next: '先拿到天赋报告，再决定是否进入长期陪伴',
  },
  {
    stage: '已拿到报告',
    login: '未登录',
    trigger: '已经体验到报告价值，开始想保存结果或继续推进',
    home: '报告页和“继续陪伴”按钮成为第一次转化点',
    archive: '此时提示登录建档，保存报告、对话和后续行动记忆',
    next: '进入选方向、愿景板和行动指北',
  },
  {
    stage: '方向收敛中',
    login: '已登录',
    trigger: '用户认可一两个方向，愿意继续往下走',
    home: '优先进入方向收敛、愿景板或行动指北',
    archive: '开始记录主方向、偏好条件、阶段目标',
    next: '转入行动力教练，形成第一轮行动节奏',
  },
  {
    stage: '日常推进',
    login: '已登录',
    trigger: '用户已经有连续记录，需要承接上次进展',
    home: '默认回到行动力教练，显示最近记录和今日切入口',
    archive: '持续沉淀行动记录、状态变化、教练记忆',
    next: '自然联动行动日历、现实资源地图和咨询工具箱',
  },
  {
    stage: '卡住回访',
    login: '已登录',
    trigger: '用户出现反复犹豫、缺资源、缺现实判断',
    home: '行动力教练先接住，再转入分析工具箱或现实路径地图',
    archive: '补充卡点、验证线索、外部资源判断',
    next: '更新方向判断后，回到下一步行动',
  },
];

export default function TestDataPage() {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>(DEMO_CASES[0].id);
  const [draftToken, setDraftToken] = useState('');
  const [activeTarget, setActiveTarget] = useState<TargetPath | null>(null);
  const [caseChangedFlash, setCaseChangedFlash] = useState(false);
  const [persisted, setPersisted] = useState(false);
  const experienceSectionRef = useRef<HTMLElement | null>(null);
  const [realLibraryVersion, setRealLibraryVersion] = useState(0);
  const realLibrary = useMemo(() => readCareerSampleLibrary(), [realLibraryVersion]);
  const activeRealSample = useMemo(() => readActiveCareerSample(), [realLibraryVersion]);
  const presetRealCases = useMemo(() => {
    return (realCasePresets as Array<any>).map((sample) => ({
      ...sample,
      isPresetReal: true,
      isReal: true,
      label: sample.title,
      createdAt: sample.generatedAt,
    }));
  }, []);

  const schemaCases = useMemo(() => {
    const realCases = realLibrary.map((sample) => {
      const firstUser = sample.messages.find((item) => item.role === 'user');
      const firstAssistant = sample.messages.find((item) => item.role === 'assistant');
      return {
        id: sample.id,
        title: sample.label || sample.report.archetype || '真实模型案例',
        audience: '来自真实模型生成的对话与报告',
        scenario: '这不是手写演示案例，而是实际对话后沉淀出的报告结果，可作为当前最可信的体验样本。',
        pitchMessages: [
          {
            id: `${sample.id}-pitch-user`,
            role: 'user' as const,
            content: firstUser?.content || '这里展示的是一组真实模型对话后沉淀下来的案例数据。',
          },
          {
            id: `${sample.id}-pitch-assistant`,
            role: 'assistant' as const,
            content: firstAssistant?.content || '这组案例会优先用于展示产品如何从真实对话走向报告与现实路径判断。',
          },
        ],
        messages: sample.messages.map((item, index) => ({
          id: item.id || `${sample.id}-msg-${index}`,
          role: item.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: item.content,
        })),
        report: sample.report,
        isReal: true,
        createdAt: sample.createdAt,
      };
    });

    const mergedPresetCases = presetRealCases.filter(
      (preset) => !realCases.some((item) => item.id === preset.id)
    );

    return [...realCases, ...mergedPresetCases, ...DEMO_CASES];
  }, [presetRealCases, realLibrary]);

  useEffect(() => {
    if (activeRealSample?.id) {
      setSelectedId(activeRealSample.id);
      return;
    }
    if (presetRealCases[0]?.id) {
      setSelectedId(presetRealCases[0].id);
      return;
    }
    if (schemaCases[0]?.id) {
      setSelectedId(schemaCases[0].id);
    }
  }, [activeRealSample, presetRealCases, schemaCases]);

  const selectedCase = useMemo(
    () => schemaCases.find((item) => item.id === selectedId) || schemaCases[0],
    [schemaCases, selectedId]
  );
  const preview = useMemo(() => buildPathMapPreview(selectedCase.report), [selectedCase]);
  const headlineRoles = selectedCase.report.target_roles || [];
  const sampleHighlights = selectedCase.report.superpowers
    .map((item: any) => (typeof item === 'string' ? item : item.name))
    .slice(0, 3);

  useEffect(() => {
    if (!experienceSectionRef.current) return;
    setCaseChangedFlash(true);
    experienceSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const timer = window.setTimeout(() => setCaseChangedFlash(false), 1400);
    return () => window.clearTimeout(timer);
  }, [selectedId]);

  const getTargetHref = (nextPath: TargetPath) => {
    if ((selectedCase as { isReal?: boolean }).isReal) return nextPath;
    const demo = `demo=${selectedCase.id}`;
    if (nextPath === '/chat') return `/chat?${demo}`;
    if (nextPath === '/report') return `/report?${demo}`;
    if (nextPath === '/path') return `/path?${demo}`;
    return nextPath;
  };

  const navigateToTarget = (nextPath: TargetPath) => {
    if ((selectedCase as { isReal?: boolean }).isReal) {
      const token = `real-draft-${Date.now()}`;
      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(selectedCase.messages));
      window.localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(selectedCase.report));
      window.localStorage.setItem(CAREER_DRAFT_TOKEN_KEY, token);
      window.localStorage.setItem(CAREER_ACTIVE_REAL_SAMPLE_ID_KEY, selectedCase.id);
      window.localStorage.removeItem(CAREER_DEMO_MODE_KEY);
      window.localStorage.removeItem(CAREER_DEMO_CASE_KEY);
      window.localStorage.setItem(
        CONVERSATION_META_STORAGE_KEY,
        JSON.stringify([
          {
            id: `real-conv-${Date.now()}`,
            title: `${selectedCase.title}`,
            created_at: new Date().toISOString(),
            messages: selectedCase.messages,
          },
        ])
      );
      setDraftToken(token);
    } else {
      seedDemoCaseToStorage(selectedCase);
    }
    const href = getTargetHref(nextPath);
    setActiveTarget(nextPath);
    setDraftToken(`test-draft-${selectedCase.id}-${Date.now()}`);
    window.location.href = href;
  };

  const handlePersist = () => {
    const ok = (selectedCase as { isReal?: boolean }).isReal
        ? (() => {
          const token = `real-draft-${Date.now()}`;
          window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(selectedCase.messages));
          window.localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(selectedCase.report));
          window.localStorage.setItem(CAREER_DRAFT_TOKEN_KEY, token);
          window.localStorage.setItem(CAREER_ACTIVE_REAL_SAMPLE_ID_KEY, selectedCase.id);
          window.localStorage.removeItem(CAREER_DEMO_MODE_KEY);
          window.localStorage.removeItem(CAREER_DEMO_CASE_KEY);
          setDraftToken(token);
          return true;
        })()
      : persistDemoToStorage(selectedCase.id);
    setPersisted(ok);
    setDraftToken(`test-draft-${selectedCase.id}-${Date.now()}`);
    setTimeout(() => setPersisted(false), 2000);
  };

  const activateRealCase = (caseId: string) => {
    setActiveCareerSample(caseId);
    setSelectedId(caseId);
    setRealLibraryVersion((value) => value + 1);
  };

  const removeRealCase = (caseId: string) => {
    deleteCareerSample(caseId);
    setRealLibraryVersion((value) => value + 1);
  };

  const clearDemoData = () => {
    clearDemoStorage();
    setDraftToken('');
    setActiveTarget(null);
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#fffdf9_0%,#ffffff_52%,#f4f8ff_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <div className="inline-flex items-center rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
          EchoTalent 产品体验
        </div>
        <h1 className="mt-4 max-w-4xl text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
          从职业困惑，到可执行的现实路径
        </h1>
        <p className="mt-4 max-w-4xl text-base leading-8 text-slate-600">
          EchoTalent 先理解用户真实的职业困惑，再生成职业画像，并进一步连接现实岗位、行业差异与准备策略，让用户从“我很乱”走向“我知道先往哪里看”。
        </p>

        <section className="mt-8 rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">用户体验 Journey Map</div>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                一条从“模糊困惑”到“现实判断”的职业决策链路。
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
              Self-awareness → Career decision
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <div className="rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(135deg,#fff9f2_0%,#ffffff_44%,#f4f8ff_100%)] p-6">
              <div className="flex flex-wrap items-center gap-3">
                {journeyStages.map((item) => (
                  <div
                    key={item.title}
                    className="clip-journey relative flex flex-1 min-w-[140px] items-center justify-center overflow-hidden px-3 py-3 text-center text-white shadow-sm rounded-xl"
                  >
                    <div className={cn('absolute inset-0 bg-gradient-to-r', item.color)} />
                    <div className="relative">
                      <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-white/80">{item.label}</div>
                      <div className="mt-0.5 text-sm font-bold">{item.title}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {journeyStages.map((item, index) => (
                  <div key={item.title} className="rounded-[1.1rem] border border-slate-200 bg-white/92 px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.045)]">
                    <div className="flex items-center gap-2">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-600">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-sky-700">0{index + 1}</div>
                        <div className="text-sm font-bold text-slate-900">{item.title}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs leading-6 text-slate-600">{item.text}</div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.points.map((point) => (
                        <span key={point} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                          {point}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      方向清晰度 × 行动准备度
                    </div>
                    <div className="mt-1 text-sm text-slate-600">用户对方向的判断更清楚，对下一步准备也更有把握。</div>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#0f766e]" />
                      方向清晰度
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[#2563eb]" />
                      行动准备度
                    </span>
                  </div>
                </div>

                <svg viewBox="0 0 1000 520" className="mt-4 h-auto w-full" role="img" aria-label="方向清晰度与行动准备度变化示意图">
                  <defs>
                    <linearGradient id="demoClarityArea" x1="0%" x2="100%" y1="0%" y2="0%">
                      <stop offset="0%" stopColor="rgba(15,118,110,0.18)" />
                      <stop offset="100%" stopColor="rgba(14,165,233,0.12)" />
                    </linearGradient>
                    <linearGradient id="demoReadinessArea" x1="0%" x2="100%" y1="0%" y2="0%">
                      <stop offset="0%" stopColor="rgba(37,99,235,0.10)" />
                      <stop offset="100%" stopColor="rgba(99,102,241,0.18)" />
                    </linearGradient>
                    <linearGradient id="demoClarityStroke" x1="0%" x2="100%" y1="0%" y2="0%">
                      <stop offset="0%" stopColor="#0f766e" />
                      <stop offset="48%" stopColor="#0891b2" />
                      <stop offset="100%" stopColor="#2563eb" />
                    </linearGradient>
                    <linearGradient id="demoReadinessStroke" x1="0%" x2="100%" y1="0%" y2="0%">
                      <stop offset="0%" stopColor="#4f46e5" />
                      <stop offset="100%" stopColor="#2563eb" />
                    </linearGradient>
                  </defs>

                  <rect x="40" y="40" width="920" height="380" rx="28" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />

                  <g>
                    {[120, 180, 240, 300, 360].map((y) => (
                      <line key={y} x1="110" y1={y} x2="900" y2={y} stroke="rgba(148,163,184,0.25)" strokeDasharray="6 12" strokeWidth="1" />
                    ))}
                  </g>

                  <g>
                    <text x="50" y="130" fontSize="11" fill="#94a3b8" fontWeight="500">高</text>
                    <text x="50" y="250" fontSize="11" fill="#94a3b8" fontWeight="500">中</text>
                    <text x="50" y="370" fontSize="11" fill="#94a3b8" fontWeight="500">低</text>
                  </g>

                  <g opacity="0.95">
                    {[
                      { x: 180, label: '进入前', note: '困惑高 / 目标远' },
                      { x: 400, label: '对话后', note: '被听见 / 开始聚焦' },
                      { x: 620, label: '报告后', note: '被理解 / 看见方向' },
                      { x: 840, label: '路径图后', note: '更笃定 / 接近目标' },
                    ].map((point) => (
                      <g key={point.label}>
                        <line x1={point.x} y1="80" x2={point.x} y2="380" stroke="rgba(148,163,184,0.2)" strokeWidth="1" />
                        <text x={point.x} y="440" textAnchor="middle" fontSize="15" fontWeight="700" fill="#334155">{point.label}</text>
                        <text x={point.x} y="465" textAnchor="middle" fontSize="13" fill="#64748b">{point.note}</text>
                      </g>
                    ))}
                  </g>

                  <path
                    d="M180 370 C260 368, 320 360, 400 340 S520 260, 620 180 S740 90, 840 50 L840 380 L180 380 Z"
                    fill="url(#demoClarityArea)"
                  />

                  <path
                    d="M180 370 C260 368, 320 360, 400 340 S520 260, 620 180 S740 90, 840 50"
                    fill="none"
                    stroke="url(#demoClarityStroke)"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />

                  <path
                    d="M180 340 C265 338, 325 335, 400 325 S520 290, 620 240 S750 170, 840 130 L840 380 L180 380 Z"
                    fill="url(#demoReadinessArea)"
                    opacity="0.9"
                  />

                  <path
                    d="M180 340 C265 338, 325 335, 400 325 S520 290, 620 240 S750 170, 840 130"
                    fill="none"
                    stroke="url(#demoReadinessStroke)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray="12 12"
                  />

                  {[
                    { x: 180, clarityY: 370, readinessY: 340 },
                    { x: 400, clarityY: 340, readinessY: 325 },
                    { x: 620, clarityY: 180, readinessY: 240 },
                    { x: 840, clarityY: 50, readinessY: 130 },
                  ].map((point) => (
                    <g key={`${point.x}`}>
                      <circle cx={point.x} cy={point.clarityY} r="12" fill="#fff" stroke="#0f766e" strokeWidth="3" />
                      <circle cx={point.x} cy={point.readinessY} r="10" fill="#fff" stroke="#2563eb" strokeWidth="3" />
                    </g>
                  ))}

                  <text x="160" y="200" fontSize="14" fill="#0f766e" fontWeight="700">方向清晰度</text>
                  <text x="160" y="260" fontSize="14" fill="#2563eb" fontWeight="700">行动准备度</text>
                </svg>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">长期陪伴体验路线</div>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-600">
                这条产品线不是一组并列功能，而是一条从“看见自己”到“验证现实”，再到“长期推进”的陪伴闭环。用户每一步都应该知道自己为什么现在做这个，以及下一步自然会去哪里。
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
              Self-understanding → Direction → Action → Reality → Review
            </div>
          </div>

          <div className="mt-6 rounded-[1.6rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-4 sm:p-5">
            <div className="space-y-3">
              {companionFlowStages.map((stage, index) => (
                <div key={stage.step} className="relative rounded-[1.3rem] border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.035)] sm:px-5 sm:py-5">
                  {index < companionFlowStages.length - 1 && (
                    <div className="absolute left-8 top-[72px] hidden h-[calc(100%+10px)] w-px bg-gradient-to-b from-sky-200 via-slate-200 to-transparent sm:block" />
                  )}
                  <div className="grid gap-4 sm:grid-cols-[72px_minmax(0,1fr)]">
                    <div className="flex items-start justify-between sm:block">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-sky-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                        <stage.icon className="h-5 w-5" />
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold tracking-[0.18em] text-slate-500 sm:mt-3 sm:inline-flex">
                        {stage.step}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="text-lg font-bold text-slate-900">{stage.title}</div>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{stage.goal}</p>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(220px,0.9fr)]">
                        <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">这一段会沉淀什么</div>
                          <p className="mt-2 text-sm leading-7 text-slate-600">{stage.outcome}</p>
                        </div>
                        <div className="rounded-[1rem] border border-sky-200 bg-sky-50/70 px-4 py-3">
                          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-700">下一步自然去向</div>
                          <div className="mt-2 text-sm font-semibold leading-7 text-slate-800">{stage.next}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 rounded-[1.45rem] border border-slate-200 bg-[linear-gradient(135deg,#fffaf2_0%,#ffffff_45%,#f4f8ff_100%)] p-5">
            <div className="text-sm font-semibold text-slate-900">三种典型用户动线</div>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              为了让产品用起来丝滑，我们不能只设计“第一次怎么用”，还要明确用户日常回来、以及卡住时回来，该被带去哪里。
            </p>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {returnRoutes.map((item) => (
                <div key={item.title} className="rounded-[1.2rem] border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                  <div className="text-sm font-bold text-slate-900">{item.title}</div>
                  <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-sm font-medium leading-7 text-slate-700">
                    {item.route}
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-[1.45rem] border border-slate-200 bg-white p-5">
            <div className="text-sm font-semibold text-slate-900">登录与建档时机对照表</div>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-600">
              这里建议采用“先体验价值，再请求登录”的策略。也就是先让用户自然完成天赋对话和天赋报告，等他真正想保存档案、继续陪伴、沉淀记忆时，再触发建档动作。
            </p>

            <div className="mt-4 overflow-hidden rounded-[1.2rem] border border-slate-200">
              <div className="hidden grid-cols-[0.9fr_0.6fr_1.15fr_1.05fr_1.1fr_1fr] bg-slate-50 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 lg:grid">
                <div className="px-4 py-3">用户状态</div>
                <div className="px-4 py-3">登录状态</div>
                <div className="px-4 py-3">进入原因</div>
                <div className="px-4 py-3">首页/主入口</div>
                <div className="px-4 py-3">建档动作</div>
                <div className="px-4 py-3">下一步</div>
              </div>

              <div className="divide-y divide-slate-200">
                {routingMatrix.map((item) => (
                  <div key={item.stage} className="bg-white lg:grid lg:grid-cols-[0.9fr_0.6fr_1.15fr_1.05fr_1.1fr_1fr]">
                    <div className="px-4 py-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 lg:hidden">用户状态</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 lg:mt-0">{item.stage}</div>
                    </div>
                    <div className="px-4 py-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 lg:hidden">登录状态</div>
                      <div className="mt-1 text-sm text-slate-700 lg:mt-0">{item.login}</div>
                    </div>
                    <div className="px-4 py-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 lg:hidden">进入原因</div>
                      <div className="mt-1 text-sm leading-7 text-slate-600 lg:mt-0">{item.trigger}</div>
                    </div>
                    <div className="px-4 py-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 lg:hidden">首页/主入口</div>
                      <div className="mt-1 text-sm leading-7 text-slate-600 lg:mt-0">{item.home}</div>
                    </div>
                    <div className="px-4 py-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 lg:hidden">建档动作</div>
                      <div className="mt-1 text-sm leading-7 text-slate-600 lg:mt-0">{item.archive}</div>
                    </div>
                    <div className="px-4 py-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 lg:hidden">下一步</div>
                      <div className="mt-1 text-sm leading-7 text-slate-600 lg:mt-0">{item.next}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-[1.1rem] border border-sky-200 bg-sky-50 px-4 py-4 text-sm leading-7 text-slate-700">
              一个更顺的转化点是：用户看完报告后，如果点击“保存报告”“继续长期陪伴”“开始行动记录”这类动作，再弹出登录建档。这样登录不再像打断，而像“把已经得到的东西留下来”。
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[1.45rem] border border-slate-200 bg-slate-50 px-5 py-5">
              <div className="text-sm font-semibold text-slate-900">体验设计原则</div>
              <div className="mt-4 grid gap-3">
                {[
                  '不要让用户感到自己在走后台流程，每一步都要像自然承接。',
                  '不要把所有功能并列摆出来，而要按阶段和状态逐步出现。',
                  '行动力教练是日常主场，分析工具箱和现实路径地图是按需调用的专业能力。',
                  '行动日历负责沉淀连续感，不应该抢主线；愿景板和行动指北负责稳定方向感。',
                ].map((item) => (
                  <div key={item} className="rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-600">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.45rem] border border-slate-200 bg-white px-5 py-5">
              <div className="text-sm font-semibold text-slate-900">核心产品判断</div>
              <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600">
                <p>
                  这个产品的核心，不是“报告 + 工具”，而是从自我认识，到方向收敛，到现实验证，再到持续行动与回看修正的长期陪伴闭环。
                </p>
                <p>
                  所以真正的体验重点，不是让用户知道我们有哪些模块，而是让用户每次回来都自然知道：我现在在哪里、为什么在这里、下一步去哪。
                </p>
                <div className="rounded-[1.1rem] border border-sky-200 bg-sky-50 px-4 py-4 text-sky-900">
                  最终体验应该让用户感觉：我不是在使用很多功能，而是在被一步步带着往前走。
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          ref={experienceSectionRef}
          className={cn(
            'mt-8 rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)] transition-all duration-500',
            caseChangedFlash && 'ring-2 ring-sky-200 shadow-[0_16px_48px_rgba(56,189,248,0.18)]'
          )}
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-slate-900">真实案例体验</div>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                这里用一个真实跑过的典型人物，展示从教练对话到职业报告，再到现实路径判断，这条产品链路是怎样自然承接下来的。
              </p>
            </div>
            <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              当前案例：{selectedCase.title}
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <DemoStep
              step="Step 1"
              title="用户带着模糊困惑进入"
              subtitle="第一步不是岗位匹配，而是先帮助用户把模糊焦虑说清楚"
            >
              <div className="grid gap-3 md:grid-cols-2">
                {selectedCase.pitchMessages.map((item: { id: string; role: string; content: string }) => (
                    <div
                      key={item.id}
                      className={cn(
                        'rounded-2xl px-4 py-4 text-sm leading-7 shadow-sm',
                        item.role === 'user' ? 'bg-sky-50 text-slate-700' : 'bg-slate-50 text-slate-600'
                      )}
                    >
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {item.role === 'user' ? '用户表达' : '系统回应'}
                      </div>
                      {item.content}
                    </div>
                  ))}
              </div>
            </DemoStep>

            <DemoStep
              step="Step 2"
              title="系统生成职业报告"
              subtitle="系统把分散表达转译成一个可被看见、可被记住的职业画像"
            >
              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-5 py-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">职业原型</div>
                  <div className="mt-3 text-2xl font-bold text-slate-900">{selectedCase.report.archetype}</div>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{selectedCase.report.summary}</p>
                </div>
                <div className="rounded-[1.4rem] border border-slate-200 bg-white px-5 py-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">被看见的优势</div>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    这一步的关键，不是给用户贴一个岗位标签，而是把原本零散、模糊、难以自我命名的能力结构提炼出来，让用户第一次清楚地看见“自己到底擅长什么、为什么总在某类问题上更敏锐”。
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {sampleHighlights.map((item: string) => (
                      <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {item}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedCase.report.skills.map((skill: string) => (
                      <span key={skill} className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </DemoStep>

            <DemoStep
              step="Step 3"
              title="进入现实路径地图"
              subtitle="画像不是结论，接下来要把它翻译成现实世界里的方向判断"
            >
              <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-7 text-slate-600">
                这一步是 EchoTalent 和普通职业测评最不一样的地方。我们不把“你是谁”停在抽象画像里，而是继续追问：这种能力结构在真实职业世界里，会更适合哪类方向、哪类岗位环境、哪种成长路径。
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {preview.direction_clusters.map((item) => (
                  <div key={item.id} className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-5 py-5">
                    <div className="text-base font-bold text-slate-900">{item.name}</div>
                    <div className="mt-2 text-sm leading-6 text-slate-500">
                      {item.fit_reason}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.sample_roles.map((role) => (
                        <span key={role} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </DemoStep>

            <DemoStep
              step="Step 4"
              title="展开岗位与行业现实分析"
              subtitle="这里的重点不是催用户投递，而是先建立对现实职业世界的判断力"
            >
              <div className="grid gap-4 md:grid-cols-3">
                <PitchCard
                  title="岗位线索"
                  text={headlineRoles.length > 0 ? `把画像映射到具体岗位样本，例如 ${headlineRoles.join('、')}。` : '把画像映射到具体岗位样本，例如内容策略、用户研究、产品策划。'}
                />
                <PitchCard
                  title="行业差异"
                  text="同样的岗位名，在不同行业、公司阶段和团队结构里，真实职责和能力要求可能完全不同。"
                />
                <PitchCard
                  title="准备重点"
                  text="先判断该补什么、该如何表达自己、哪些不需要急着做，减少盲目试错。"
                />
              </div>
            </DemoStep>

            <DemoStep
              step="Step 5"
              title="最后才进入推进层"
              subtitle="当方向感建立之后，产品才进入真正的准备与推进阶段"
            >
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-5 py-5 text-sm leading-7 text-slate-600">
                EchoTalent 的核心不是“给建议”，而是先建立判断，再支持行动。这样用户不会被任务清单推着走，而是能在更清楚的方向感里逐步推进。
              </div>
            </DemoStep>
          </div>
        </section>

        <section className="mt-8 rounded-[1.5rem] border border-slate-200/70 bg-slate-50/70 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.03)]">
          {realLibrary.length > 0 ? (
            <div className="mb-5 rounded-[1.2rem] border border-sky-200 bg-white px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">真实案例库</div>
              <p className="mt-2 text-xs leading-6 text-slate-500">
                这里保存的是已经真实调用模型产出的案例。你可以把其中一组设为当前默认展示，也可以清理旧案例。
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {realLibrary.map((item) => {
                  const active = activeRealSample?.id === item.id;
                  return (
                    <div key={item.id} className={cn('rounded-[1rem] border px-4 py-4', active ? 'border-sky-400 bg-sky-50' : 'border-slate-200 bg-slate-50')}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900">{item.label || item.report.archetype || '真实模型案例'}</div>
                          <div className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString('zh-CN')}</div>
                          <div className="mt-2 text-xs leading-6 text-slate-600 line-clamp-3">{item.report.summary}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRealCase(item.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:text-slate-700"
                          aria-label="删除真实案例"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => activateRealCase(item.id)}
                          className={cn(
                            'rounded-full px-3 py-1.5 text-xs font-medium transition',
                            active ? 'bg-sky-600 text-white' : 'border border-slate-200 bg-white text-slate-700'
                          )}
                        >
                          {active ? '当前默认案例' : '设为当前展示'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {presetRealCases.length > 0 ? (
            <div className="mb-5 rounded-[1.2rem] border border-amber-200 bg-white px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">三组真实案例</div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {presetRealCases.map((item) => {
                  const active = selectedId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={cn(
                        'rounded-[1rem] border px-4 py-4 text-left transition',
                        active ? 'border-amber-300 bg-amber-50 shadow-[0_12px_28px_rgba(251,191,36,0.14)]' : 'border-slate-200 bg-slate-50 hover:bg-white'
                      )}
                    >
                      <div className="text-sm font-bold text-slate-900">{item.title}</div>
                      <div className="mt-1 text-xs font-medium text-amber-700">{item.audience}</div>
                      <div className="mt-2 text-xs leading-6 text-slate-600 line-clamp-4">{item.scenario}</div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="text-sm font-semibold text-slate-800">进入这个案例的产品页面</div>
                <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-500">
                  当前选中“{selectedCase.title}”。下面这些入口会直接带你进入这位人物对应的报告与路径页面。
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {DEMO_TARGETS.map((target) => (
                    <button
                      key={target.path}
                      type="button"
                      onClick={() => navigateToTarget(target.path)}
                      className={cn(
                        'rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-sky-300 hover:bg-sky-50 w-full min-h-[108px]',
                        activeTarget === target.path && 'border-sky-400 bg-sky-50 ring-2 ring-sky-100'
                      )}
                    >
                      <div className="text-sm font-bold text-slate-900">
                        {activeTarget === target.path ? '正在进入...' : target.label}
                      </div>
                      <div className="mt-2 text-xs leading-5 text-slate-500">{target.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5">
              <span className="text-slate-400">当前案例</span>
              <span className="font-medium text-slate-700">{selectedCase.title}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5">
              <span className="text-slate-400">页面数据</span>
              <span className={cn('font-medium', draftToken || persisted ? 'text-emerald-700' : 'text-slate-700')}>
                {persisted ? '已持久化' : draftToken ? '已准备' : '进入时自动写入'}
              </span>
            </span>
            <button
              type="button"
              onClick={handlePersist}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 hover:bg-emerald-100 transition"
            >
              <Pin className="h-3 w-3" />
              持久化当前案例
            </button>
            <button
              type="button"
              onClick={clearDemoData}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700"
            >
              重置体验数据
            </button>
            <Link href="/user-center" className="text-sm font-medium text-sky-700 hover:text-sky-900">
              返回个人中心
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function DemoStep({
  step,
  title,
  subtitle,
  children,
}: {
  step: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">{step}</div>
      <div className="mt-2 text-lg font-bold text-slate-900 md:text-xl">{title}</div>
      <div className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function PitchCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-5 py-5 min-h-[160px]">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-3 text-sm leading-6 text-slate-600">{text}</div>
    </div>
  );
}
