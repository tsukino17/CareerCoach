'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Compass,
  Flame,
  Frown,
  Gem,
  Lightbulb,
  MessageCircle,
  Meh,
  PenLine,
  Rocket,
  Search,
  Smile,
  Sparkles,
  Sprout,
  Target,
  Trophy,
  UserRoundSearch,
  Wrench,
} from 'lucide-react';

type ActionCoachRecord = {
  content: string;
  createdAt: string;
  category?: string;
  mood?: string;
  summary?: string;
  resources?: string[];
  nextStep?: string;
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

type DayBundle = {
  dateKey: string;
  records: ActionCoachRecord[];
};

const ACTION_COACH_RECORDS_KEY = 'career_action_coach_records';
const ACTION_VISION_STORAGE_KEY = 'career_action_identity_vision';
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const CATEGORY_META: Record<string, { label: string; color: string; icon: typeof Search }> = {
  info: { label: '信息搜索', color: '#74a9ff', icon: Search },
  self: { label: '梳理自我', color: '#9d8cff', icon: UserRoundSearch },
  build: { label: '推进产出', color: '#6fc7b1', icon: Wrench },
  connect: { label: '连接他人', color: '#ffb86c', icon: MessageCircle },
  learn: { label: '学习输入', color: '#8fb4ff', icon: BookOpen },
  step: { label: '小步行动', color: '#86b8ff', icon: Compass },
};

const MOOD_META: Record<string, { label: string; color: string; icon: typeof Smile }> = {
  bright: { label: '亮起来', color: '#7ccba2', icon: Smile },
  steady: { label: '稳稳的', color: '#86b8ff', icon: Meh },
  stuck: { label: '卡住中', color: '#b6a3ff', icon: Frown },
  low: { label: '能量低', color: '#f5a6a6', icon: Frown },
};

type Achievement = {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  icon: typeof Award;
  color: string;
};

export default function ActionCalendarPage() {
  const [records, setRecords] = useState<ActionCoachRecord[]>([]);
  const [vision, setVision] = useState<VisionDraft | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month');
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [isCompact, setIsCompact] = useState(false);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);

  useEffect(() => {
    const loaded = readActionCoachRecords();
    setRecords(loaded);
    setVision(readSavedVisionDraft());
    const latest = loaded[loaded.length - 1];
    if (latest) {
      const latestDate = new Date(latest.createdAt);
      setCursorDate(latestDate);
      setSelectedDate(toDateKey(latestDate));
    }
  }, []);

  useEffect(() => {
    const updateLayout = () => setIsCompact(window.innerWidth < 760);
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  const bundles = useMemo(() => groupRecordsByDate(records), [records]);
  const selectedBundle = bundles.get(selectedDate);
  const selectedResources = useMemo(() => getResourceSignals(selectedBundle?.records || []), [selectedBundle]);
  const visibleDates = useMemo(
    () => (viewMode === 'month' ? getMonthDates(cursorDate) : getWeekDates(cursorDate)),
    [cursorDate, viewMode]
  );
  const activeDays = records.length ? bundles.size : 0;
  const streak = useMemo(() => getRecentStreak(bundles), [bundles]);
  const achievements = useMemo(() => buildAchievements(records, activeDays, streak), [records, activeDays, streak]);
  const unlockedCount = achievements.filter((achievement) => achievement.unlocked).length;

  useEffect(() => {
    setSelectedResource(selectedResources[0] || null);
  }, [selectedDate, selectedResources]);

  const moveCalendar = (direction: -1 | 1) => {
    setCursorDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'month') next.setMonth(prev.getMonth() + direction);
      else next.setDate(prev.getDate() + direction * 7);
      return next;
    });
  };

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#F3F8FF 0%, #FFFFFF 55%, #F7FBFF 100%)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 18px 36px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: 10, letterSpacing: 2.4, color: 'rgba(74,104,140,0.5)', textTransform: 'uppercase' }}>
              Action Calendar
            </span>
            <h1 style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: '#0f172a' }}>行动日历</h1>
            <p style={{ marginTop: 6, maxWidth: 560, color: 'rgba(62,79,106,0.72)', lineHeight: 1.7, fontSize: 14 }}>
              每一次小行动都会变成一枚格子。慢慢看，你不是停在原地，而是在一点点靠近想成为的自己。
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Link href="/coach/action" style={pillLinkStyle}>返回教练</Link>
            <Link href="/coach/action/memory" style={pillLinkStyle}>教练记忆</Link>
            <Link href="/coach/action/vision" style={pillLinkStyle}>身份愿景板</Link>
          </div>
        </header>

        <section style={{ marginTop: 18, display: 'grid', gridTemplateColumns: isCompact ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
          <StatPill icon={CalendarDays} label="记录天数" value={`${activeDays} 天`} />
          <StatPill icon={Sparkles} label="连续记录" value={`${streak} 天`} />
          <StatPill icon={CheckCircle2} label="行动碎片" value={`${records.length} 条`} />
          <StatPill icon={Target} label="资源线索" value={`${countResourceSignals(records)} 个`} />
        </section>

        <VisionCompassCard vision={vision} isCompact={isCompact} />

        <section style={{ marginTop: 16, ...panelStyle }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: 'rgba(74,104,140,0.56)' }}>成就贴纸</div>
              <h2 style={{ marginTop: 4, color: '#1f3b5f', fontSize: 18, fontWeight: 900 }}>已收集 {unlockedCount}/{achievements.length}</h2>
            </div>
            <span style={{ ...resourceChipStyle, background: 'rgba(255,255,255,0.62)' }}>
              每次真实行动都会点亮一枚小证据
            </span>
          </div>
          <div style={{ marginTop: 13, display: 'grid', gridTemplateColumns: isCompact ? 'repeat(2, minmax(0, 1fr))' : 'repeat(6, minmax(0, 1fr))', gap: 10 }}>
            {achievements.map((achievement) => (
              <AchievementSticker key={achievement.id} achievement={achievement} />
            ))}
          </div>
        </section>

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'minmax(0, 1.45fr) minmax(280px, 0.75fr)', gap: 16 }}>
          <section style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" onClick={() => moveCalendar(-1)} style={roundButtonStyle} aria-label="上一段">‹</button>
                <div style={{ minWidth: 148, textAlign: 'center', fontWeight: 900, color: '#1f3b5f' }}>
                  {formatCalendarTitle(cursorDate, viewMode)}
                </div>
                <button type="button" onClick={() => moveCalendar(1)} style={roundButtonStyle} aria-label="下一段">›</button>
              </div>
              <div style={{ display: 'inline-flex', border: '1px solid rgba(134,184,255,0.32)', borderRadius: 999, padding: 4, background: 'rgba(255,255,255,0.72)' }}>
                {(['week', 'month'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    style={{
                      border: 'none',
                      borderRadius: 999,
                      padding: '7px 13px',
                      fontSize: 12,
                      fontWeight: 900,
                      color: viewMode === mode ? '#1f3b5f' : 'rgba(74,104,140,0.62)',
                      background: viewMode === mode ? 'rgba(134,184,255,0.22)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {mode === 'week' ? '周历' : '月历'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
              {WEEKDAYS.map((day) => (
                <div key={day} style={{ textAlign: 'center', fontSize: 12, fontWeight: 900, color: 'rgba(74,104,140,0.55)' }}>
                  {day}
                </div>
              ))}
              {visibleDates.map((date, index) => {
                const dateKey = date ? toDateKey(date) : `blank-${index}`;
                const bundle = date ? bundles.get(dateKey) : undefined;
                const isSelected = dateKey === selectedDate;
                return (
                  <button
                    key={dateKey}
                    type="button"
                    disabled={!date}
                    onClick={() => date && setSelectedDate(dateKey)}
                    style={{
                      minHeight: viewMode === 'month' ? 86 : 116,
                      borderRadius: 18,
                      border: isSelected ? '2px solid rgba(80,145,240,0.85)' : '1px solid rgba(134,184,255,0.18)',
                      background: date ? 'rgba(255,255,255,0.72)' : 'transparent',
                      boxShadow: date && bundle ? '0 12px 28px rgba(80,145,240,0.10)' : 'none',
                      cursor: date ? 'pointer' : 'default',
                      padding: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 7,
                      opacity: date ? 1 : 0,
                    }}
                  >
                    {date ? (
                      <>
                        <span style={{ fontSize: 12, fontWeight: 900, color: 'rgba(31,59,95,0.74)' }}>{date.getDate()}</span>
                        {bundle ? <DayIcons bundle={bundle} /> : <EmptyDayMark />}
                        {bundle ? <DayProgress records={bundle.records} /> : null}
                      </>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>

          <aside style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: 'rgba(74,104,140,0.55)' }}>当天总结</div>
                <h2 style={{ marginTop: 4, fontSize: 19, fontWeight: 900, color: '#0f172a' }}>{formatDateLabel(selectedDate)}</h2>
              </div>
              <MoodBadge records={selectedBundle?.records || []} />
            </div>

            {selectedBundle?.records.length ? (
              <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
                <DaySticker records={selectedBundle.records} />
                <div style={{ padding: 12, borderRadius: 16, background: 'rgba(134,184,255,0.12)', color: 'rgba(31,59,95,0.78)', lineHeight: 1.7, fontSize: 14 }}>
                  {buildDaySummary(selectedBundle.records)}
                </div>
                <ResourceMapPanel
                  resources={selectedResources}
                  selectedResource={selectedResource}
                  onSelect={setSelectedResource}
                />
                {selectedBundle.records.map((record, index) => (
                  <RecordRow key={`${record.createdAt}-${index}`} record={record} />
                ))}
              </div>
            ) : (
              <div style={{ marginTop: 18, padding: 16, borderRadius: 18, background: 'rgba(255,255,255,0.62)', border: '1px dashed rgba(134,184,255,0.35)', color: 'rgba(62,79,106,0.68)', lineHeight: 1.7 }}>
                这一天还没有记录。你可以回到行动力教练，写下一个小努力、一个卡点，或一点点状态变化。
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

function StatPill({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div style={{ ...panelStyle, padding: 14, display: 'flex', alignItems: 'center', gap: 11 }}>
      <span style={{ width: 34, height: 34, borderRadius: 14, background: 'rgba(134,184,255,0.18)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#4d7fbd' }}>
        <Icon size={18} />
      </span>
      <span>
        <div style={{ fontSize: 12, color: 'rgba(74,104,140,0.58)', fontWeight: 800 }}>{label}</div>
        <div style={{ marginTop: 2, fontSize: 17, color: '#0f172a', fontWeight: 900 }}>{value}</div>
      </span>
    </div>
  );
}

function VisionCompassCard({ vision, isCompact }: { vision: VisionDraft | null; isCompact: boolean }) {
  if (!vision) {
    return (
      <section style={{ marginTop: 16, ...panelStyle, display: 'grid', gridTemplateColumns: isCompact ? '1fr' : '42px 1fr auto', gap: 12, alignItems: 'center' }}>
        <span style={{ ...iconBubbleStyle('#86b8ff'), width: 42, height: 42, borderRadius: 16 }}><Compass size={20} /></span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, color: 'rgba(74,104,140,0.58)' }}>行动指北针</div>
          <div style={{ marginTop: 4, fontSize: 17, fontWeight: 950, color: '#1f3b5f' }}>先确定一个转变方向</div>
          <p style={{ marginTop: 5, color: 'rgba(62,79,106,0.68)', fontSize: 13, lineHeight: 1.7 }}>
            当你决定认真推进一个方向后，填写身份愿景板。它会成为日历里的目标提醒，帮你判断每天的小行动是否还在靠近想成为的自己。
          </p>
        </div>
        <Link href="/coach/action/vision" style={{ ...pillLinkStyle, textAlign: 'center' }}>填写愿景板</Link>
      </section>
    );
  }

  return (
    <section style={{ marginTop: 16, ...panelStyle }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr', gap: 12, alignItems: 'start', flex: '1 1 360px' }}>
          <span style={{ ...iconBubbleStyle('#86b8ff'), width: 42, height: 42, borderRadius: 16 }}><Compass size={20} /></span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: 'rgba(74,104,140,0.58)' }}>行动指北针</div>
            <h2 style={{ marginTop: 4, fontSize: 18, fontWeight: 950, color: '#1f3b5f', lineHeight: 1.45 }}>
              {vision.ideal_statement || '我的转变方向'}
            </h2>
            {vision.identity_words && (
              <div style={{ marginTop: 8, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {vision.identity_words.split(/[、,，\s]+/).filter(Boolean).slice(0, 4).map((word) => (
                  <span key={word} style={resourceChipStyle}>{word}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <Link href="/coach/action/vision" style={pillLinkStyle}>更新愿景</Link>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: isCompact ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        <VisionNote title="理想状态" text={vision.daily_state} />
        <VisionNote title="靠近方式" text={vision.next_actions || vision.daily_routine} />
        <VisionNote title="已有力量" text={vision.already_have || vision.can_grow} />
      </div>
    </section>
  );
}

function VisionNote({ title, text }: { title: string; text?: string }) {
  return (
    <div style={{ borderRadius: 16, padding: 12, background: 'rgba(255,255,255,0.62)', border: '1px solid rgba(134,184,255,0.14)' }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: 'rgba(74,104,140,0.60)' }}>{title}</div>
      <p style={{ marginTop: 6, color: 'rgba(62,79,106,0.76)', fontSize: 13, lineHeight: 1.65 }}>
        {text || '还可以继续补充。'}
      </p>
    </div>
  );
}

function AchievementSticker({ achievement }: { achievement: Achievement }) {
  const Icon = achievement.icon;
  return (
    <div
      title={achievement.description}
      style={{
        minHeight: 126,
        borderRadius: 20,
        padding: 12,
        background: achievement.unlocked ? `${achievement.color}20` : 'rgba(255,255,255,0.56)',
        border: `1px solid ${achievement.unlocked ? `${achievement.color}55` : 'rgba(134,184,255,0.14)'}`,
        boxShadow: achievement.unlocked ? `0 14px 28px ${achievement.color}18` : 'none',
        opacity: achievement.unlocked ? 1 : 0.52,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <span
        style={{
          width: 38,
          height: 38,
          borderRadius: 16,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: achievement.unlocked ? 'rgba(255,255,255,0.72)' : 'rgba(134,184,255,0.10)',
          color: achievement.unlocked ? achievement.color : 'rgba(74,104,140,0.42)',
        }}
      >
        <Icon size={19} />
      </span>
      <div>
        <div style={{ marginTop: 10, color: '#1f3b5f', fontSize: 13, fontWeight: 950 }}>{achievement.title}</div>
        <div style={{ marginTop: 4, color: 'rgba(62,79,106,0.62)', fontSize: 11, lineHeight: 1.45 }}>
          {achievement.unlocked ? achievement.description : '继续行动后解锁'}
        </div>
      </div>
    </div>
  );
}

function DaySticker({ records }: { records: ActionCoachRecord[] }) {
  const sticker = getDaySticker(records);
  const Icon = sticker.icon;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '42px 1fr',
        gap: 10,
        alignItems: 'center',
        padding: 12,
        borderRadius: 18,
        background: `${sticker.color}1f`,
        border: `1px solid ${sticker.color}44`,
      }}
    >
      <span
        style={{
          width: 42,
          height: 42,
          borderRadius: 17,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.70)',
          color: sticker.color,
        }}
      >
        <Icon size={20} />
      </span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 900, color: 'rgba(74,104,140,0.62)' }}>今日贴纸</div>
        <div style={{ marginTop: 3, fontSize: 16, fontWeight: 950, color: '#1f3b5f' }}>{sticker.title}</div>
        <div style={{ marginTop: 3, fontSize: 12, lineHeight: 1.55, color: 'rgba(62,79,106,0.68)' }}>{sticker.description}</div>
      </div>
    </div>
  );
}

function ResourceMapPanel({
  resources,
  selectedResource,
  onSelect,
}: {
  resources: string[];
  selectedResource: string | null;
  onSelect: (resource: string) => void;
}) {
  const activeResource = selectedResource || resources[0] || null;
  const detail = activeResource ? getResourceDetail(activeResource) : null;
  return (
    <div style={{ display: 'grid', gap: 9, padding: 12, borderRadius: 16, background: 'rgba(255,255,255,0.66)', border: '1px solid rgba(134,184,255,0.14)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 900, color: 'rgba(74,104,140,0.62)' }}>
        <Target size={14} />
        今日资源地图
      </div>
      {resources.length ? (
        <>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {resources.map((resource) => (
              <button
                key={resource}
                type="button"
                onClick={() => onSelect(resource)}
                style={{
                  ...resourceChipStyle,
                  cursor: 'pointer',
                  background: resource === activeResource ? 'rgba(134,184,255,0.24)' : 'rgba(134,184,255,0.14)',
                  border: resource === activeResource ? '1px solid rgba(80,145,240,0.42)' : resourceChipStyle.border,
                }}
              >
                {resource}
              </button>
            ))}
          </div>
          {detail && (
            <div style={{ marginTop: 2, borderRadius: 15, padding: 12, background: 'rgba(134,184,255,0.10)', border: '1px solid rgba(134,184,255,0.14)' }}>
              <div style={{ fontSize: 13, fontWeight: 950, color: '#1f3b5f' }}>{detail.title}</div>
              <p style={{ marginTop: 6, color: 'rgba(62,79,106,0.74)', fontSize: 12, lineHeight: 1.65 }}>{detail.description}</p>
              <div style={{ marginTop: 9, display: 'grid', gap: 6 }}>
                {detail.actions.map((action) => (
                  <div key={action} style={{ color: 'rgba(31,59,95,0.70)', fontSize: 12, lineHeight: 1.55 }}>
                    {action}
                  </div>
                ))}
              </div>
              <Link
                href={`/coach/action?resource=${encodeURIComponent(activeResource)}`}
                style={{
                  marginTop: 10,
                  display: 'inline-flex',
                  textDecoration: 'none',
                  borderRadius: 999,
                  padding: '7px 10px',
                  background: 'rgba(255,255,255,0.68)',
                  border: '1px solid rgba(134,184,255,0.20)',
                  color: '#1f3b5f',
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                带着这个线索问教练
              </Link>
            </div>
          )}
        </>
      ) : (
        <span style={{ color: 'rgba(74,104,140,0.58)', fontSize: 13, fontWeight: 800 }}>这一天更像是在整理状态，还没有明显外部线索。</span>
      )}
    </div>
  );
}

function DayIcons({ bundle }: { bundle: DayBundle }) {
  const category = dominantValue(bundle.records.map((record) => record.category || inferCategory(record.content)));
  const mood = dominantValue(bundle.records.map((record) => record.mood || inferMood(record.content)));
  const CategoryIcon = CATEGORY_META[category]?.icon || Compass;
  const MoodIcon = MOOD_META[mood]?.icon || Meh;
  const categoryColor = CATEGORY_META[category]?.color || '#86b8ff';
  const moodColor = MOOD_META[mood]?.color || '#86b8ff';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={iconBubbleStyle(categoryColor)}><CategoryIcon size={14} /></span>
      <span style={iconBubbleStyle(moodColor)}><MoodIcon size={14} /></span>
      {bundle.records.length > 1 && (
        <span style={{ fontSize: 11, fontWeight: 900, color: 'rgba(31,59,95,0.55)' }}>x{bundle.records.length}</span>
      )}
    </div>
  );
}

function EmptyDayMark() {
  return (
    <span style={{ marginTop: 'auto', width: 20, height: 4, borderRadius: 999, background: 'rgba(134,184,255,0.16)' }} />
  );
}

function MoodBadge({ records }: { records: ActionCoachRecord[] }) {
  const mood = records.length ? dominantValue(records.map((record) => record.mood || inferMood(record.content))) : 'steady';
  const meta = MOOD_META[mood] || MOOD_META.steady;
  const Icon = meta.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 999, background: `${meta.color}24`, color: '#1f3b5f', fontWeight: 900, fontSize: 12 }}>
      <Icon size={15} color={meta.color} />
      {records.length ? meta.label : '待记录'}
    </span>
  );
}

function RecordRow({ record }: { record: ActionCoachRecord }) {
  const category = record.category || inferCategory(record.content);
  const meta = CATEGORY_META[category] || CATEGORY_META.step;
  const Icon = meta.icon;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 10, padding: 12, borderRadius: 16, background: 'rgba(255,255,255,0.76)', border: '1px solid rgba(134,184,255,0.16)' }}>
      <span style={iconBubbleStyle(meta.color)}><Icon size={15} /></span>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: '#1f3b5f' }}>{meta.label}</span>
          <span style={{ fontSize: 11, color: 'rgba(74,104,140,0.56)', fontWeight: 800 }}>{formatTime(record.createdAt)}</span>
        </div>
        <div style={{ marginTop: 5, color: 'rgba(62,79,106,0.78)', fontSize: 13, lineHeight: 1.7 }}>
          {record.summary || summarizeContent(record.content)}
        </div>
        {(record.resources?.length || record.nextStep) && (
          <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
            {record.resources?.length ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {record.resources.map((resource) => <span key={resource} style={miniChipStyle}>{resource}</span>)}
              </div>
            ) : null}
            {record.nextStep ? (
              <div style={{ color: 'rgba(31,59,95,0.68)', fontSize: 12, lineHeight: 1.6 }}>
                下一步：{record.nextStep}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function DayProgress({ records }: { records: ActionCoachRecord[] }) {
  const resources = getResourceSignals(records).length;
  const width = Math.min(100, 28 + records.length * 18 + resources * 14);
  return (
    <span style={{ marginTop: 'auto', width: '100%', height: 5, borderRadius: 999, background: 'rgba(134,184,255,0.12)', overflow: 'hidden' }}>
      <span style={{ display: 'block', width: `${width}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#86b8ff,#6fc7b1)' }} />
    </span>
  );
}

function readActionCoachRecords(): ActionCoachRecord[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(ACTION_COACH_RECORDS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const record = item as { content?: unknown; createdAt?: unknown; category?: unknown; mood?: unknown; summary?: unknown; resources?: unknown; nextStep?: unknown };
        if (typeof record.content !== 'string' || typeof record.createdAt !== 'string') return null;
        const category = typeof record.category === 'string' ? record.category : inferCategory(record.content);
        return {
          content: record.content,
          createdAt: record.createdAt,
          category,
          mood: typeof record.mood === 'string' ? record.mood : inferMood(record.content),
          summary: typeof record.summary === 'string' ? record.summary : summarizeContent(record.content),
          resources: Array.isArray(record.resources) ? record.resources.filter((resource): resource is string => typeof resource === 'string') : inferResourceSignals(record.content),
          nextStep: typeof record.nextStep === 'string' ? record.nextStep : inferNextStep(record.content, category),
        };
      })
      .filter((item): item is ActionCoachRecord => Boolean(item))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } catch {
    return [];
  }
}

function readSavedVisionDraft(): VisionDraft | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(ACTION_VISION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<VisionDraft>;
    return {
      ideal_statement: typeof parsed.ideal_statement === 'string' ? parsed.ideal_statement : '',
      daily_state: typeof parsed.daily_state === 'string' ? parsed.daily_state : '',
      daily_routine: typeof parsed.daily_routine === 'string' ? parsed.daily_routine : '',
      next_actions: typeof parsed.next_actions === 'string' ? parsed.next_actions : '',
      already_have: typeof parsed.already_have === 'string' ? parsed.already_have : '',
      can_grow: typeof parsed.can_grow === 'string' ? parsed.can_grow : '',
      identity_words: typeof parsed.identity_words === 'string' ? parsed.identity_words : '',
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : undefined,
    };
  } catch {
    return null;
  }
}

function groupRecordsByDate(records: ActionCoachRecord[]) {
  const map = new Map<string, DayBundle>();
  records.forEach((record) => {
    const dateKey = toDateKey(new Date(record.createdAt));
    const current = map.get(dateKey) || { dateKey, records: [] };
    current.records.push(record);
    map.set(dateKey, current);
  });
  return map;
}

function inferCategory(content: string) {
  const clean = content.replace(/\s+/g, ' ');
  if (/搜索|查|资料|信息|竞品|岗位|JD|市场|用户|评论区|数据|反馈/.test(clean)) return 'info';
  if (/复盘|总结|梳理|感受|状态|自己|理想/.test(clean)) return 'self';
  if (/联系|沟通|访谈|私聊|社群|朋友|客户|同事|从业者/.test(clean)) return 'connect';
  if (/学习|阅读|课程|输入|研究/.test(clean)) return 'learn';
  if (/优化|完成|写|做了|整理|提交|发布|产品/.test(clean)) return 'build';
  return 'step';
}

function inferMood(content: string) {
  const clean = content.replace(/\s+/g, ' ');
  if (/开心|稳定|踏实|清晰|有进展|完成|推进|靠近/.test(clean)) return 'bright';
  if (/焦虑|担心|害怕|难受|疲惫|累|崩溃|低落/.test(clean)) return 'low';
  if (/卡|迷茫|不知道|不确定|纠结/.test(clean)) return 'stuck';
  return 'steady';
}

function summarizeContent(content: string) {
  const clean = content.replace(/\s+/g, ' ').trim();
  return clean.length > 42 ? `${clean.slice(0, 42)}...` : clean;
}

function inferResourceSignals(content: string) {
  const clean = content.replace(/\s+/g, ' ');
  const signals = [
    [/用户|客户|受众|人群/, '真实用户'],
    [/社群|小红书|即刻|微信群|评论区|论坛|平台/, '线上渠道'],
    [/朋友|同事|从业者|访谈|联系|沟通/, '可访问的人'],
    [/竞品|产品|案例|市场/, '竞品与案例'],
    [/岗位|JD|招聘|行业|公司/, '职业入口'],
    [/付费|钱|收入|商业化|价格/, '付费信号'],
    [/作品|简历|发布|landing|页面|原型/, '可展示作品'],
  ] as const;
  return Array.from(new Set(signals.filter(([pattern]) => pattern.test(clean)).map(([, label]) => label))).slice(0, 3);
}

function getResourceDetail(resource: string) {
  const details: Record<string, { title: string; description: string; actions: string[] }> = {
    真实用户: {
      title: '找到最小真实用户',
      description: '这条线索关注的是：谁真的正在经历这个问题，而不是你想象中的泛泛用户。',
      actions: ['先写下 3 类可能的人群。', '挑一个你最容易接触的人，问他最近一次遇到这个问题是什么时候。'],
    },
    线上渠道: {
      title: '去有声音的地方观察',
      description: '线上渠道适合看真实表达：用户怎么抱怨、求助、比较、收藏或转发。',
      actions: ['找 1 个评论区或社群，截图/摘录 3 条原话。', '标记他们用来描述痛点的关键词。'],
    },
    可访问的人: {
      title: '从身边可触达的人开始',
      description: '这不是正式调研，而是低压力地获得一两个真实反馈，让想法离现实近一点。',
      actions: ['约一个 15 分钟对话。', '只问一个问题：你有没有遇到过类似情况？'],
    },
    竞品与案例: {
      title: '看别人如何被需要',
      description: '竞品不是用来比较输赢，而是帮你看清：类似问题已经被谁解决、用户为什么买单或留下。',
      actions: ['找 2 个相近产品/服务，观察它们的评论区或案例页。', '记录一个用户明确说“我需要/我愿意付费/这解决了我什么”的证据。'],
    },
    职业入口: {
      title: '从岗位和行业入口反推',
      description: '如果这是职业转向线索，可以用 JD、公司案例和从业者路径反推真实要求。',
      actions: ['找 3 条目标岗位 JD，圈出重复出现的能力词。', '找 1 位从业者，看看他公开作品或经历里有什么共同模式。'],
    },
    付费信号: {
      title: '寻找愿意付出的证据',
      description: '付费信号不一定马上是付款，也可以是愿意预约、填写表单、转介绍或花时间试用。',
      actions: ['定义一个最小付出动作。', '观察有没有人愿意为这个动作付出时间、注意力或钱。'],
    },
    可展示作品: {
      title: '把想法做成可被回应的东西',
      description: '作品让别人能具体反馈，而不是只回应一个抽象想法。',
      actions: ['做一个最小可展示版本。', '发给 1 个目标用户，只问哪里有用、哪里不清楚。'],
    },
  };
  return details[resource] || {
    title: '继续展开这条线索',
    description: '这条资源线索可以继续拆成可观察的人、场景和证据。',
    actions: ['写下一个能验证它的小问题。', '找一个最容易接触的现实场景。'],
  };
}

function inferNextStep(content: string, category: string) {
  if (/用户|需求|产品|市场|商业化/.test(content)) return '找一个真实场景，观察谁已经为类似问题付出时间、金钱或注意力。';
  if (/社群|评论区|平台|竞品/.test(content)) return '先收集 3 条外部信号，看看别人具体怎么表达这个需求。';
  if (/联系|访谈|朋友|同事/.test(content)) return '约一个低压力对话，只问对方是否遇到过类似情况。';
  if (category === 'self') return '把这个想法写成一句可验证的问题，而不是马上变成结论。';
  if (category === 'build') return '保留一个最小可展示版本，让别人能看见并回应。';
  return '把下一步缩小到 15 分钟内能完成的一件事。';
}

function getResourceSignals(records: ActionCoachRecord[]) {
  return Array.from(new Set(records.flatMap((record) => record.resources?.length ? record.resources : inferResourceSignals(record.content)))).slice(0, 5);
}

function countResourceSignals(records: ActionCoachRecord[]) {
  return new Set(records.flatMap((record) => record.resources?.length ? record.resources : inferResourceSignals(record.content))).size;
}

function buildAchievements(records: ActionCoachRecord[], activeDays: number, streak: number): Achievement[] {
  const categories = new Set(records.map((record) => record.category || inferCategory(record.content)));
  const resourceCount = countResourceSignals(records);
  return [
    {
      id: 'first-step',
      title: '第一枚脚印',
      description: '留下第一条行动记录',
      unlocked: records.length >= 1,
      icon: Sprout,
      color: '#6fc7b1',
    },
    {
      id: 'three-days',
      title: '靠近三天',
      description: '在 3 个不同日子留下记录',
      unlocked: activeDays >= 3,
      icon: CalendarDays,
      color: '#86b8ff',
    },
    {
      id: 'streak',
      title: '连续火苗',
      description: '连续 2 天保持行动',
      unlocked: streak >= 2,
      icon: Flame,
      color: '#ff9f6e',
    },
    {
      id: 'resource-map',
      title: '资源雷达',
      description: '发现 2 个现实资源线索',
      unlocked: resourceCount >= 2,
      icon: Target,
      color: '#74a9ff',
    },
    {
      id: 'multi-path',
      title: '路径探索者',
      description: '尝试 3 类不同行动',
      unlocked: categories.size >= 3,
      icon: Compass,
      color: '#9d8cff',
    },
    {
      id: 'ten-fragments',
      title: '十颗碎片',
      description: '累计 10 条行动碎片',
      unlocked: records.length >= 10,
      icon: Trophy,
      color: '#f0b45f',
    },
  ];
}

function getDaySticker(records: ActionCoachRecord[]) {
  const resources = getResourceSignals(records);
  const category = dominantValue(records.map((record) => record.category || inferCategory(record.content)));
  const mood = dominantValue(records.map((record) => record.mood || inferMood(record.content)));
  if (resources.length >= 2) {
    return {
      title: '资源侦察贴纸',
      description: '今天不只在想，也看见了外部世界里的线索。',
      icon: Target,
      color: '#74a9ff',
    };
  }
  if (records.length >= 3) {
    return {
      title: '行动碎片贴纸',
      description: '今天留下了好几颗小碎片，它们会慢慢拼出路径。',
      icon: Gem,
      color: '#9d8cff',
    };
  }
  if (category === 'build') {
    return {
      title: '产出推进贴纸',
      description: '今天有一点东西从想法走向可见。',
      icon: Rocket,
      color: '#6fc7b1',
    };
  }
  if (category === 'connect') {
    return {
      title: '连接信号贴纸',
      description: '今天的行动开始靠近真实的人和反馈。',
      icon: MessageCircle,
      color: '#ffb86c',
    };
  }
  if (mood === 'low' || mood === 'stuck') {
    return {
      title: '照看自己贴纸',
      description: '能量不高时还愿意记录，本身就是一种行动。',
      icon: Award,
      color: '#b6a3ff',
    };
  }
  return {
    title: '稳稳靠近贴纸',
    description: '今天保留了一点向前的证据。',
    icon: Sparkles,
    color: '#86b8ff',
  };
}

function buildDaySummary(records: ActionCoachRecord[]) {
  const categories = records.map((record) => CATEGORY_META[record.category || inferCategory(record.content)]?.label || '小步行动');
  const mood = MOOD_META[dominantValue(records.map((record) => record.mood || inferMood(record.content)))]?.label || '稳稳的';
  const uniqueCategories = Array.from(new Set(categories)).slice(0, 3).join('、');
  const resources = getResourceSignals(records);
  const resourceLine = resources.length ? `也出现了 ${resources.slice(0, 2).join('、')} 这样的现实线索。` : '这一天更像是在照看状态和想法本身。';
  return `今天留下了 ${records.length} 条行动痕迹，主要集中在${uniqueCategories}。整体状态更接近“${mood}”，${resourceLine}`;
}

function dominantValue(values: string[]) {
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'steady';
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

function getWeekDates(cursor: Date) {
  const start = new Date(cursor);
  start.setDate(cursor.getDate() - cursor.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function getRecentStreak(bundles: Map<string, DayBundle>) {
  let streak = 0;
  const date = new Date();
  while (bundles.has(toDateKey(date))) {
    streak += 1;
    date.setDate(date.getDate() - 1);
  }
  return streak;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCalendarTitle(date: Date, mode: 'week' | 'month') {
  if (mode === 'month') return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
  const week = getWeekDates(date);
  return `${week[0].getMonth() + 1}/${week[0].getDate()} - ${week[6].getMonth() + 1}/${week[6].getDate()}`;
}

function formatDateLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 · 周${WEEKDAYS[date.getDay()]}`;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function iconBubbleStyle(color: string): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 12,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: `${color}22`,
    color,
    border: `1px solid ${color}33`,
  };
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

const roundButtonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  border: '1px solid rgba(134,184,255,0.26)',
  background: 'rgba(255,255,255,0.74)',
  color: '#1f3b5f',
  fontSize: 20,
  fontWeight: 900,
  cursor: 'pointer',
};

const panelStyle: React.CSSProperties = {
  borderRadius: 24,
  border: '1px solid rgba(134,184,255,0.16)',
  background: 'rgba(255,255,255,0.58)',
  boxShadow: '0 20px 50px rgba(15,23,42,0.04)',
  backdropFilter: 'blur(18px)',
  padding: 16,
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

const miniChipStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: '4px 7px',
  background: 'rgba(134,184,255,0.12)',
  color: 'rgba(31,59,95,0.72)',
  fontSize: 11,
  fontWeight: 900,
};
