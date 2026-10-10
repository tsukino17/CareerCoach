'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  Compass,
  ExternalLink,
  FileSearch,
  Layers3,
  Link2,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Target,
} from 'lucide-react';

type MatchDimension = { label: string; score: number; reason: string };
type OpportunityReport = {
  profileSummary: string;
  pathVerdict: string;
  feasibilityScore: number;
  preferenceFitSummary?: string;
  matchDimensions?: MatchDimension[];
  searchQueries: string[];
  recommendedSearchLinks?: Array<{ name: string; url: string; why: string }>;
  recommendedChannels: Array<{ name: string; why: string; queryHint: string }>;
  opportunityRoles: Array<{ title: string; companyType: string; matchReason: string; risk: string; evidenceToCollect: string }>;
  skillGaps: string[];
  firstWeekActions: string[];
  caveats: string[];
};

type OpportunityApiResponse = {
  report?: OpportunityReport | null;
  provider?: string;
  providerNote?: string | null;
  error?: string;
};

const PRESET_TARGETS = ['AI 产品经理', '用户研究', '内容产品 / 社区运营', '游戏体验设计', 'AI 应用运营'];
const WORK_STYLE_OPTIONS = ['不限，可接受全职 / 远程 / 项目制', '全职稳定团队优先', '远程办公优先', '混合办公优先', '项目制 / 顾问制优先', '自由职业 / 灵活办公优先', '初创 / 新业务优先'];

export default function OpportunitySearchToolPage() {
  const [target, setTarget] = useState('');
  const [city, setCity] = useState('');
  const [workStyle, setWorkStyle] = useState(WORK_STYLE_OPTIONS[0]);
  const [seniority, setSeniority] = useState('0-3 年 / 转型入口');
  const [salary, setSalary] = useState('');
  const [preferredIndustries, setPreferredIndustries] = useState('');
  const [strengths, setStrengths] = useState('');
  const [avoid, setAvoid] = useState('');
  const [mustHave, setMustHave] = useState('');
  const [pastedJobs, setPastedJobs] = useState('');
  const [userContext, setUserContext] = useState<Record<string, unknown>>({});
  const [report, setReport] = useState<OpportunityReport | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [providerNote, setProviderNote] = useState<string | null>(null);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const updateLayout = () => setIsCompact(window.innerWidth < 860);
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  useEffect(() => {
    const context = readUserCareerContext();
    setUserContext(context);
    setTarget((current) => current || inferTargetFromContext(context));
    setCity((current) => current || inferCityFromContext(context));
    setStrengths((current) => current || String(context.reportSummary || '').replace(/^暂无$/, ''));
  }, []);

  const canSearch = useMemo(() => target.trim().length > 0 || pastedJobs.trim().length > 0, [target, pastedJobs]);

  const submitSearch = async () => {
    if (!canSearch || isSearching) return;
    setIsSearching(true);
    setStage('读取职业画像和岗位偏好');
    setError(null);
    setProviderNote(null);
    setReport(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 24000);
    const stageTimer = window.setTimeout(() => setStage('生成岗位匹配和搜索入口'), 6200);
    try {
      const res = await fetch('/api/coach/opportunity-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          target: target.trim() || '职业机会方向',
          city,
          workStyle,
          pastedJobs,
          userContext,
          preferences: {
            seniority,
            salary,
            preferredIndustries,
            strengths,
            avoid,
            mustHave,
          },
        }),
      });
      const data = await readApiJson<OpportunityApiResponse>(res);
      if (!res.ok) throw new Error(data?.error || '岗位聚合搜索失败');
      setReport(data.report || null);
      setProviderNote(data.providerNote || (data.provider ? `模型：${data.provider}` : null));
    } catch (err: unknown) {
      setError(isAbortError(err) ? '岗位聚合搜索超时。可以先缩短 JD 文本，或只填写目标岗位再试。' : getErrorMessage(err, '岗位聚合搜索失败，请稍后重试。'));
    } finally {
      window.clearTimeout(timeout);
      window.clearTimeout(stageTimer);
      setIsSearching(false);
      setStage('');
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#F3F8FF_0%,#FFFFFF_55%,#F7FBFF_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-7">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/path" aria-label="返回现实路径地图" className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#86B8FF]/30 bg-white/75 text-[#2A6FA3] shadow-sm">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Opportunity Search</div>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-[#1F3B5F]">岗位聚合搜索</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/coach/action/tools/analysis" className="inline-flex items-center gap-2 rounded-full border border-[#86B8FF]/25 bg-white/80 px-4 py-2 text-sm font-bold text-[#2A6FA3] shadow-sm">
              <Layers3 className="h-4 w-4" />
              咨询工具箱
            </Link>
            <Link href="/coach/action" className="inline-flex items-center gap-2 rounded-full border border-[#86B8FF]/25 bg-white/80 px-4 py-2 text-sm font-bold text-[#2A6FA3] shadow-sm">
              <Sparkles className="h-4 w-4" />
              行动教练
            </Link>
          </div>
        </header>

        <section className="mt-5 grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)_320px]">
          <aside className="rounded-[1.5rem] border border-[#86B8FF]/16 bg-white/72 p-4 shadow-[0_18px_48px_rgba(80,145,240,0.08)] backdrop-blur lg:sticky lg:top-5 lg:self-start">
            <PanelTitle icon={SlidersHorizontal} title="搜索条件" />
            <div className="mt-4 grid gap-3">
              <Field label="目标岗位 / 方向">
                <input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="例如 AI 产品经理 / 用户研究 / 内容运营" className={inputClass} />
              </Field>
              <div className="flex flex-wrap gap-2">
                {PRESET_TARGETS.map((item) => (
                  <button key={item} type="button" onClick={() => setTarget(item)} className="rounded-full border border-[#86B8FF]/20 bg-[#86B8FF]/10 px-3 py-1.5 text-xs font-bold text-[#2A6FA3]">
                    {item}
                  </button>
                ))}
              </div>
              <Field label="地点">
                <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="例如 上海 / 北京 / 远程 / 海外" className={inputClass} />
              </Field>
              <Field label="工作方式">
                <select value={workStyle} onChange={(event) => setWorkStyle(event.target.value)} className={inputClass}>
                  {WORK_STYLE_OPTIONS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="经验层级">
                <input value={seniority} onChange={(event) => setSeniority(event.target.value)} placeholder="例如 0-3 年 / 3-5 年 / 转型入口" className={inputClass} />
              </Field>
              <Field label="薪资期待">
                <input value={salary} onChange={(event) => setSalary(event.target.value)} placeholder="例如 15-25K / 年薪 30-45 万 / 先看市场" className={inputClass} />
              </Field>
              <Field label="偏好行业">
                <input value={preferredIndustries} onChange={(event) => setPreferredIndustries(event.target.value)} placeholder="例如 AI 工具、教育、心理健康、游戏" className={inputClass} />
              </Field>
            </div>
          </aside>

          <section className="min-w-0 space-y-4">
            <div className="rounded-[1.6rem] border border-[#86B8FF]/16 bg-white/76 p-5 shadow-[0_18px_48px_rgba(80,145,240,0.08)] backdrop-blur">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#86B8FF]/30 bg-[#86B8FF]/14 px-3 py-1 text-xs font-black text-[#2A6FA3]">
                <BriefcaseBusiness className="h-3.5 w-3.5" />
                资源版工具箱
              </div>
              <h2 className="mt-4 text-2xl font-black text-[#1F3B5F]">用你的偏好和真实 JD，先筛出更值得验证的岗位方向</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                这里适合用户单独调用：先做岗位聚合搜索、匹配度判断和 JD 对比，再把今天要自己查的具体网站放进微任务。
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <HeroMetric icon={Target} title="偏好匹配" text="按城市、薪资、工作方式、行业偏好筛一遍。" />
                <HeroMetric icon={FileSearch} title="JD 反推" text="从岗位文本里提取能力门槛、风险和作品证据。" />
                <HeroMetric icon={Compass} title="行动回流" text="把搜索词、渠道和一周动作带回行动教练。" />
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-[#86B8FF]/16 bg-white/72 p-4 shadow-[0_18px_48px_rgba(80,145,240,0.08)] backdrop-blur">
              <PanelTitle icon={Sparkles} title="偏好和材料" />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Field label="已有优势 / 画像摘要">
                  <textarea value={strengths} onChange={(event) => setStrengths(event.target.value)} rows={5} placeholder="自动读取本地画像；也可以补充你想强调的优势、作品、经历。" className={textareaClass} />
                </Field>
                <Field label="不想要 / 必须满足">
                  <div className="grid gap-3">
                    <textarea value={avoid} onChange={(event) => setAvoid(event.target.value)} rows={2} placeholder="不想要：高强度销售、纯执行、长期出差..." className={textareaClass} />
                    <textarea value={mustHave} onChange={(event) => setMustHave(event.target.value)} rows={2} placeholder="必须满足：能远程、能学 AI、有作品空间、稳定现金流..." className={textareaClass} />
                  </div>
                </Field>
              </div>
              <Field label="可选：粘贴 JD、岗位链接、招聘帖或公司 careers 文本">
                <textarea value={pastedJobs} onChange={(event) => setPastedJobs(event.target.value)} rows={isCompact ? 7 : 9} placeholder="粘贴 1-3 条岗位样本后，匹配会更具体。没有样本也可以先生成搜索入口和验证策略。" className={textareaClass} />
              </Field>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" onClick={submitSearch} disabled={!canSearch || isSearching} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#86B8FF]/80 px-5 py-2.5 text-sm font-black text-[#225F91] shadow-sm transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-300">
                  {isSearching ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#225F91]/25 border-t-[#225F91]" /> : <Search className="h-4 w-4" />}
                  {isSearching ? '搜索和匹配中' : '生成岗位聚合搜索'}
                </button>
                <span className="text-xs leading-6 text-slate-500">
                  {isSearching ? `${stage || '正在整理'}，通常需要 8-20 秒。` : providerNote || '结果会标出哪些是已知判断，哪些还需要用户去具体网站验证。'}
                </span>
              </div>
              {error ? <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
            </div>

            {report ? <ReportView report={report} /> : <EmptyResult />}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start">
            <SidePanel title="当前读取到的用户线索" icon={Target}>
              <ContextLine label="天赋报告" value={String(userContext.reportSummary || '暂无')} />
              <ContextLine label="身份愿景" value={String(userContext.visionSummary || '暂无')} />
              <ContextLine label="最近行动" value={String(userContext.recentAction || '暂无')} />
              <ContextLine label="教练记忆" value={String(userContext.memorySummary || '暂无')} />
            </SidePanel>
            <SidePanel title="后续可深化" icon={Layers3}>
              <Bullet>接入真实岗位源后，把岗位卡按偏好、薪资、技能重合度排序。</Bullet>
              <Bullet>支持保存岗位候选池，形成用户自己的资源板。</Bullet>
              <Bullet>把“查 3 条真实岗位”自动写回今天微任务。</Bullet>
            </SidePanel>
          </aside>
        </section>
      </div>
    </main>
  );
}

function ReportView({ report }: { report: OpportunityReport }) {
  return (
    <div className="space-y-4">
      <div className="rounded-[1.5rem] border border-[#86B8FF]/16 bg-white/76 p-5 shadow-[0_18px_48px_rgba(80,145,240,0.08)]">
        <PanelTitle icon={CheckCircle2} title="匹配判断" />
        <div className="mt-4 grid gap-4 md:grid-cols-[120px_minmax(0,1fr)]">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#86B8FF]/18 text-3xl font-black text-[#1F3B5F]">{report.feasibilityScore}</div>
          <div className="text-sm leading-7 text-slate-600">
            <p>{report.profileSummary}</p>
            <p className="mt-2 font-bold text-[#1F3B5F]">{report.pathVerdict}</p>
            {report.preferenceFitSummary ? <p className="mt-2 rounded-2xl bg-[#F3F8FF]/80 px-4 py-3 text-[#2A6FA3]">{report.preferenceFitSummary}</p> : null}
          </div>
        </div>
      </div>

      {report.matchDimensions?.length ? (
        <div className="grid gap-3 md:grid-cols-3">
          {report.matchDimensions.map((item) => <MatchCard key={item.label} item={item} />)}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <ResultPanel title="建议先搜这些词" icon={Search}>
          <div className="flex flex-wrap gap-2">
            {report.searchQueries.map((query) => <span key={query} className="rounded-full bg-[#86B8FF]/14 px-3 py-1.5 text-xs font-bold text-[#2A6FA3]">{query}</span>)}
          </div>
        </ResultPanel>
        <ResultPanel title="可以直接打开的入口" icon={ExternalLink}>
          <div className="grid gap-2">
            {(report.recommendedSearchLinks || []).map((item) => (
              <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="rounded-2xl border border-[#86B8FF]/14 bg-white/70 p-3 text-sm shadow-sm transition hover:bg-[#F3F8FF]">
                <span className="flex items-center gap-2 font-black text-[#1F3B5F]"><Link2 className="h-3.5 w-3.5" />{item.name}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{item.why}</span>
              </a>
            ))}
          </div>
        </ResultPanel>
      </div>

      <ResultPanel title="值得优先验证的岗位方向" icon={BriefcaseBusiness}>
        <div className="grid gap-3">
          {report.opportunityRoles.map((role) => (
            <div key={`${role.title}-${role.companyType}`} className="grid gap-3 rounded-2xl border border-[#86B8FF]/14 bg-white/70 p-4 md:grid-cols-[170px_minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <div className="text-sm font-black text-[#1F3B5F]">{role.title}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{role.companyType}</div>
              </div>
              <p className="text-sm leading-6 text-slate-600">{role.matchReason}</p>
              <p className="text-sm leading-6 text-slate-500">风险：{role.risk}<br />证据：{role.evidenceToCollect}</p>
            </div>
          ))}
        </div>
      </ResultPanel>

      <div className="grid gap-4 md:grid-cols-3">
        <ListPanel title="能力证据缺口" icon={ShieldAlert} items={report.skillGaps} />
        <ListPanel title="一周验证动作" icon={CheckCircle2} items={report.firstWeekActions} />
        <ListPanel title="仍需确认" icon={FileSearch} items={report.caveats} />
      </div>
    </div>
  );
}

function EmptyResult() {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-[#86B8FF]/24 bg-white/55 p-6 text-sm leading-7 text-slate-500">
      填一个目标岗位或粘贴一段 JD 后，这里会生成岗位匹配判断、搜索入口、岗位方向对比和微任务建议。
    </div>
  );
}

function PanelTitle({ icon: Icon, title }: { icon: typeof Search; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-black text-[#1F3B5F]">
      <Icon className="h-4 w-4 text-[#4A789C]" />
      {title}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-black text-slate-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function HeroMetric({ icon: Icon, title, text }: { icon: typeof Search; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-[#86B8FF]/14 bg-white/66 p-4">
      <div className="flex items-center gap-2 text-sm font-black text-[#1F3B5F]"><Icon className="h-4 w-4 text-[#4A789C]" />{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function MatchCard({ item }: { item: MatchDimension }) {
  return (
    <div className="rounded-[1.25rem] border border-[#86B8FF]/16 bg-white/72 p-4 shadow-[0_12px_32px_rgba(80,145,240,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-black text-[#1F3B5F]">{item.label}</div>
        <div className="text-lg font-black text-[#2A6FA3]">{item.score}</div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#86B8FF]/12">
        <div className="h-full rounded-full bg-[#86B8FF]" style={{ width: `${item.score}%` }} />
      </div>
      <p className="mt-3 text-xs leading-6 text-slate-500">{item.reason}</p>
    </div>
  );
}

function ResultPanel({ title, icon, children }: { title: string; icon: typeof Search; children: React.ReactNode }) {
  return (
    <div className="rounded-[1.5rem] border border-[#86B8FF]/16 bg-white/72 p-4 shadow-[0_18px_48px_rgba(80,145,240,0.08)]">
      <PanelTitle icon={icon} title={title} />
      <div className="mt-4">{children}</div>
    </div>
  );
}

function SidePanel({ title, icon, children }: { title: string; icon: typeof Search; children: React.ReactNode }) {
  return (
    <div className="rounded-[1.5rem] border border-[#86B8FF]/16 bg-white/72 p-4 shadow-[0_18px_48px_rgba(80,145,240,0.08)] backdrop-blur">
      <PanelTitle icon={icon} title={title} />
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ContextLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3">
      <div className="text-xs font-black text-slate-400">{label}</div>
      <div className="mt-1 text-xs leading-6 text-slate-600">{value}</div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 grid grid-cols-[18px_minmax(0,1fr)] gap-2 text-xs leading-6 text-slate-600">
      <CheckCircle2 className="mt-1 h-3.5 w-3.5 text-emerald-500" />
      <span>{children}</span>
    </div>
  );
}

function ListPanel({ title, icon, items }: { title: string; icon: typeof Search; items: string[] }) {
  return (
    <ResultPanel title={title} icon={icon}>
      <div className="grid gap-2">
        {items.map((item) => <Bullet key={item}>{item}</Bullet>)}
      </div>
    </ResultPanel>
  );
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

const inputClass = 'h-11 w-full rounded-2xl border border-[#86B8FF]/20 bg-white/75 px-3 text-sm text-slate-700 outline-none transition focus:border-[#86B8FF]';
const textareaClass = 'w-full resize-none rounded-2xl border border-[#86B8FF]/20 bg-white/75 px-3 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-[#86B8FF]';
