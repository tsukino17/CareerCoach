'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  BookOpenText,
  CalendarDays,
  Compass,
  MessageCircle,
  MessageSquareText,
  Search,
  Sparkles,
  Target,
  UsersRound,
} from 'lucide-react';

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

const ACTION_COACH_MEMORY_KEY = 'career_action_coach_memory';
const CATEGORY_LABELS: Record<string, string> = {
  info: '信息搜索',
  self: '梳理自我',
  build: '推进产出',
  connect: '连接他人',
  learn: '学习输入',
  step: '小步行动',
};
const MOOD_LABELS: Record<string, string> = {
  bright: '亮起来',
  steady: '稳稳的',
  stuck: '卡住中',
  low: '能量低',
};
const RESOURCE_LANES = [
  {
    label: '真实用户',
    detail: '谁真的遇到这个问题，谁愿意付出时间、注意力或钱。',
    icon: UsersRound,
  },
  {
    label: '线上渠道',
    detail: '评论区、社群、平台数据、搜索结果里正在出现的需求信号。',
    icon: Search,
  },
  {
    label: '可访问的人',
    detail: '朋友、同事、从业者、潜在客户，能给你真实反馈的人。',
    icon: MessageCircle,
  },
  {
    label: '验证信号',
    detail: '竞品案例、付费迹象、使用痕迹、可展示作品和最小实验。',
    icon: Target,
  },
];

export default function CoachMemoryPage() {
  const [entries, setEntries] = useState<CoachMemoryEntry[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    setEntries(readCoachMemoryEntries());
  }, []);

  const newestFirst = useMemo(
    () => [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [entries]
  );
  const filteredEntries = activeFilter === 'all' ? newestFirst : newestFirst.filter((entry) => entry.category === activeFilter);
  const topResources = useMemo(() => getTopResources(entries), [entries]);
  const filters = useMemo(() => ['all', ...Array.from(new Set(entries.map((entry) => entry.category)))], [entries]);

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#F3F8FF 0%, #FFFFFF 55%, #F7FBFF 100%)' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 18px 36px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: 10, letterSpacing: 2.4, color: 'rgba(74,104,140,0.5)', textTransform: 'uppercase' }}>
              Coach Memory
            </span>
            <h1 style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: '#0f172a' }}>教练记忆</h1>
            <p style={{ marginTop: 6, maxWidth: 600, color: 'rgba(62,79,106,0.72)', lineHeight: 1.7, fontSize: 14 }}>
              这里会把每次行动力教练对话沉淀下来：你提到的主题、状态、现实资源线索，以及下一步可以回看的方向。
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Link href="/coach/action" style={pillLinkStyle}>返回教练</Link>
            <Link href="/coach/action/calendar" style={pillLinkStyle}>行动日历</Link>
          </div>
        </header>

        <section style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
          <StatCard icon={Archive} label="归档对话" value={`${entries.length} 轮`} />
          <StatCard icon={Compass} label="主题方向" value={`${new Set(entries.map((entry) => entry.category)).size || 0} 类`} />
          <StatCard icon={Search} label="资源线索" value={`${topResources.length} 个`} />
        </section>

        <section style={{ marginTop: 16, ...panelStyle }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: 'rgba(74,104,140,0.56)' }}>现实资源地图</div>
              <div style={{ marginTop: 4, color: '#1f3b5f', fontSize: 18, fontWeight: 900 }}>最近反复出现的外部线索</div>
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {topResources.length ? topResources.map((resource) => (
                <span key={resource} style={resourceChipStyle}>{resource}</span>
              )) : <span style={resourceChipStyle}>等待对话点亮</span>}
            </div>
          </div>
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            {RESOURCE_LANES.map((lane) => {
              const Icon = lane.icon;
              const isActive = topResources.includes(lane.label);
              return (
                <div
                  key={lane.label}
                  style={{
                    minHeight: 112,
                    borderRadius: 18,
                    padding: 12,
                    background: isActive ? 'rgba(134,184,255,0.18)' : 'rgba(255,255,255,0.58)',
                    border: `1px solid ${isActive ? 'rgba(80,145,240,0.36)' : 'rgba(134,184,255,0.14)'}`,
                  }}
                >
                  <span style={{ ...iconBadgeStyle, width: 30, height: 30, borderRadius: 12 }}>
                    <Icon size={15} />
                  </span>
                  <div style={{ marginTop: 10, color: '#1f3b5f', fontSize: 13, fontWeight: 900 }}>{lane.label}</div>
                  <p style={{ marginTop: 5, color: 'rgba(62,79,106,0.66)', fontSize: 12, lineHeight: 1.6 }}>
                    {lane.detail}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {filters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              style={{
                border: '1px solid rgba(134,184,255,0.26)',
                borderRadius: 999,
                padding: '8px 12px',
                background: activeFilter === filter ? 'rgba(134,184,255,0.22)' : 'rgba(255,255,255,0.66)',
                color: activeFilter === filter ? '#1f3b5f' : 'rgba(74,104,140,0.68)',
                fontSize: 12,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              {filter === 'all' ? '全部' : CATEGORY_LABELS[filter] || filter}
            </button>
          ))}
        </div>

        <section style={{ marginTop: 12, display: 'grid', gap: 12 }}>
          {filteredEntries.length ? filteredEntries.map((entry) => (
            <article key={entry.id} style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={iconBadgeStyle}><MessageSquareText size={17} /></span>
                  <div>
                    <div style={{ fontSize: 12, color: 'rgba(74,104,140,0.56)', fontWeight: 900 }}>
                      {formatDateTime(entry.createdAt)}
                    </div>
                    <h2 style={{ marginTop: 3, fontSize: 17, color: '#0f172a', fontWeight: 900 }}>
                      {entry.summary}
                    </h2>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={tagStyle}>{CATEGORY_LABELS[entry.category] || '小步行动'}</span>
                  <span style={tagStyle}>{MOOD_LABELS[entry.mood] || '稳稳的'}</span>
                </div>
              </div>

              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
                <MemoryBlock icon={BookOpenText} title="用户原话" text={entry.userText} />
                <MemoryBlock icon={Sparkles} title="教练回应" text={entry.coachReply} />
              </div>

              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
                <div style={smallPanelStyle}>
                  <div style={smallTitleStyle}>资源线索</div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {entry.resources.length ? entry.resources.map((resource) => (
                      <span key={resource} style={resourceChipStyle}>{resource}</span>
                    )) : <span style={emptyTextStyle}>还没有明显线索</span>}
                  </div>
                </div>
                <div style={smallPanelStyle}>
                  <div style={smallTitleStyle}>可回看的下一步</div>
                  <p style={{ marginTop: 7, color: 'rgba(62,79,106,0.78)', fontSize: 13, lineHeight: 1.7 }}>{entry.nextStep}</p>
                </div>
              </div>
            </article>
          )) : (
            <div style={{ ...panelStyle, textAlign: 'center', color: 'rgba(62,79,106,0.68)', lineHeight: 1.8 }}>
              还没有归档的教练对话。回到行动力教练聊一轮后，这里会自动出现可回看的记忆。
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function MemoryBlock({ icon: Icon, title, text }: { icon: typeof BookOpenText; title: string; text: string }) {
  return (
    <div style={smallPanelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, ...smallTitleStyle }}>
        <Icon size={14} />
        {title}
      </div>
      <p style={{ marginTop: 8, color: 'rgba(62,79,106,0.78)', fontSize: 13, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
        {text}
      </p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Archive; label: string; value: string }) {
  return (
    <div style={{ ...panelStyle, padding: 14, display: 'flex', alignItems: 'center', gap: 11 }}>
      <span style={iconBadgeStyle}><Icon size={17} /></span>
      <span>
        <div style={{ fontSize: 12, color: 'rgba(74,104,140,0.58)', fontWeight: 800 }}>{label}</div>
        <div style={{ marginTop: 2, fontSize: 17, color: '#0f172a', fontWeight: 900 }}>{value}</div>
      </span>
    </div>
  );
}

function readCoachMemoryEntries(): CoachMemoryEntry[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(ACTION_COACH_MEMORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const entry = item as Partial<CoachMemoryEntry>;
        if (typeof entry.userText !== 'string' || typeof entry.coachReply !== 'string' || typeof entry.createdAt !== 'string') return null;
        return {
          id: typeof entry.id === 'string' ? entry.id : entry.createdAt,
          createdAt: entry.createdAt,
          userText: entry.userText,
          coachReply: entry.coachReply,
          category: typeof entry.category === 'string' ? entry.category : 'step',
          mood: typeof entry.mood === 'string' ? entry.mood : 'steady',
          summary: typeof entry.summary === 'string' ? entry.summary : summarizeText(entry.userText),
          resources: Array.isArray(entry.resources) ? entry.resources.filter((resource): resource is string => typeof resource === 'string') : [],
          nextStep: typeof entry.nextStep === 'string' ? entry.nextStep : '回到这条记录，继续看一个现实里能验证的小问题。',
        };
      })
      .filter((entry): entry is CoachMemoryEntry => Boolean(entry));
  } catch {
    return [];
  }
}

function getTopResources(entries: CoachMemoryEntry[]) {
  const counts = entries.flatMap((entry) => entry.resources).reduce<Record<string, number>>((acc, resource) => {
    acc[resource] = (acc[resource] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([resource]) => resource);
}

function summarizeText(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 42 ? `${clean.slice(0, 42)}...` : clean;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const pillLinkStyle: React.CSSProperties = {
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 800,
  color: 'rgba(74,104,140,0.95)',
  padding: '9px 13px',
  borderRadius: 999,
  background: 'rgba(134,184,255,0.14)',
  border: '1px solid rgba(134,184,255,0.35)',
};

const panelStyle: React.CSSProperties = {
  borderRadius: 24,
  border: '1px solid rgba(134,184,255,0.16)',
  background: 'rgba(255,255,255,0.58)',
  boxShadow: '0 20px 50px rgba(15,23,42,0.04)',
  backdropFilter: 'blur(18px)',
  padding: 16,
};

const smallPanelStyle: React.CSSProperties = {
  borderRadius: 18,
  border: '1px solid rgba(134,184,255,0.14)',
  background: 'rgba(255,255,255,0.62)',
  padding: 12,
};

const iconBadgeStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 14,
  background: 'rgba(134,184,255,0.18)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#4d7fbd',
};

const smallTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: 'rgba(74,104,140,0.62)',
};

const tagStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: '6px 9px',
  background: 'rgba(134,184,255,0.14)',
  color: '#1f3b5f',
  fontSize: 12,
  fontWeight: 900,
};

const resourceChipStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: '7px 10px',
  background: 'rgba(134,184,255,0.14)',
  border: '1px solid rgba(134,184,255,0.18)',
  color: '#1f3b5f',
  fontSize: 12,
  fontWeight: 900,
};

const emptyTextStyle: React.CSSProperties = {
  color: 'rgba(74,104,140,0.52)',
  fontSize: 13,
  fontWeight: 800,
};
