'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  Compass,
  Dot,
  Lightbulb,
  MessageSquare,
  Sparkles,
  Target,
  UserRound,
} from 'lucide-react';
import { REPORT_STORAGE_KEY, type CareerReport } from '@/lib/career-path';
import {
  ACTION_COACH_MEMORY_KEY,
  ACTION_COACH_RECORDS_KEY,
  ACTION_VISION_STORAGE_KEY,
} from '@/lib/experience-flow';

type ActionCoachRecord = {
  content: string;
  createdAt: string;
  category?: string;
  mood?: string;
  summary?: string;
  resources?: string[];
  nextStep?: string;
};

type CoachMemoryEntry = {
  id: string;
  createdAt: string;
  userText: string;
  coachReply: string;
  category: string;
  mood: string;
  summary: string;
  resources: string[];
  nextStep: string;
};

type VisionDraft = {
  ideal_statement: string;
  daily_state: string;
  daily_routine: string;
  next_actions: string;
  already_have: string;
  can_grow: string;
  identity_words: string;
  savedAt?: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  info: '信息搜索',
  self: '梳理自我',
  build: '推进产出',
  connect: '连接他人',
  learn: '学习输入',
  step: '小步行动',
};

export default function ProfilePage() {
  const [report, setReport] = useState<CareerReport | null>(null);
  const [vision, setVision] = useState<VisionDraft | null>(null);
  const [records, setRecords] = useState<ActionCoachRecord[]>([]);
  const [memory, setMemory] = useState<CoachMemoryEntry[]>([]);
  const [viewportWidth, setViewportWidth] = useState(1280);

  useEffect(() => {
    setReport(readStorage<CareerReport>(REPORT_STORAGE_KEY));
    setVision(readStorage<VisionDraft>(ACTION_VISION_STORAGE_KEY));
    setRecords(readStorage<ActionCoachRecord[]>(ACTION_COACH_RECORDS_KEY) || []);
    setMemory(readStorage<CoachMemoryEntry[]>(ACTION_COACH_MEMORY_KEY) || []);
  }, []);

  useEffect(() => {
    const updateLayout = () => setViewportWidth(window.innerWidth);
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  const activeDays = useMemo(() => new Set(records.map((item) => item.createdAt.slice(0, 10))).size, [records]);
  const recentRecord = records[records.length - 1] || null;
  const recentMemory = [...memory].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0] || null;
  const topResources = useMemo(() => {
    const pool = [...records.flatMap((item) => item.resources || []), ...memory.flatMap((item) => item.resources || [])];
    return Array.from(new Set(pool.filter(Boolean))).slice(0, 6);
  }, [records, memory]);
  const topCategories = useMemo(() => {
    const categories = records.map((item) => item.category).filter((item): item is string => Boolean(item));
    return Array.from(new Set(categories)).slice(0, 4);
  }, [records]);
  const storySignals = useMemo(() => buildStorySignals({ report, vision, records, memory, topCategories, topResources }), [report, vision, records, memory, topCategories, topResources]);
  const chapterTimeline = useMemo(() => buildChapterTimeline({ report, vision, records, memory }), [report, vision, records, memory]);
  const personalizedNarrative = useMemo(() => buildPersonalizedNarrative({ report, vision, records, memory, topCategories, topResources }), [report, vision, records, memory, topCategories, topResources]);
  const isMobile = viewportWidth < 760;
  const isTablet = viewportWidth >= 760 && viewportWidth < 1120;

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#fffdf9 0%, #ffffff 52%, #f4f8ff 100%)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: isMobile ? '24px 14px 34px' : '30px 16px 40px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 2.4, color: 'rgba(74,104,140,0.5)', textTransform: 'uppercase' }}>Profile Overview</div>
            <h1 style={{ marginTop: 6, fontSize: isMobile ? 24 : 28, fontWeight: 900, color: '#0f172a' }}>成长档案</h1>
            <p style={{ marginTop: 8, maxWidth: 680, color: 'rgba(62,79,106,0.72)', lineHeight: 1.8, fontSize: 14 }}>
              这里不是一次性的测试结果，而是你在这条长期陪伴路线里的基础档案、方向判断和阶段进展。适合时不时回来，看看你是谁、你在往哪里靠近、最近推进到哪了。
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/user-center" style={pillLinkStyle}>个人中心</Link>
            <Link href="/path" style={pillLinkStyle}>现实路径教练</Link>
          </div>
        </header>

        <section
          style={{
            marginTop: 18,
            ...heroPanelStyle,
            padding: isMobile ? 18 : isTablet ? 22 : 26,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at top right, rgba(134,184,255,0.18), transparent 30%), radial-gradient(circle at left center, rgba(187,224,255,0.22), transparent 26%)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative', display: 'grid', gap: isTablet ? 18 : 22, gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.15fr) minmax(280px, 0.85fr)' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 999, background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(134,184,255,0.22)', padding: '7px 11px', fontSize: 12, fontWeight: 800, color: '#547792' }}>
                <Sparkles size={14} />
                当前章节
              </div>
              <div style={{ marginTop: 14, fontSize: isMobile ? 16 : isTablet ? 18 : 20, lineHeight: 1.4, fontWeight: 900, color: '#0f172a', maxWidth: 520 }}>{storySignals.chapterTitle}</div>
              <p style={{ marginTop: 12, maxWidth: 620, color: 'rgba(15,23,42,0.68)', fontSize: 15, lineHeight: 1.9 }}>
                {storySignals.chapterBody}
              </p>

              <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
                <NarrativeBullet text={storySignals.transitionSummary} />
                <NarrativeBullet text={storySignals.progressSummary} />
                <NarrativeBullet text={storySignals.resourceSummary} />
              </div>
            </div>

            <div style={chapterCardStyle}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, color: 'rgba(84,119,146,0.76)' }}>阶段位置</div>
              <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
                {storySignals.stages.map((stage, index) => (
                  <div key={stage.title} style={{ display: 'grid', gridTemplateColumns: '26px minmax(0, 1fr)', gap: 10, alignItems: 'start' }}>
                    <div style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 999,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: stage.active ? 'rgba(134,184,255,0.32)' : stage.complete ? 'rgba(191,219,254,0.42)' : 'rgba(255,255,255,0.8)',
                          border: `1px solid ${stage.active ? 'rgba(59,130,246,0.45)' : 'rgba(148,163,184,0.24)'}`,
                          color: stage.active || stage.complete ? '#2563eb' : 'rgba(100,116,139,0.62)',
                        }}
                      >
                        {stage.complete ? <CheckCircle2 size={12} /> : <Dot size={18} />}
                      </span>
                      {index < storySignals.stages.length - 1 ? (
                        <span style={{ width: 1, height: 28, background: 'linear-gradient(180deg, rgba(134,184,255,0.4), rgba(226,232,240,0.7))' }} />
                      ) : null}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: stage.active ? 900 : 800, color: stage.active ? '#0f172a' : 'rgba(15,23,42,0.72)' }}>{stage.title}</div>
                      <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.7, color: 'rgba(84,119,146,0.74)' }}>{stage.detail}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16, borderRadius: 18, background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(134,184,255,0.18)', padding: '14px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(84,119,146,0.76)' }}>下一章最值得做的一步</div>
                <div style={{ marginTop: 8, fontSize: 15, lineHeight: 1.8, color: '#0f172a', fontWeight: 800 }}>{storySignals.nextChapterTitle}</div>
                <div style={{ marginTop: 6, color: 'rgba(15,23,42,0.66)', fontSize: 13, lineHeight: 1.8 }}>{storySignals.nextChapterBody}</div>
              </div>
            </div>
          </div>
        </section>

        <section
          style={{
            marginTop: 20,
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : isTablet ? 'repeat(4, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
            gap: isMobile ? 8 : 10,
          }}
        >
          <StatCard icon={BookOpen} label="职业原型" value={report?.archetype || '待生成'} />
          <StatCard icon={Sparkles} label="行动记录" value={`${records.length} 条`} />
          <StatCard icon={CalendarDays} label="记录天数" value={`${activeDays} 天`} />
          <StatCard icon={Archive} label="教练记忆" value={`${memory.length} 轮`} />
        </section>

        <div
          style={{
            marginTop: 18,
            display: 'grid',
            gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1.2fr) minmax(320px, 0.8fr)',
            gap: isTablet ? 14 : 16,
          }}
        >
          <section style={buildPanelStyle(isTablet ? 18 : 20)}>
            <div style={sectionTitleStyle}>
              <Brain size={16} />
              基础档案
            </div>
            <div style={{ marginTop: 14, display: 'grid', gap: isTablet ? 12 : 14 }}>
              <ProfileBlock
                title="职业原型"
                text={report?.archetype || '还没有生成职业原型。先完成一次天赋对话和报告，这里就会自动出现。'}
              />
              <ProfileBlock
                title="核心能力"
                text={report?.skills?.length ? report.skills.join('、') : '还没有沉淀核心能力条目。'}
              />
              <ProfileBlock
                title="适合方向"
                text={report?.target_roles?.length ? report.target_roles.join('、') : '还没有明确方向线索。'}
              />
              <ProfileBlock
                title="当前画像总结"
                text={report?.summary || '完成报告后，这里会显示你当前的画像总结。'}
              />
              <ProfileBlock
                title="这一章里更凸显的能力"
                text={storySignals.emergingStrength}
              />
            </div>
          </section>

          <section style={buildPanelStyle(isTablet ? 18 : 20)}>
            <div style={sectionTitleStyle}>
              <Compass size={16} />
              当前方向感
            </div>
            <div style={{ marginTop: 14, display: 'grid', gap: isTablet ? 10 : 12 }}>
              <ProfileBlock
                title="身份愿景"
                text={vision?.ideal_statement || '还没有填写身份愿景板。方向明确后，可以把它写成你的长期指北针。'}
              />
              <ProfileBlock
                title="理想状态"
                text={vision?.daily_state || '还没有记录理想中的日常状态。'}
              />
              <ProfileBlock
                title="身份关键词"
                text={vision?.identity_words || '还没有提炼身份关键词。'}
              />
              <ProfileBlock
                title="最近最值得继续的一步"
                text={recentMemory?.nextStep || recentRecord?.nextStep || '还没有明显的下一步提示。和行动力教练聊过后，这里会慢慢长出来。'}
              />
              <ProfileBlock
                title="你在靠近的样子"
                text={storySignals.identityReflection}
              />
            </div>
          </section>
        </div>

        <div
          style={{
            marginTop: 16,
            display: 'grid',
            gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: isTablet ? 14 : 16,
          }}
        >
          <section style={buildPanelStyle(isTablet ? 18 : 20)}>
            <div style={sectionTitleStyle}>
              <CalendarDays size={16} />
              章节轨迹
            </div>
            <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
              {chapterTimeline.map((item, index) => (
                <div key={`${item.title}-${index}`} style={{ display: 'grid', gridTemplateColumns: '30px minmax(0, 1fr)', gap: 12, alignItems: 'start' }}>
                  <div style={{ display: 'grid', justifyItems: 'center' }}>
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: item.active ? 'rgba(96,165,250,0.28)' : 'rgba(255,255,255,0.92)',
                        border: `1px solid ${item.active ? 'rgba(59,130,246,0.45)' : 'rgba(148,163,184,0.26)'}`,
                        color: item.active ? '#2563eb' : 'rgba(100,116,139,0.6)',
                      }}
                    >
                      {item.active ? <CheckCircle2 size={12} /> : <Dot size={18} />}
                    </span>
                    {index < chapterTimeline.length - 1 ? (
                      <span style={{ width: 1, height: 42, background: 'linear-gradient(180deg, rgba(134,184,255,0.42), rgba(226,232,240,0.82))' }} />
                    ) : null}
                  </div>
                  <div style={subPanelStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>{item.title}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(84,119,146,0.62)' }}>{item.dateLabel}</div>
                    </div>
                    <div style={{ marginTop: 8, color: 'rgba(15,23,42,0.68)', fontSize: 14, lineHeight: 1.8 }}>{item.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={buildPanelStyle(isTablet ? 18 : 20)}>
            <div style={sectionTitleStyle}>
              <MessageSquare size={16} />
              个性化叙事
            </div>
            <div style={{ marginTop: 14, ...subPanelStyle, background: 'linear-gradient(180deg, rgba(250,250,252,0.96) 0%, rgba(245,249,255,0.9) 100%)' }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, color: 'rgba(84,119,146,0.72)' }}>这一段时间的你</div>
              <div style={{ marginTop: 10, color: '#0f172a', fontSize: isMobile ? 15 : 16, lineHeight: 2 }}>
                {personalizedNarrative.map((paragraph, index) => (
                  <p key={index} style={{ margin: index === 0 ? 0 : '12px 0 0' }}>{paragraph}</p>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div
          style={{
            marginTop: 16,
            display: 'grid',
            gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: isTablet ? 14 : 16,
          }}
        >
          <section style={buildPanelStyle(isTablet ? 18 : 20)}>
            <div style={sectionTitleStyle}>
              <Target size={16} />
              最近的推进情况
            </div>
            <div style={{ marginTop: 14, display: 'grid', gap: isTablet ? 10 : 12 }}>
              <TimelineCard
                title="最近一次行动记录"
                subtitle={recentRecord ? formatDateTime(recentRecord.createdAt) : '还没有记录'}
                text={recentRecord?.summary || recentRecord?.content || '你每次和行动力教练聊完后，这里会留下最近的推进痕迹。'}
              />
              <TimelineCard
                title="最近一次教练判断"
                subtitle={recentMemory ? formatDateTime(recentMemory.createdAt) : '还没有归档'}
                text={recentMemory?.summary || '教练记忆会把你反复提到的主题、状态和下一步沉淀在这里。'}
              />
              <TimelineCard
                title="近期高频主题"
                subtitle={topCategories.length ? '最近经常出现的话题' : '等待积累'}
                text={topCategories.length ? topCategories.map((item) => CATEGORY_LABELS[item] || item).join('、') : '还没有足够多的行动记录来判断主题分布。'}
              />
              <TimelineCard
                title="这段时间发生了什么变化"
                subtitle="阶段变化摘要"
                text={storySignals.changeNarrative}
              />
            </div>
          </section>

          <section style={buildPanelStyle(isTablet ? 18 : 20)}>
            <div style={sectionTitleStyle}>
              <Lightbulb size={16} />
              现实资源线索
            </div>
            <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {topResources.length ? topResources.map((resource) => (
                <span key={resource} style={resourceChipStyle}>{resource}</span>
              )) : (
                <span style={emptyChipStyle}>还没有明显的资源线索</span>
              )}
            </div>
            <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
              <InfoCard
                icon={MessageSquare}
                title="教练对话"
                text="当你反复聊到某个方向、资源或现实顾虑时，这里会慢慢形成一张属于你的资源地图。"
              />
              <InfoCard
                icon={UserRound}
                title="基本状态"
                text={vision?.daily_state || '你的基础状态还在慢慢被看见。后续可以通过愿景板和行动记录一起补齐。'}
              />
              <InfoCard
                icon={Lightbulb}
                title="为什么现在值得看这些线索"
                text={storySignals.whyNow}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function readStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildChapterTimeline({
  report,
  vision,
  records,
  memory,
}: {
  report: CareerReport | null;
  vision: VisionDraft | null;
  records: ActionCoachRecord[];
  memory: CoachMemoryEntry[];
}) {
  const items: Array<{ title: string; text: string; dateLabel: string; active: boolean; rawDate: number }> = [];

  if (report) {
    items.push({
      title: '看见职业画像',
      text: `你先拥有了一份${report.archetype || '职业画像'}，开始把“模糊感受”整理成可以回看的理解。`,
      dateLabel: '起点',
      active: true,
      rawDate: 0,
    });
  }

  if (vision?.savedAt || vision?.ideal_statement) {
    items.push({
      title: '写下愿景指北针',
      text: vision?.ideal_statement
        ? `你开始明确自己想靠近的样子：${trimSentence(vision.ideal_statement, 48)}`
        : '你把模糊的方向感，写成了更清楚的愿景指北针。',
      dateLabel: vision?.savedAt ? formatDateTime(vision.savedAt) : '方向浮现后',
      active: true,
      rawDate: vision?.savedAt ? new Date(vision.savedAt).getTime() : 1,
    });
  }

  if (records.length) {
    const firstRecord = [...records].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))[0];
    items.push({
      title: '留下第一次行动痕迹',
      text: firstRecord?.summary || trimSentence(firstRecord?.content || '你开始把想法带到行动里。', 42),
      dateLabel: firstRecord ? formatDateTime(firstRecord.createdAt) : '行动开始',
      active: true,
      rawDate: firstRecord ? new Date(firstRecord.createdAt).getTime() : 2,
    });
  }

  if (memory.length) {
    const latestMemory = [...memory].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
    items.push({
      title: '开始形成阶段判断',
      text: latestMemory?.summary
        ? `教练开始帮你把零散感受沉淀成判断：${trimSentence(latestMemory.summary, 44)}`
        : '教练记忆开始把你的阶段性变化沉淀下来。',
      dateLabel: latestMemory ? formatDateTime(latestMemory.createdAt) : '最近',
      active: true,
      rawDate: latestMemory ? new Date(latestMemory.createdAt).getTime() : 3,
    });
  }

  if (!items.length) {
    items.push({
      title: '故事还没正式开始',
      text: '当你完成第一次天赋对话和报告后，这里会开始记录属于你的成长轨迹。',
      dateLabel: '等待开始',
      active: true,
      rawDate: 0,
    });
  }

  return items.sort((a, b) => a.rawDate - b.rawDate);
}

function buildPersonalizedNarrative({
  report,
  vision,
  records,
  memory,
  topCategories,
  topResources,
}: {
  report: CareerReport | null;
  vision: VisionDraft | null;
  records: ActionCoachRecord[];
  memory: CoachMemoryEntry[];
  topCategories: string[];
  topResources: string[];
}) {
  const paragraphs: string[] = [];
  const latestRecord = records[records.length - 1];
  const latestMemory = [...memory].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];

  if (report?.archetype || report?.summary) {
    const summaryText = report?.summary ? trimSentence(report.summary, 64) : '你已经开始拥有一份更能代表自己的职业画像。';
    paragraphs.push(`你不是从空白开始的。${report?.archetype ? `在这段陪伴里，你先看见了自己身上偏向“${report.archetype}”的一面。` : '在这段陪伴里，你先重新看见了自己。'} ${summaryText}`);
  } else {
    paragraphs.push('你还在把故事的第一段讲清楚。现在最重要的不是赶进度，而是先把那些真实的困惑、偏好和犹豫说出来。');
  }

  if (vision?.ideal_statement || vision?.identity_words) {
    const identityWords = vision?.identity_words ? `你想靠近的身份关键词是 ${vision.identity_words}。` : '';
    const ideal = vision?.ideal_statement ? `你已经开始把方向写成一句更像自己的话：${trimSentence(vision.ideal_statement, 52)}` : '';
    paragraphs.push(`${identityWords}${ideal}`.trim());
  } else if (records.length || memory.length) {
    paragraphs.push('虽然愿景还没有完全定稿，但你已经不是停留在“我该做什么”的层面，而是在慢慢靠近“我想成为什么样的人”。');
  }

  if (topCategories.length || topResources.length) {
    const categoryText = topCategories.length
      ? `最近更常出现的话题是 ${topCategories.map((item) => CATEGORY_LABELS[item] || item).join('、')}。`
      : '';
    const resourceText = topResources.length
      ? `与此同时，你也开始更频繁地注意到 ${topResources.slice(0, 3).join('、')} 这些现实线索。`
      : '';
    paragraphs.push(`${categoryText}${resourceText} 这说明你的关注点正在从“理解自己”慢慢转向“让现实世界回应你的方向”。`.trim());
  }

  if (latestMemory?.nextStep || latestRecord?.nextStep) {
    paragraphs.push(`眼下这一章最值得继续的，不一定是做更多，而是把下一步做得更贴近你真正想靠近的方向。${latestMemory?.nextStep || latestRecord?.nextStep || ''}`);
  }

  return paragraphs.filter(Boolean);
}

function trimSentence(text: string, max = 48) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}...`;
}

function buildStorySignals({
  report,
  vision,
  records,
  memory,
  topCategories,
  topResources,
}: {
  report: CareerReport | null;
  vision: VisionDraft | null;
  records: ActionCoachRecord[];
  memory: CoachMemoryEntry[];
  topCategories: string[];
  topResources: string[];
}) {
  const hasReport = Boolean(report);
  const hasVision = Boolean(vision?.ideal_statement);
  const hasAction = records.length > 0;
  const hasRhythm = records.length >= 4 || memory.length >= 3;

  const latestRecord = records[records.length - 1] || null;
  const latestMemory = [...memory].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0] || null;

  const currentStage = !hasReport ? 0 : !hasVision ? 1 : !hasAction ? 2 : !hasRhythm ? 3 : 4;
  const stages = [
    { title: '看见自己', detail: '通过天赋对话和报告，先把自己说清楚。', active: currentStage === 0, complete: currentStage > 0 || hasReport },
    { title: '收拢方向', detail: '从很多可能里，慢慢看见更值得靠近的方向。', active: currentStage === 1, complete: currentStage > 1 || hasVision },
    { title: '写下指北针', detail: '把愿景写清楚，知道自己想靠近怎样的状态。', active: currentStage === 2, complete: currentStage > 2 || hasAction },
    { title: '形成行动节奏', detail: '开始留下记录，慢慢看见推进的手感。', active: currentStage === 3, complete: currentStage > 3 || hasRhythm },
    { title: '现实验证', detail: '更频繁地把想法带到真实资源和现实路径里。', active: currentStage === 4, complete: hasRhythm && topResources.length > 0 },
  ];

  const chapterTitle = hasRhythm
    ? '你正在把理解自己的能力，慢慢翻译成现实推进力'
    : hasAction
      ? '你已经从“知道一些自己”，走到“开始试着往前走”'
      : hasVision
        ? '你已经不只是理解自己，还开始为自己写方向'
        : hasReport
          ? '你正在从“看见自己”，走向“收拢方向”'
          : '你还在故事的开头，先把自己说清楚就很好';

  const chapterBody = hasRhythm
    ? '最近的记录说明，你已经不只是在做自我观察，而是在试着把判断带到现实里。这个阶段最重要的，不是做得多，而是让每一步都越来越贴近你真正想靠近的方向。'
    : hasAction
      ? '你已经开始留下行动痕迹了。现在这段路最有价值的是，慢慢发现什么样的推进方式适合你，什么样的现实问题值得认真回答。'
      : hasVision
        ? '愿景板让你开始拥有一张更清晰的内在地图。接下来，产品要做的是帮助你把这张地图和现实世界连起来。'
        : hasReport
          ? '报告让你先看见了一些更清楚的自己。下一步不是急着执行，而是从这些线索里慢慢确认，哪条方向真的值得你靠近。'
          : '你的成长档案会从第一次对话开始长出来。现在还不用急着完整，只要先把自己真实的困惑说出来。';

  const transitionSummary = hasReport
    ? `你已经拥有了以${report?.archetype || '职业画像'}为起点的基础理解，这让后面的选择不再完全从空白开始。`
    : '你还没有生成职业画像，但这也意味着故事还在非常早的阶段，后面每一步都会让它更清楚。';

  const progressSummary = hasAction
    ? `最近你已经留下 ${records.length} 条行动记录，跨过了 ${new Set(records.map((item) => item.createdAt.slice(0, 10))).size} 天，这说明你在慢慢建立自己的推进节奏。`
    : '现在还没有留下连续行动记录，所以这一章更适合先把方向和愿景说得更清楚。';

  const resourceSummary = topResources.length
    ? `最近开始频繁浮现的现实线索包括：${topResources.slice(0, 3).join('、')}。这说明你已经不只在想“我是谁”，而是在问“我怎么把它放进现实世界”。`
    : '现实资源线索还不多，后面和教练继续聊资源、岗位、案例时，这一层会慢慢丰富起来。';

  const nextChapterTitle = hasRhythm
    ? '继续把判断带进现实线索里'
    : hasAction
      ? '把最近这几步整理成更稳定的节奏'
      : hasVision
        ? '把愿景翻译成更现实的路径和资源判断'
        : hasReport
          ? '从报告里选一条最想验证的方向'
          : '先完成一次天赋对话和报告';

  const nextChapterBody = hasRhythm
    ? latestMemory?.nextStep || '现在最值得做的是，把最近反复出现的主题拿去对应真实案例、岗位或用户线索，让判断更落地。'
    : hasAction
      ? latestMemory?.nextStep || latestRecord?.nextStep || '先把最近反复出现的一步动作稳定下来，不用急着铺得太开。'
      : hasVision
        ? '愿景已经有了，下一步更值得做的是去现实路径地图或咨询工具箱，把“理想中的自己”翻译成真实职业世界。'
        : hasReport
          ? '从报告里挑一个最有感觉的方向，问自己：我最想先验证哪一条路？'
          : '先让这份档案从一场真实对话开始，其他内容都会随后长出来。';

  const changeNarrative = hasRhythm
    ? `一开始你更多是在理解自己，最近则更频繁地提到${topCategories.map((item) => CATEGORY_LABELS[item] || item).slice(0, 2).join('、')}。这说明你的关注点正在从“我是什么样的人”，慢慢转向“我该怎么把这些能力放到现实里”。`
    : hasAction
      ? '这段时间最明显的变化，不是你一下子变得很确定，而是你已经开始愿意把想法拿出来试、拿出来记。故事在这里第一次有了动作。'
      : hasVision
        ? '从只有职业画像，到开始写下愿景板，这意味着你已经不只是在被动理解自己，而是在主动决定自己想靠近什么。'
        : hasReport
          ? '从对话到报告，你已经完成了从“模糊感受”到“可被看见的画像”的第一轮转换。'
          : '现在的变化还很早期，但也正因为早，你后面的每一步都会很有分量。';

  const emergingStrength = hasRhythm
    ? '最近更显眼的，不只是你的原始倾向，而是你把它们往现实里转译的能力。你开始会留意资源、路径和推进节奏。'
    : hasAction
      ? '比起静态能力清单，现在更值得注意的是你开始把某些优势用到行动里，例如把感受整理成方向、把想法拆成下一步。'
      : report?.skills?.length
        ? `目前更清晰浮现出来的仍然是：${report.skills.slice(0, 3).join('、')}。`
        : '你的优势还在被慢慢看见，后面的对话和记录会让它更具体。';

  const identityReflection = hasVision
    ? `你想靠近的，不只是一个职位，更是一种状态：${vision?.daily_state || vision?.identity_words || '更稳定、更清楚地做自己'}。`
    : hasReport
      ? '虽然愿景还没有完全写出来，但你已经开始隐约知道，自己想成为什么样的人，而不只是做什么工作。'
      : '这部分会随着愿景板和行动记录慢慢成形。';

  const whyNow = topResources.length
    ? '因为你已经开始把目光从内在理解移向外部世界，这时候最值得看的就是：现实世界有没有线索在回应你的方向。'
    : '现在看资源线索，不是为了逼自己行动，而是为了慢慢训练自己把内在判断和外在世界连起来。';

  return {
    chapterTitle,
    chapterBody,
    transitionSummary,
    progressSummary,
    resourceSummary,
    nextChapterTitle,
    nextChapterBody,
    stages,
    changeNarrative,
    emergingStrength,
    identityReflection,
    whyNow,
  };
}

function StatCard({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: string }) {
  return (
    <div style={statCardStyle}>
      <span style={iconBadgeStyle}><Icon size={16} /></span>
      <div style={{ marginTop: 12, fontSize: 12, fontWeight: 800, color: 'rgba(74,104,140,0.56)' }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 900, color: '#1f3b5f' }}>{value}</div>
    </div>
  );
}

function ProfileBlock({ title, text }: { title: string; text: string }) {
  return (
    <div style={subPanelStyle}>
      <div style={{ fontSize: 12, fontWeight: 900, color: 'rgba(74,104,140,0.56)' }}>{title}</div>
      <div style={{ marginTop: 8, color: 'rgba(15,23,42,0.72)', fontSize: 14, lineHeight: 1.8 }}>{text}</div>
    </div>
  );
}

function TimelineCard({ title, subtitle, text }: { title: string; subtitle: string; text: string }) {
  return (
    <div style={subPanelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'rgba(74,104,140,0.56)', fontWeight: 800 }}>{subtitle}</div>
      </div>
      <div style={{ marginTop: 8, color: 'rgba(15,23,42,0.68)', fontSize: 14, lineHeight: 1.8 }}>{text}</div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, text }: { icon: typeof BookOpen; title: string; text: string }) {
  return (
    <div style={subPanelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...iconBadgeStyle, width: 30, height: 30, borderRadius: 12 }}><Icon size={15} /></span>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{title}</div>
      </div>
      <div style={{ marginTop: 8, color: 'rgba(15,23,42,0.68)', fontSize: 14, lineHeight: 1.8 }}>{text}</div>
    </div>
  );
}

function NarrativeBullet({ text }: { text: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '22px minmax(0,1fr)', gap: 10, alignItems: 'start' }}>
      <span style={{ marginTop: 6, width: 8, height: 8, borderRadius: 999, background: 'linear-gradient(135deg,#7dd3fc 0%, #60a5fa 100%)', boxShadow: '0 0 0 6px rgba(191,219,254,0.35)' }} />
      <div style={{ color: 'rgba(15,23,42,0.68)', fontSize: 14, lineHeight: 1.9 }}>{text}</div>
    </div>
  );
}

function buildPanelStyle(padding: number): React.CSSProperties {
  return {
    borderRadius: 24,
    border: '1px solid rgba(15,23,42,0.08)',
    background: 'rgba(255,255,255,0.84)',
    padding,
    boxShadow: '0 16px 46px rgba(15,23,42,0.05)',
  };
}

const heroPanelStyle: React.CSSProperties = {
  position: 'relative',
  borderRadius: 24,
  border: '1px solid rgba(15,23,42,0.08)',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(243,248,255,0.92) 100%)',
  boxShadow: '0 22px 60px rgba(15,23,42,0.08)',
};

const subPanelStyle: React.CSSProperties = {
  borderRadius: 18,
  border: '1px solid rgba(15,23,42,0.06)',
  background: 'rgba(250,250,252,0.92)',
  padding: 16,
};

const statCardStyle: React.CSSProperties = {
  borderRadius: 18,
  border: '1px solid rgba(15,23,42,0.06)',
  background: 'rgba(255,255,255,0.82)',
  padding: 16,
  boxShadow: '0 12px 32px rgba(15,23,42,0.04)',
};

const sectionTitleStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 15,
  fontWeight: 900,
  color: '#0f172a',
};

const iconBadgeStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 14,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(134,184,255,0.16)',
  border: '1px solid rgba(134,184,255,0.22)',
  color: '#3a6db4',
};

const chapterCardStyle: React.CSSProperties = {
  borderRadius: 20,
  border: '1px solid rgba(134,184,255,0.16)',
  background: 'rgba(248,251,255,0.84)',
  padding: 18,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.75)',
};

const pillLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  borderRadius: 999,
  border: '1px solid rgba(134,184,255,0.24)',
  background: 'rgba(255,255,255,0.86)',
  padding: '9px 13px',
  fontSize: 13,
  fontWeight: 800,
  color: '#1f3b5f',
  textDecoration: 'none',
};

const resourceChipStyle: React.CSSProperties = {
  borderRadius: 999,
  background: 'rgba(243,248,255,0.82)',
  border: '1px solid rgba(134,184,255,0.18)',
  padding: '7px 12px',
  fontSize: 12,
  fontWeight: 800,
  color: 'rgba(84,119,146,0.88)',
};

const emptyChipStyle: React.CSSProperties = {
  ...resourceChipStyle,
  color: 'rgba(84,119,146,0.56)',
};
