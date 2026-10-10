'use client';

import { ChangeEvent, CSSProperties, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, Camera, CheckCircle2, Compass, Gamepad2, ImagePlus, Layers3, Search, Sparkles } from 'lucide-react';

type ProductPreset = {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  screenshotTone: string;
  flow: string[];
  mechanics: string[];
  transferable: string[];
  scores: {
    pacing: number;
    agency: number;
    ritual: number;
    emotion: number;
  };
};

const PRESETS: ProductPreset[] = [
  {
    id: 'a-short-hike',
    name: 'A Short Hike',
    subtitle: '低压力探索 · 微目标 · 轻松完成感',
    color: '#74a9ff',
    screenshotTone: 'linear-gradient(135deg, rgba(116,169,255,0.22), rgba(111,199,177,0.18))',
    flow: ['看见远处目标', '随意探索路径', '收集小能力', '获得即时反馈', '自然抵达山顶'],
    mechanics: ['没有强制路线，允许绕路', '每个小发现都能增强移动能力', '任务很短，奖励很近'],
    transferable: ['行动日历可以把大目标拆成多个“可绕路”的小探索', '允许用户记录偶然发现，而不只记录完成任务', '用轻反馈强化“我正在靠近”'],
    scores: { pacing: 92, agency: 88, ritual: 62, emotion: 78 },
  },
  {
    id: 'unpacking',
    name: 'Unpacking',
    subtitle: '整理动作 · 叙事留白 · 秩序恢复',
    color: '#9d8cff',
    screenshotTone: 'linear-gradient(135deg, rgba(157,140,255,0.20), rgba(255,184,108,0.16))',
    flow: ['打开箱子', '摆放物品', '调整位置', '看见生活变化', '完成一个房间'],
    mechanics: ['用动作讲故事，不需要长文字解释', '低失败压力，但有轻微秩序规则', '完成后获得空间被安顿好的感觉'],
    transferable: ['把用户的混乱想法变成可摆放的卡片', '让“整理自我”也有可视化完成感', '每日总结可以像房间一样逐渐被填满'],
    scores: { pacing: 78, agency: 72, ritual: 86, emotion: 91 },
  },
  {
    id: 'animal-crossing',
    name: 'Animal Crossing',
    subtitle: '日常陪伴 · 收集成长 · 长周期关系',
    color: '#6fc7b1',
    screenshotTone: 'linear-gradient(135deg, rgba(111,199,177,0.22), rgba(134,184,255,0.16))',
    flow: ['每日进入', '查看岛上变化', '完成轻任务', '收集/装饰', '积累关系和身份感'],
    mechanics: ['真实时间驱动，让成长不依赖爆发力', '小任务提供稳定回访理由', '装饰和收集让用户形成个人领地'],
    transferable: ['行动日历可以做成“长期靠近”的个人场域', '贴纸奖励可以承载身份成长，而不只是打卡', '让用户看到几天后的变化，降低即时焦虑'],
    scores: { pacing: 84, agency: 80, ritual: 94, emotion: 83 },
  },
];

export default function ProductAnalysisToolPage() {
  const [selectedId, setSelectedId] = useState(PRESETS[0].id);
  const [customProduct, setCustomProduct] = useState('');
  const [customQuestion, setCustomQuestion] = useState('我想借鉴它的治愈型流程体验，用到行动日历和教练陪伴里。');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCompact, setIsCompact] = useState(false);
  const selected = useMemo(() => PRESETS.find((preset) => preset.id === selectedId) || PRESETS[0], [selectedId]);

  useEffect(() => {
    const updateLayout = () => setIsCompact(window.innerWidth < 820);
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  const handleImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
  };

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg,#F3F8FF 0%, #FFFFFF 56%, #F7FBFF 100%)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '22px 18px 36px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/coach/action" aria-label="返回行动力教练" style={iconButtonStyle}>
              <ArrowLeft size={16} strokeWidth={2.2} />
            </Link>
            <div>
              <span style={{ fontSize: 10, letterSpacing: 2.2, color: 'rgba(74,104,140,0.50)', textTransform: 'uppercase' }}>Branch Toolbox</span>
              <h1 style={{ marginTop: 5, fontSize: 24, fontWeight: 900, color: '#0f172a' }}>产品分析报告</h1>
            </div>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, ...softBadgeStyle }}>
            <Sparkles size={14} />
            <span>从对话跳到可视化分析</span>
          </div>
        </header>

        <section style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
          <aside style={panelStyle}>
            <div style={sectionKickerStyle}>分析对象</div>
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedId(preset.id)}
                  style={{
                    ...presetButtonStyle,
                    borderColor: selectedId === preset.id ? 'rgba(116,169,255,0.42)' : 'rgba(134,184,255,0.16)',
                    background: selectedId === preset.id ? 'rgba(134,184,255,0.16)' : 'rgba(255,255,255,0.62)',
                  }}
                >
                  <span style={{ ...presetMarkStyle, background: preset.color }} />
                  <span style={{ minWidth: 0, textAlign: 'left' }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 900, color: '#1f3b5f' }}>{preset.name}</span>
                    <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: 'rgba(74,104,140,0.58)', lineHeight: 1.35 }}>{preset.subtitle}</span>
                  </span>
                </button>
              ))}
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={sectionKickerStyle}>自定义分析</div>
              <input
                value={customProduct}
                onChange={(event) => setCustomProduct(event.target.value)}
                placeholder="输入产品名、游戏名或竞品名"
                style={inputStyle}
              />
              <textarea
                value={customQuestion}
                onChange={(event) => setCustomQuestion(event.target.value)}
                rows={4}
                style={{ ...inputStyle, height: 92, resize: 'none', lineHeight: 1.55 }}
              />
              <label style={uploadStyle}>
                <ImagePlus size={16} />
                <span>{imagePreview ? '已添加一张参考截图' : '添加产品截图'}</span>
                <input type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
              </label>
            </div>
          </aside>

          <section style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={sectionKickerStyle}>可视化报告</div>
                <h2 style={{ marginTop: 5, fontSize: 22, fontWeight: 900, color: '#1f3b5f' }}>{customProduct || selected.name}</h2>
                <p style={{ marginTop: 5, color: 'rgba(62,79,106,0.68)', fontSize: 13, lineHeight: 1.7 }}>{customProduct ? customQuestion : selected.subtitle}</p>
              </div>
              <span style={softBadgeStyle}><Gamepad2 size={14} />治愈流程参考</span>
            </div>

            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
              <div style={{ ...screenshotFrameStyle, background: imagePreview ? '#fff' : selected.screenshotTone }}>
                {imagePreview ? (
                  <img src={imagePreview} alt="上传的产品截图" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 18 }} />
                ) : (
                  <>
                    <Camera size={24} color="rgba(58,91,130,0.52)" />
                    <div style={{ marginTop: 10, fontSize: 13, fontWeight: 900, color: 'rgba(31,59,95,0.72)' }}>截图观察位</div>
                    <p style={{ marginTop: 6, maxWidth: 220, color: 'rgba(74,104,140,0.58)', fontSize: 12, lineHeight: 1.55 }}>
                      后续可以接入真实截图抓取、标注和功能热区分析。
                    </p>
                  </>
                )}
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <MiniPanel icon={Layers3} title="核心流程" items={selected.flow} color={selected.color} />
                <MiniPanel icon={Search} title="功能机制" items={selected.mechanics} color={selected.color} />
              </div>
            </div>

            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 14 }}>
              <div style={miniPanelStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#1f3b5f', fontWeight: 900 }}>
                  <Compass size={15} />
                  <span>可迁移到行动力产品的设计</span>
                </div>
                <div style={{ marginTop: 12, display: 'grid', gap: 9 }}>
                  {selected.transferable.map((item) => (
                    <div key={item} style={{ display: 'grid', gridTemplateColumns: '18px minmax(0, 1fr)', gap: 7, color: 'rgba(62,79,106,0.78)', fontSize: 13, lineHeight: 1.6 }}>
                      <CheckCircle2 size={15} color={selected.color} style={{ marginTop: 3 }} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={miniPanelStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#1f3b5f', fontWeight: 900 }}>
                  <BarChart3 size={15} />
                  <span>体验维度</span>
                </div>
                <ScoreBar label="节奏舒适" value={selected.scores.pacing} color={selected.color} />
                <ScoreBar label="自主探索" value={selected.scores.agency} color={selected.color} />
                <ScoreBar label="日常仪式" value={selected.scores.ritual} color={selected.color} />
                <ScoreBar label="情绪安放" value={selected.scores.emotion} color={selected.color} />
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function MiniPanel({ icon: Icon, title, items, color }: { icon: typeof Layers3; title: string; items: string[]; color: string }) {
  return (
    <div style={miniPanelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#1f3b5f', fontWeight: 900 }}>
        <Icon size={15} color={color} />
        <span>{title}</span>
      </div>
      <div style={{ marginTop: 11, display: 'grid', gap: 7 }}>
        {items.map((item, index) => (
          <div key={item} style={{ display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr)', gap: 7, alignItems: 'start', fontSize: 13, color: 'rgba(62,79,106,0.78)', lineHeight: 1.55 }}>
            <span style={{ width: 22, height: 22, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${color}22`, color: '#1f3b5f', fontSize: 11, fontWeight: 900 }}>
              {index + 1}
            </span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginTop: 13 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, color: 'rgba(74,104,140,0.72)', fontWeight: 800 }}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div style={{ marginTop: 6, height: 8, borderRadius: 999, background: 'rgba(134,184,255,0.12)', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 999, background: color }} />
      </div>
    </div>
  );
}

const panelStyle: CSSProperties = {
  borderRadius: 24,
  border: '1px solid rgba(134,184,255,0.14)',
  background: 'rgba(255,255,255,0.58)',
  boxShadow: '0 18px 46px rgba(80,145,240,0.08), inset 0 1px 0 rgba(255,255,255,0.72)',
  padding: 16,
};

const miniPanelStyle: CSSProperties = {
  borderRadius: 18,
  border: '1px solid rgba(134,184,255,0.13)',
  background: 'rgba(255,255,255,0.62)',
  padding: 14,
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

const softBadgeStyle: CSSProperties = {
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

const sectionKickerStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  color: 'rgba(74,104,140,0.50)',
  fontWeight: 900,
};

const presetButtonStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '12px minmax(0, 1fr)',
  gap: 9,
  alignItems: 'center',
  borderRadius: 15,
  border: '1px solid rgba(134,184,255,0.16)',
  padding: 10,
  cursor: 'pointer',
};

const presetMarkStyle: CSSProperties = {
  width: 10,
  height: 36,
  borderRadius: 999,
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

const uploadStyle: CSSProperties = {
  marginTop: 9,
  height: 40,
  borderRadius: 14,
  border: '1px dashed rgba(134,184,255,0.36)',
  background: 'rgba(134,184,255,0.08)',
  color: 'rgba(58,91,130,0.72)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  fontSize: 13,
  fontWeight: 900,
  cursor: 'pointer',
};

const screenshotFrameStyle: CSSProperties = {
  minHeight: 260,
  borderRadius: 22,
  border: '1px solid rgba(134,184,255,0.14)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  overflow: 'hidden',
};
