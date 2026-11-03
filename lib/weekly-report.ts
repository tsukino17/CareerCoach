import type { SupabaseClient } from '@supabase/supabase-js';
import { computeRealityPathStats } from '@/lib/path-analytics';
import { aggregateCityStats, cleanLabel, clipText } from '@/lib/analytics-normalize';
import { isInternalAnalyticsEvent } from '@/lib/analytics-internal';

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

type EventRow = {
  event_name: string | null;
  page: string | null;
  step: string | null;
  status: string | null;
  session_id: string | null;
  user_id: string | null;
  metadata: Record<string, unknown> | null;
  user_agent: string | null;
  created_at: string | null;
};

type ProfileRow = { created_at: string | null };
type MessageRow = { conversation_id: string | null; role: string | null; created_at: string | null };
type UsageEventRow = {
  user_id: string | null;
  anonymous_ip: string | null;
  route: string | null;
  total_tokens: number | null;
  created_at: string | null;
};

type PaymentRow = {
  user_id: string | null;
  email: string | null;
  status: string | null;
  activated_at: string | null;
  created_at: string | null;
};

type PeriodSegment = { startISO: string; endISO: string; startDate: string; endDate: string };

type CoreMetrics = {
  pv: number;
  uv: number;
  registrations: number;
  pathOpeners: number;
  pathFinalized: number;
  activatedUsers: number;
  aiCalls: number;
  aiTokens: number;
};

type ComparisonItem = {
  key: string;
  label: string;
  current: number;
  previous: number;
  changeRate: number | null;
  significant: boolean;
};

type FunnelStage = {
  name: string;
  count: number;
  previous: number;
  stepRate: number | null;
  previousStepRate: number | null;
  stepRateDelta: number | null;
  changeRate: number | null;
};

type ReportAlert = { level: 'warning' | 'info'; title: string; detail: string };

type AiCostSummary = {
  calls: number;
  totalTokens: number;
  avgPerCall: number;
  activeUsers: number;
  tokensPerVisitor: number | null;
  unitCostCnyPer1kTokens: number | null;
  estimatedCostCny: number | null;
  estimatedCostPerVisitorCny: number | null;
};

function dayKey(iso: string) { return iso.slice(0, 10); }
function countBy(values: string[]) {
  const map = new Map<string, number>();
  for (const value of values) {
    const name = cleanLabel(value, '未知');
    map.set(name, (map.get(name) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'))
    .slice(0, 12)
    .map(([name, count]) => ({ name, count }));
}
function numberValue(value: unknown) {
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : 0;
}
function formatDuration(ms: number) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = seconds % 60;
  if (minutes < 60) return `${minutes}分${remainSec ? `${remainSec}秒` : '钟'}`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  return `${hours}小时${remainMin ? `${remainMin}分钟` : ''}`;
}
function isProduction(event: EventRow) {
  if (event.metadata?.isProductionSite === true) return true;
  const host = typeof event.metadata?.host === 'string' ? event.metadata.host : '';
  return host.replace(/^www\./, '').toLowerCase() === 'echotalent.fun';
}
function classifyBrowser(userAgent: string) {
  if (/bingbot/i.test(userAgent)) return 'Bingbot';
  if (/googlebot/i.test(userAgent)) return 'Googlebot';
  if (/headlesschrome/i.test(userAgent)) return 'HeadlessChrome';
  if (/edg\//i.test(userAgent)) return 'Edge';
  if (/chrome\//i.test(userAgent)) return 'Chrome';
  if (/firefox\//i.test(userAgent)) return 'Firefox';
  if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)) return 'Safari';
  return userAgent ? '其他' : '未知';
}
function classifyDevice(userAgent: string) {
  if (/bot|headless/i.test(userAgent)) return '自动化/爬虫';
  if (/iphone|ipad|android|mobile/i.test(userAgent)) return '移动设备';
  if (/macintosh|windows|linux|x11/i.test(userAgent)) return '桌面设备';
  return userAgent ? '其他' : '未知';
}
function classifyOperatingSystem(userAgent: string) {
  if (/android/i.test(userAgent)) return 'Android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS/iPadOS';
  if (/windows/i.test(userAgent)) return 'Windows';
  if (/macintosh|mac os x/i.test(userAgent)) return 'macOS';
  if (/cros/i.test(userAgent)) return 'ChromeOS';
  if (/linux/i.test(userAgent)) return 'Linux';
  return userAgent ? '其他/未识别' : '未知';
}
function classifyDeviceModel(userAgent: string) {
  if (/iphone/i.test(userAgent)) return 'iPhone（具体型号未公开）';
  if (/ipad/i.test(userAgent)) return 'iPad（具体型号未公开）';
  if (/android/i.test(userAgent)) {
    const match = userAgent.match(/Android[^;)]*;\s*(?:[^;)]*;\s*)?([^;)]+?)(?:\s+Build[\s/][^;)]+)?\s*(?:[;)])/i);
    const model = match?.[1]?.trim();
    if (model && !/wv|build\//i.test(model)) return model;
    return 'Android（具体型号未公开）';
  }
  if (/macintosh/i.test(userAgent)) return 'Mac（具体型号未公开）';
  if (/windows/i.test(userAgent)) return 'Windows PC（具体型号未公开）';
  if (/cros/i.test(userAgent)) return 'Chromebook（具体型号未公开）';
  return userAgent ? '其他/未识别' : '未知';
}
function getVisitorKey(event: EventRow) {
  const anonymousVisitorId = event.metadata?.anonymousVisitorId;
  return event.user_id || (typeof anonymousVisitorId === 'string' ? anonymousVisitorId : null) || event.session_id || null;
}

function isBotUserAgent(userAgent: string) {
  if (!userAgent) return false;
  return /bot|crawler|spider|headless|scrapy|curl|wget|python-requests|slurp|bingpreview|facebookexternalhit|uptimerobot|monitor/i.test(userAgent);
}

function classifyBotType(userAgent: string) {
  if (!isBotUserAgent(userAgent)) return '';
  if (/googlebot/i.test(userAgent)) return 'Googlebot';
  if (/bingbot|bingpreview/i.test(userAgent)) return 'Bingbot';
  if (/gptbot|oai-searchbot|chatgpt-user|perplexity|claudebot|anthropic/i.test(userAgent)) return 'AI 爬虫';
  if (/headlesschrome/i.test(userAgent)) return 'HeadlessChrome';
  if (/baiduspider/i.test(userAgent)) return 'Baiduspider';
  if (/sogou|yisouspider/i.test(userAgent)) return '搜狗/神马爬虫';
  if (/slurp/i.test(userAgent)) return 'Yahoo';
  return '其他爬虫';
}

function formatDateLabel(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

function buildPeriodBounds(now: Date, cadence: 'weekly' | 'monthly'): { current: PeriodSegment; previous: PeriodSegment } {
  const shifted = new Date(now.getTime() + BEIJING_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const date = shifted.getUTCDate();

  let currentStart: number;
  let currentEnd: number;
  let previousStart: number;
  let previousEnd: number;

  if (cadence === 'monthly') {
    currentStart = Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
    currentEnd = Date.UTC(year, month, 1, 0, 0, 0, 0) - 1;
    previousStart = Date.UTC(year, month - 2, 1, 0, 0, 0, 0);
    previousEnd = currentStart - 1;
  } else {
    const daysSinceMonday = (shifted.getUTCDay() + 6) % 7;
    currentStart = Date.UTC(year, month, date - daysSinceMonday - 7, 0, 0, 0, 0);
    currentEnd = Date.UTC(year, month, date - daysSinceMonday - 1, 23, 59, 59, 999);
    previousStart = currentStart - 7 * 24 * 60 * 60 * 1000;
    previousEnd = currentStart - 1;
  }

  const toSegment = (start: number, end: number): PeriodSegment => ({
    startISO: new Date(start - BEIJING_OFFSET_MS).toISOString(),
    endISO: new Date(end - BEIJING_OFFSET_MS).toISOString(),
    startDate: formatDateLabel(start),
    endDate: formatDateLabel(end),
  });

  return { current: toSegment(currentStart, currentEnd), previous: toSegment(previousStart, previousEnd) };
}

function computeCoreMetrics(events: EventRow[], profiles: ProfileRow[], usageEvents: UsageEventRow[], activatedUsers: Set<string>): CoreMetrics {
  const pageViews = events.filter((event) => event.event_name === 'page_view' && !isBotUserAgent(event.user_agent || ''));
  const visitors = new Set<string>();
  for (const event of pageViews) {
    const key = getVisitorKey(event);
    if (key) visitors.add(key);
  }
  const pathStats = computeRealityPathStats(events);
  const finalizedVisitors = new Set<string>();
  for (const event of events) {
    if (event.event_name !== 'path_mainline_selected') continue;
    const key = getVisitorKey(event);
    if (key) finalizedVisitors.add(key);
  }
  return {
    pv: pageViews.length,
    uv: visitors.size,
    registrations: profiles.length,
    pathOpeners: pathStats.openedVisitors,
    pathFinalized: finalizedVisitors.size,
    activatedUsers: activatedUsers.size,
    aiCalls: usageEvents.length,
    aiTokens: usageEvents.reduce((sum, event) => sum + (event.total_tokens || 0), 0),
  };
}

function collectActivatedUsers(rows: PaymentRow[], segment: PeriodSegment) {
  const activated = new Set<string>();
  const start = Date.parse(segment.startISO);
  const end = Date.parse(segment.endISO);
  for (const row of rows) {
    if (row.status !== 'activated' || !row.activated_at) continue;
    const timestamp = Date.parse(row.activated_at);
    if (!Number.isFinite(timestamp) || timestamp < start || timestamp > end) continue;
    const key = row.user_id || row.email;
    if (key) activated.add(key);
  }
  return activated;
}

function changeRateValue(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function buildComparison(current: CoreMetrics, previous: CoreMetrics): ComparisonItem[] {
  const items: Array<{ key: string; label: string; current: number; previous: number }> = [
    { key: 'pv', label: '页面访问 PV', current: current.pv, previous: previous.pv },
    { key: 'uv', label: '访客 UV', current: current.uv, previous: previous.uv },
    { key: 'registrations', label: '新增注册', current: current.registrations, previous: previous.registrations },
    { key: 'pathOpeners', label: '路径开始', current: current.pathOpeners, previous: previous.pathOpeners },
    { key: 'pathFinalized', label: '路径定稿', current: current.pathFinalized, previous: previous.pathFinalized },
    { key: 'activatedUsers', label: '付费/开通', current: current.activatedUsers, previous: previous.activatedUsers },
    { key: 'aiCalls', label: 'AI 调用', current: current.aiCalls, previous: previous.aiCalls },
    { key: 'aiTokens', label: 'AI Token', current: current.aiTokens, previous: previous.aiTokens },
  ];
  return items.map((item) => {
    const rate = changeRateValue(item.current, item.previous);
    return { ...item, changeRate: rate, significant: rate !== null && Math.abs(rate) >= 30 };
  });
}

const GROWTH_STAGE_NAMES = ['访问（UV）', '注册', '路径开始', '路径定稿', '付费/开通'];

function buildGrowthFunnel(current: CoreMetrics, previous: CoreMetrics): FunnelStage[] {
  const currentCounts = [current.uv, current.registrations, current.pathOpeners, current.pathFinalized, current.activatedUsers];
  const previousCounts = [previous.uv, previous.registrations, previous.pathOpeners, previous.pathFinalized, previous.activatedUsers];
  return GROWTH_STAGE_NAMES.map((name, index) => {
    const count = currentCounts[index];
    const previousCount = previousCounts[index];
    const denominator = index === 0 ? 0 : currentCounts[index - 1];
    const previousDenominator = index === 0 ? 0 : previousCounts[index - 1];
    const stepRate = denominator > 0 ? Number(((count / denominator) * 100).toFixed(1)) : null;
    const previousStepRate = previousDenominator > 0 ? Number(((previousCount / previousDenominator) * 100).toFixed(1)) : null;
    const stepRateDelta = stepRate !== null && previousStepRate !== null ? Number((stepRate - previousStepRate).toFixed(1)) : null;
    return {
      name,
      count,
      previous: previousCount,
      stepRate,
      previousStepRate,
      stepRateDelta,
      changeRate: changeRateValue(count, previousCount),
    };
  });
}

function buildReportAlerts(
  current: CoreMetrics,
  previous: CoreMetrics,
  daily: Array<{ date: string; pv: number; uv: number }>,
  internalCurrent: number,
  setupWarnings: string[],
): ReportAlert[] {
  const alerts: ReportAlert[] = [];
  if (current.pv === 0 || current.uv === 0) {
    alerts.push({
      level: 'warning',
      title: '本周无有效访问数据',
      detail: '统计周期内没有识别到真实访客页面访问。请先确认埋点、生产域名过滤和统计周期是否正确，再解读其余指标。',
    });
  } else if (current.uv < 10) {
    alerts.push({
      level: 'info',
      title: '样本量偏小',
      detail: `本周仅 ${current.uv} 位访客，百分比和城市分布容易受个别人影响，建议结合最近 4 周数据判断趋势。`,
    });
  }
  if (previous.uv >= 10 && current.uv > 0 && current.uv < previous.uv * 0.6) {
    const rate = changeRateValue(current.uv, previous.uv);
    alerts.push({
      level: 'warning',
      title: '访客数明显下降',
      detail: `UV 从上周 ${previous.uv} 降至 ${current.uv}（${rate === null ? '—' : `${rate}%`}），建议先排查外发节奏、渠道变化与埋点是否异常。`,
    });
  }
  if (previous.uv >= 5 && current.uv > previous.uv * 2) {
    alerts.push({
      level: 'info',
      title: '访客数突发上升',
      detail: `UV 从上周 ${previous.uv} 增至 ${current.uv}，建议确认是否为真实新增流量，避免把一次集中访问当作长期增长。`,
    });
  }
  if (daily.length >= 3 && current.pv >= 10) {
    const average = current.pv / daily.length;
    const peak = Math.max(...daily.map((item) => item.pv));
    if (peak >= average * 2.5) {
      alerts.push({
        level: 'info',
        title: '单日访问突增',
        detail: `单日最高 PV ${peak}，约为日均 ${Math.round(average)} 的 ${(peak / average).toFixed(1)} 倍，建议确认当天是否有集中外发或异常来源。`,
      });
    }
  }
  if (internalCurrent > 0) {
    alerts.push({
      level: 'info',
      title: '已排除内部流量',
      detail: `本周按管理员账号、内部设备标记和访客白名单排除了 ${internalCurrent} 条事件；原始事件仍保留，仅统计口径不含内部访问。`,
    });
  }
  if (setupWarnings.length > 0) {
    alerts.push({
      level: 'warning',
      title: '部分数据源不完整',
      detail: setupWarnings.join(' '),
    });
  }
  return alerts;
}

function buildAiCost(metrics: CoreMetrics, activeUsers: number): AiCostSummary {
  const configured = Number(process.env.ANALYTICS_AI_COST_PER_1K_TOKENS_CNY);
  const unitCost = Number.isFinite(configured) && configured > 0 ? configured : null;
  const estimatedCost = unitCost ? Number(((metrics.aiTokens / 1000) * unitCost).toFixed(2)) : null;
  return {
    calls: metrics.aiCalls,
    totalTokens: metrics.aiTokens,
    avgPerCall: metrics.aiCalls ? Math.round(metrics.aiTokens / metrics.aiCalls) : 0,
    activeUsers,
    tokensPerVisitor: metrics.uv ? Math.round(metrics.aiTokens / metrics.uv) : null,
    unitCostCnyPer1kTokens: unitCost,
    estimatedCostCny: estimatedCost,
    estimatedCostPerVisitorCny: estimatedCost !== null && metrics.uv ? Number((estimatedCost / metrics.uv).toFixed(2)) : null,
  };
}

export async function buildWeeklyReport(supabase: SupabaseClient, now = new Date()) {
  return buildPeriodicReport(supabase, now, 'weekly');
}

export async function buildMonthlyReport(supabase: SupabaseClient, now = new Date()) {
  return buildPeriodicReport(supabase, now, 'monthly');
}

async function buildPeriodicReport(supabase: SupabaseClient, now: Date, cadence: 'weekly' | 'monthly') {
  const bounds = buildPeriodBounds(now, cadence);
  const queryStart = bounds.previous.startISO;
  const queryEnd = bounds.current.endISO;
  const period = {
    start: bounds.current.startDate,
    end: bounds.current.endDate,
    previousStart: bounds.previous.startDate,
    previousEnd: bounds.previous.endDate,
    timezone: 'Asia/Shanghai',
  };

  const [{ data: eventData, error: eventError }, { data: profileData, error: profileError }, { data: messageData, error: messageError }, { data: usageData, error: usageError }] = await Promise.all([
    supabase.from('analytics_events').select('event_name,page,step,status,session_id,user_id,metadata,user_agent,created_at').gte('created_at', queryStart).lte('created_at', queryEnd).limit(50000),
    supabase.from('user_profiles').select('created_at').gte('created_at', queryStart).lte('created_at', queryEnd).limit(10000),
    supabase.from('messages').select('conversation_id,role,created_at').gte('created_at', queryStart).lte('created_at', queryEnd).limit(30000),
    supabase.from('ai_usage_events').select('user_id,anonymous_ip,route,total_tokens,created_at').gte('created_at', queryStart).lte('created_at', queryEnd).limit(50000),
  ]);

  // 付费/开通漏斗只读查询：失败时降级为提示，不阻断周报
  const paymentResult = await supabase
    .from('payment_requests')
    .select('user_id,email,status,activated_at,created_at')
    .gte('activated_at', bounds.previous.startISO)
    .lte('activated_at', bounds.current.endISO)
    .limit(5000);
  const paymentRows = (paymentResult.error ? [] : (paymentResult.data || [])) as PaymentRow[];

  if (eventError) throw eventError;
  const inCurrent = (createdAt: string | null) => Boolean(createdAt && createdAt >= bounds.current.startISO);
  const productionEvents = ((eventData || []) as EventRow[]).filter(isProduction);
  const internalEvents = productionEvents.filter((event) => isInternalAnalyticsEvent(event));
  const humanEvents = productionEvents.filter((event) => !isInternalAnalyticsEvent(event));
  const events = humanEvents.filter((event) => inCurrent(event.created_at));
  const previousEvents = humanEvents.filter((event) => !inCurrent(event.created_at));
  const profiles = ((profileData || []) as ProfileRow[]).filter((item) => inCurrent(item.created_at));
  const previousProfiles = ((profileData || []) as ProfileRow[]).filter((item) => !inCurrent(item.created_at));
  const messages = ((messageData || []) as MessageRow[]).filter((item) => inCurrent(item.created_at));
  const usageEvents = ((usageData || []) as UsageEventRow[]).filter((item) => inCurrent(item.created_at));
  const previousUsageEvents = ((usageData || []) as UsageEventRow[]).filter((item) => !inCurrent(item.created_at));
  const internalCurrent = internalEvents.filter((event) => inCurrent(event.created_at)).length;
  const internalPrevious = internalEvents.filter((event) => !inCurrent(event.created_at)).length;

  const [{ data: allProfilesData, error: allProfilesError }, { data: authUsersData, error: authUsersError }] = await Promise.all([
    supabase.from('user_profiles').select('user_id').limit(10000),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const allProfiles = (allProfilesData || []) as Array<{ user_id: string }>;
  const authUsers = authUsersData?.users || [];

  // 全站历史累计访客：只统计生产站真人 page_view，并排除内部流量
  const { data: allTimeVisitorsData, error: allTimeVisitorsError } = await supabase
    .from('analytics_events')
    .select('user_id,session_id,metadata,user_agent,event_name')
    .eq('event_name', 'page_view')
    .limit(100000);
  let totalVisitors = 0;
  if (!allTimeVisitorsError && allTimeVisitorsData) {
    const visitorSet = new Set<string>();
    const rows = allTimeVisitorsData as Array<{ user_id: string | null; session_id: string | null; metadata: Record<string, unknown> | null; user_agent: string | null; event_name: string | null }>;
    for (const row of rows) {
      if (!isProduction(row as EventRow)) continue;
      if (isInternalAnalyticsEvent(row)) continue;
      if (isBotUserAgent(row.user_agent || '')) continue;
      const key = getVisitorKey(row as EventRow);
      if (key) visitorSet.add(key);
    }
    totalVisitors = visitorSet.size;
  }
  const pageViews = events.filter((event) => event.event_name === 'page_view');
  const humanPageViews = pageViews.filter((event) => !isBotUserAgent(event.user_agent || ''));
  const botPageViews = pageViews.filter((event) => isBotUserAgent(event.user_agent || ''));
  const engagements = events.filter((event) => event.event_name === 'page_engagement');
  const humanEngagements = engagements.filter((event) => !isBotUserAgent(event.user_agent || ''));
  const anonymousMessages = events.filter((event) => event.event_name === 'anonymous_chat_message');
  const daily = new Map<string, { pv: number; visitors: Set<string> }>();
  for (const event of humanPageViews) {
    if (!event.created_at) continue;
    const key = dayKey(event.created_at);
    const item = daily.get(key) || { pv: 0, visitors: new Set<string>() };
    item.pv += 1;
    const visitor = getVisitorKey(event);
    if (visitor) item.visitors.add(visitor);
    daily.set(key, item);
  }
  const funnelStarts = new Map<string, number>();
  const funnelDrops = new Map<string, number>();
  for (const event of events.filter((item) => item.event_name === 'flow_step' && item.step)) {
    const step = event.step as string;
    if (event.status === 'start') funnelStarts.set(step, (funnelStarts.get(step) || 0) + 1);
    if (event.status === 'drop' || event.status === 'error') funnelDrops.set(step, (funnelDrops.get(step) || 0) + 1);
  }
  const pageMap = new Map<string, { views: number; visitors: Set<string> }>();
  for (const event of humanPageViews) {
    const page = cleanLabel(event.page, '未知页面');
    const item = pageMap.get(page) || { views: 0, visitors: new Set<string>() };
    item.views += 1;
    const visitor = getVisitorKey(event);
    if (visitor) item.visitors.add(visitor);
    pageMap.set(page, item);
  }
  const duration = humanEngagements.reduce((sum, event) => sum + numberValue(event.metadata?.durationMs), 0);
  const activeDuration = humanEngagements.reduce((sum, event) => sum + numberValue(event.metadata?.activeDurationMs), 0);
  const userMessages = messages.filter((message) => message.role === 'user').length;
  const anonymousUserMessages = anonymousMessages.filter((event) => event.metadata?.role === 'user').length;
  const anonymousAssistantMessages = anonymousMessages.filter((event) => event.metadata?.role === 'assistant').length;
  const anonymousConversations = anonymousMessages
    .map((event) => typeof event.metadata?.anonymousConversationId === 'string'
      ? event.metadata.anonymousConversationId
      : typeof event.metadata?.batchId === 'string'
        ? `${event.session_id || 'unknown'}:${event.metadata.batchId}`
        : event.session_id)
    .filter((value): value is string => Boolean(value));
  const cityStats = aggregateCityStats(
    humanPageViews.map((event) => ({ city: event.metadata?.city, visitor: getVisitorKey(event) })),
  );
  const browserStats = countBy(humanPageViews.map((event) => classifyBrowser(event.user_agent || '')));
  const deviceStats = countBy(humanPageViews.map((event) => classifyDevice(event.user_agent || '')));
  const deviceModelStats = countBy(humanPageViews.map((event) => classifyDeviceModel(event.user_agent || '')));
  const operatingSystemStats = countBy(humanPageViews.map((event) => classifyOperatingSystem(event.user_agent || '')));
  const visitorDays = new Map<string, Set<string>>();
  for (const event of humanPageViews) {
    const visitor = getVisitorKey(event);
    if (!visitor || !event.created_at) continue;
    const days = visitorDays.get(visitor) || new Set<string>();
    days.add(dayKey(event.created_at));
    visitorDays.set(visitor, days);
  }
  const repeatVisitors = [...visitorDays.values()].filter((days) => days.size >= 2).length;
  const meaningfulEvents = events.filter((event) => ['anonymous_chat_message', 'chat_message_sent', 'meaningful_page_view', 'report_generation_success', 'path_opened', 'meaningful_action_completed'].includes(event.event_name || ''));
  const meaningfulVisitors = new Set(meaningfulEvents.map(getVisitorKey).filter(Boolean));
  const meaningfulDays = new Map<string, Set<string>>();
  for (const event of meaningfulEvents) {
    const visitor = getVisitorKey(event);
    if (!visitor || !event.created_at) continue;
    const days = meaningfulDays.get(visitor) || new Set<string>();
    days.add(dayKey(event.created_at));
    meaningfulDays.set(visitor, days);
  }
  const repeatMeaningfulUsers = [...meaningfulDays.values()].filter((days) => days.size >= 2).length;
  const activeDayBuckets = { '1天': 0, '2-3天': 0, '4-6天': 0, '7天及以上': 0 };
  for (const days of visitorDays.values()) {
    if (days.size === 1) activeDayBuckets['1天'] += 1;
    else if (days.size <= 3) activeDayBuckets['2-3天'] += 1;
    else if (days.size <= 6) activeDayBuckets['4-6天'] += 1;
    else activeDayBuckets['7天及以上'] += 1;
  }

  // AI token 用量（计费与定价参考；不含用户身份信息）
  const authUsageEvents = usageEvents.filter((event) => event.user_id);
  const anonUsageEvents = usageEvents.filter((event) => !event.user_id);
  const usagePerUser = new Map<string, number>();
  for (const event of authUsageEvents) {
    const key = event.user_id as string;
    usagePerUser.set(key, (usagePerUser.get(key) || 0) + (event.total_tokens || 0));
  }
  const usageRouteMap = new Map<string, { tokens: number; calls: number }>();
  for (const event of usageEvents) {
    const route = cleanLabel(event.route, '未知接口');
    const item = usageRouteMap.get(route) || { tokens: 0, calls: 0 };
    item.tokens += event.total_tokens || 0;
    item.calls += 1;
    usageRouteMap.set(route, item);
  }
  const perCallTokens = usageEvents.map((event) => event.total_tokens || 0).sort((a, b) => a - b);
  const percentileAt = (sorted: number[], ratio: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] : 0);
  const usageTotalCalls = usageEvents.length;
  const usageTotalTokens = usageEvents.reduce((sum, event) => sum + (event.total_tokens || 0), 0);
  const authUsageTokens = authUsageEvents.reduce((sum, event) => sum + (event.total_tokens || 0), 0);
  const anonUsageTokens = anonUsageEvents.reduce((sum, event) => sum + (event.total_tokens || 0), 0);
  const aiUsage = {
    calls: usageTotalCalls,
    totalTokens: usageTotalTokens,
    activeUsers: usagePerUser.size,
    authTokens: authUsageTokens,
    authCalls: authUsageEvents.length,
    avgPerCall: usageTotalCalls ? Math.round(usageTotalTokens / usageTotalCalls) : 0,
    avgPerUser: usagePerUser.size ? Math.round(authUsageTokens / usagePerUser.size) : 0,
    anonTokens: anonUsageTokens,
    anonCalls: anonUsageEvents.length,
    anonIps: new Set(anonUsageEvents.map((event) => event.anonymous_ip).filter(Boolean)).size,
    p50PerCall: percentileAt(perCallTokens, 0.5),
    p90PerCall: percentileAt(perCallTokens, 0.9),
    maxUserTokens: usagePerUser.size ? Math.max(...usagePerUser.values()) : 0,
    byRoute: [...usageRouteMap.entries()]
      .map(([name, item]) => ({ name, tokens: item.tokens, calls: item.calls }))
      .sort((a, b) => b.tokens - a.tokens || a.name.localeCompare(b.name, 'zh-Hans-CN'))
      .slice(0, 8),
  };
  // 现实路径教练：path_* 行为事件 + 路径页匿名对话（anonymous_chat_message @ /path）
  const realityPath = computeRealityPathStats(events);
  const setupWarnings = [
    profileError && 'user_profiles 查询失败，新增注册数可能不完整。',
    allProfilesError && 'user_profiles 总数查询失败。',
    authUsersError && '认证用户查询失败，总注册数可能不完整。',
    messageError && 'messages 查询失败，对话数可能不完整。',
    allTimeVisitorsError && 'analytics_events 历史查询失败，总访客数可能不完整。',
    usageError && 'ai_usage_events 查询失败，AI 用量数据可能不完整。',
    paymentResult.error && 'payment_requests 查询失败，付费/开通漏斗可能不完整。',
  ].filter(Boolean) as string[];

  const currentActivatedUsers = collectActivatedUsers(paymentRows, bounds.current);
  const previousActivatedUsers = collectActivatedUsers(paymentRows, bounds.previous);
  const currentCore = computeCoreMetrics(events, profiles, usageEvents, currentActivatedUsers);
  const previousCore = computeCoreMetrics(previousEvents, previousProfiles, previousUsageEvents, previousActivatedUsers);
  const comparison = buildComparison(currentCore, previousCore);
  const growthFunnel = buildGrowthFunnel(currentCore, previousCore);
  const dailySeries = [...daily.entries()].sort().map(([date, item]) => ({ date, pv: item.pv, uv: item.visitors.size }));
  const alerts = buildReportAlerts(currentCore, previousCore, dailySeries, internalCurrent, setupWarnings);
  const aiCost = buildAiCost(currentCore, usagePerUser.size);
  const summary = buildSummary(currentCore, previousCore, growthFunnel, alerts, aiCost);

  const report = {
    period,
    totals: {
      pv: currentCore.pv,
      uv: currentCore.uv,
      registrations: currentCore.registrations,
      registeredUsers: authUsers.length,
      verifiedUsers: authUsers.filter((user) => Boolean(user.email_confirmed_at)).length,
      initializedUsers: allProfiles.length,
      totalVisitors,
      engagedPages: humanEngagements.length,
      avgEngagement: humanEngagements.length ? formatDuration(duration / humanEngagements.length) : '0秒',
      messages: messages.length + anonymousMessages.length,
      userMessages: userMessages + anonymousUserMessages,
      assistantMessages: messages.filter((message) => message.role === 'assistant').length + anonymousAssistantMessages,
      conversations: new Set([...messages.map((message) => message.conversation_id), ...anonymousConversations].filter(Boolean)).size,
    },
    comparison,
    growthFunnel,
    summary,
    alerts,
    internalExcluded: { current: internalCurrent, previous: internalPrevious },
    aiCost,
    previousTotals: previousCore,
    daily: dailySeries,
    topPages: [...pageMap.entries()].sort((a, b) => b[1].visitors.size - a[1].visitors.size || b[1].views - a[1].views || a[0].localeCompare(b[0], 'zh-Hans-CN')).slice(0, 10).map(([page, item]) => ({ page, views: item.views, visitors: item.visitors.size })),
    funnel: [...funnelStarts.entries()].map(([step, starts]) => ({ step, starts, drops: funnelDrops.get(step) || 0, dropRate: starts ? Math.round(((funnelDrops.get(step) || 0) / starts) * 100) : 0 })),
    events: countBy(events.map((event) => event.event_name || '未知事件')),
    sources: countBy(humanPageViews.map((event) => cleanLabel(event.metadata?.trafficSource, 'direct'))),
    channels: countBy(humanPageViews.map((event) => cleanLabel(event.metadata?.trafficMedium, 'direct'))),
    campaigns: countBy(humanPageViews.map((event) => cleanLabel(event.metadata?.trafficCampaign, '无'))),
    bots: {
      pv: botPageViews.length,
      uv: new Set(botPageViews.map((event) => event.user_id || event.session_id).filter(Boolean)).size,
      types: countBy(botPageViews.map((event) => classifyBotType(event.user_agent || '') || '未知爬虫')),
    },
    cities: cityStats,
    browsers: browserStats,
    devices: deviceStats,
    deviceModels: deviceModelStats,
    operatingSystems: operatingSystemStats,
    retention: {
      visitors: visitorDays.size,
      repeatVisitors,
      repeatVisitorRate: visitorDays.size ? Number(((repeatVisitors / visitorDays.size) * 100).toFixed(1)) : 0,
      meaningfulVisitors: meaningfulVisitors.size,
      repeatMeaningfulUsers,
      repeatMeaningfulRate: visitorDays.size ? Number(((repeatMeaningfulUsers / visitorDays.size) * 100).toFixed(1)) : 0,
      activeDayBuckets,
    },
    setupWarnings,
    aiUsage,
    realityPath,
  };
  return report;
}

type WeeklyReport = Awaited<ReturnType<typeof buildWeeklyReport>>;

function escHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string
  ));
}

function formatChangeRate(rate: number | null) {
  if (rate === null) return '从 0 增加';
  return `${rate > 0 ? '+' : ''}${rate}%`;
}

function buildSummary(
  current: CoreMetrics,
  previous: CoreMetrics,
  funnel: FunnelStage[],
  alerts: ReportAlert[],
  aiCost: AiCostSummary,
): string[] {
  const lines: string[] = [];
  lines.push(
    `本周 ${current.uv} 位访客 / ${current.pv} 次 PV，较上周 UV ${formatChangeRate(changeRateValue(current.uv, previous.uv))}、PV ${formatChangeRate(changeRateValue(current.pv, previous.pv))}；新增注册 ${current.registrations} 人、路径开始 ${current.pathOpeners} 人、付费/开通 ${current.activatedUsers} 人。`
  );

  const weakest = funnel
    .slice(1)
    .filter((item) => item.stepRate !== null)
    .sort((a, b) => (a.stepRate as number) - (b.stepRate as number))[0];
  if (weakest) {
    lines.push(
      `转化链最弱的是「${weakest.name}」：环节转化率 ${weakest.stepRate}%${weakest.stepRateDelta === null ? '' : `（较上周 ${weakest.stepRateDelta > 0 ? '+' : ''}${weakest.stepRateDelta}pp）`}，本周 ${weakest.count} 人、上周 ${weakest.previous} 人，建议优先修复这一环节。`
    );
  } else {
    lines.push('本周转化链样本不足，暂无法计算环节转化率，先积累更多完整路径行为。');
  }

  const warning = alerts.find((item) => item.level === 'warning');
  lines.push(warning ? `最大异常：${warning.title}。${warning.detail}` : '本周未触发明显异常，关键指标处于正常波动区间。');

  const costText = aiCost.estimatedCostCny === null
    ? '未配置 ANALYTICS_AI_COST_PER_1K_TOKENS_CNY，暂不估算金额'
    : `按配置单价估算约 ¥${aiCost.estimatedCostCny.toLocaleString('en-US')}，人均 ¥${aiCost.estimatedCostPerVisitorCny ?? '—'}`;
  lines.push(
    `AI 与成本：${aiCost.calls} 次调用、${aiCost.totalTokens.toLocaleString('en-US')} tokens，人均 ${aiCost.tokensPerVisitor === null ? '—' : aiCost.tokensPerVisitor.toLocaleString('en-US')} tokens，${costText}；建议把成本和用户增长放在一起看。`
  );

  return lines;
}

function buildInsights(report: WeeklyReport): string[] {
  const { totals, daily, topPages, retention, sources, cities, bots, aiUsage } = report;
  const insights: string[] = [];
  const perCapita = totals.uv ? (totals.pv / totals.uv).toFixed(1) : '—';
  insights.push(`本周共 ${totals.pv} 次访问、${totals.uv} 位访客，人均浏览 ${perCapita} 页，平均有效停留 ${totals.avgEngagement}。全站历史累计访客 ${totals.totalVisitors} 人，累计注册 ${totals.registeredUsers} 人。`);
  if (bots.pv > 0) {
    const botTypes = bots.types.slice(0, 3).map((item) => item.name).join('、');
    insights.push(`另有 ${bots.pv} 次爬虫访问${botTypes ? `（${botTypes}等）` : ''}已剔除，不参与上方真实访客指标。`);
  }

  if (daily.length) {
    const peak = [...daily].sort((a, b) => b.pv - a.pv)[0];
    const trough = [...daily].sort((a, b) => a.pv - b.pv)[0];
    insights.push(`访问高峰在 ${peak.date}（PV ${peak.pv} / UV ${peak.uv}），低谷在 ${trough.date}（PV ${trough.pv}）；建议结合当日外发内容或活动复盘引流来源。`);
  }

  const regRate = totals.uv ? ((totals.registrations / totals.uv) * 100).toFixed(1) : '0';
  insights.push(
    totals.registrations > 0
      ? `访客→注册转化率约 ${regRate}%（新增 ${totals.registrations} 人），已注册 ${totals.registeredUsers} 人、验证 ${totals.verifiedUsers} 人，可重点跟进注册后的激活与留存。`
      : `本周无新增注册（注册率 0%），建议加强首屏价值钩子与注册引导。`
  );

  const topBucket = Object.entries(retention.activeDayBuckets).sort((a, b) => b[1] - a[1])[0];
  const topBucketText = topBucket && topBucket[1] > 0 ? `集中在「${topBucket[0]}」` : '';
  insights.push(
    retention.repeatVisitorRate < 10
      ? `回访率 ${retention.repeatVisitorRate}%（${retention.repeatVisitors}/${retention.visitors}）${topBucketText ? `，活跃天数${topBucketText}` : ''}；新客占主导，建议设计首访后的订阅、召回或下一条内容钩子。`
      : `回访率 ${retention.repeatVisitorRate}%（${retention.repeatVisitors}/${retention.visitors}）${topBucketText ? `，活跃天数${topBucketText}` : ''}；已有回访基础，可强化稳定更新节奏进一步拉高留存。`
  );

  if (topPages.length) {
    const top = topPages[0];
    const second = topPages[1];
    insights.push(
      second
        ? `内容上「${top.page}」最受关注（${top.views} 次），其次「${second.page}」（${second.views} 次）；可将资源向高价值页面倾斜。`
        : `内容上「${top.page}」最受关注（${top.views} 次），可作为重点承接与优化对象。`
    );
  }

  if (sources.length) {
    const mainSource = sources[0];
    insights.push(`流量来源以「${mainSource.name}」为主（${mainSource.count} 次），${sources.length > 1 ? `另有 ${sources.slice(1).map((item) => item.name).join('、')} 等渠道` : '渠道较单一，可拓展分发入口'}。`);
  }

  if (cities.length && cities[0].name !== '未知城市') {
    insights.push(`地域分布以「${cities[0].name}」领先（${cities[0].count} 次访问 / ${cities[0].visitors} 位访客），可用于判断内容与目标人群的匹配度。`);
  }

  if (aiUsage.calls > 0) {
    const topRoute = aiUsage.byRoute[0];
    const anonShare = aiUsage.totalTokens ? Math.round((aiUsage.anonTokens / aiUsage.totalTokens) * 100) : 0;
    insights.push(
      `AI 用量：本周 ${aiUsage.calls} 次模型调用共 ${aiUsage.totalTokens.toLocaleString('en-US')} tokens，登录用户 ${aiUsage.activeUsers} 人（人均 ${aiUsage.avgPerUser.toLocaleString('en-US')}），单次消耗中位 ${aiUsage.p50PerCall.toLocaleString('en-US')}、P90 ${aiUsage.p90PerCall.toLocaleString('en-US')}${topRoute ? `，大头是「${topRoute.name}」（${aiUsage.totalTokens ? Math.round((topRoute.tokens / aiUsage.totalTokens) * 100) : 0}%）` : ''}；匿名消耗占 ${anonShare}%，是免费额度的成本基准。`
    );
  }

  const realityPath = report.realityPath;
  if (realityPath.openedVisitors > 0 || realityPath.chatConversations > 0 || realityPath.mainlinesSelected > 0) {
    const step2Rate = realityPath.openedVisitors
      ? Math.round((realityPath.step2UnlockedVisitors / realityPath.openedVisitors) * 100)
      : 0;
    const step3Rate = realityPath.step2UnlockedVisitors
      ? Math.round((realityPath.step3UnlockedVisitors / realityPath.step2UnlockedVisitors) * 100)
      : 0;
    insights.push(
      `现实路径教练：${realityPath.openedVisitors} 位访客打开路径页，产生 ${realityPath.chatConversations} 场对话、${realityPath.chatUserMessages} 条用户消息；${realityPath.mainlinesSelected} 次设定主线${realityPath.mainlineBlocked ? `（另有 ${realityPath.mainlineBlocked} 次因完成度不足被引导）` : ''}。Step 2 解锁 ${realityPath.step2UnlockedVisitors} 人（路径页访客的 ${step2Rate}%），Step 3 解锁 ${realityPath.step3UnlockedVisitors} 人（Step 2 的 ${step3Rate}%），确认微行动 ${realityPath.microActions} 条、生成分享卡 ${realityPath.shareCards} 次。`
    );
    if (realityPath.evidence.total > 0) {
      insights.push(
        `路径证据：本周新增 ${realityPath.evidence.total} 张证据卡，其中已证实 ${realityPath.evidence.confirmed}、部分证实 ${realityPath.evidence.partial}、用户否定 ${realityPath.evidence.rejected}；需求对照已对上 ${realityPath.requirements.checked} 项、待确认 ${realityPath.requirements.pending} 项、暂无线索 ${realityPath.requirements.gap} 项。`
      );
    }
    if (realityPath.readiness.count > 0) {
      insights.push(
        `路径意愿与准备度：想做 ${realityPath.willingness.want} 次、观望 ${realityPath.willingness.unsure} 次、不想做 ${realityPath.willingness.no} 次；共生成 ${realityPath.readiness.count} 份准备度卡，平均 ${realityPath.readiness.averageScore} 分（分数仅来自已确认证据）。`
      );
    }
  }

  return insights;
}

function renderTrendSvg(daily: WeeklyReport['daily']): string {
  if (!daily.length) {
    return '<p style="margin:0;color:#64748b;font-size:13px;">本周期暂无每日访问数据。</p>';
  }
  const width = 660;
  const height = 220;
  const padL = 46;
  const padR = 18;
  const padT = 18;
  const padB = 36;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const values = daily.flatMap((item) => [item.pv, item.uv]);
  const max = Math.max(...values, 1);
  const n = daily.length;
  const xAt = (i: number) => padL + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const yAt = (value: number) => padT + innerH - (value / max) * innerH;

  const grid = [0, 0.5, 1]
    .map((ratio) => {
      const y = padT + innerH - ratio * innerH;
      const label = Math.round(max * ratio);
      return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${width - padR}" y2="${y.toFixed(1)}" stroke="#e5e9f2" stroke-width="1"/><text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#94a3b8">${label}</text>`;
    })
    .join('');

  const pvPoints = daily.map((item, i) => `${xAt(i).toFixed(1)},${yAt(item.pv).toFixed(1)}`).join(' ');
  const uvPoints = daily.map((item, i) => `${xAt(i).toFixed(1)},${yAt(item.uv).toFixed(1)}`).join(' ');
  const pvDots = daily.map((item, i) => `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(item.pv).toFixed(1)}" r="3.5" fill="#ff8a4c"/>`).join('');
  const uvDots = daily.map((item, i) => `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(item.uv).toFixed(1)}" r="3.5" fill="#3b82f6"/>`).join('');
  const xLabels = daily.map((item, i) => `<text x="${xAt(i).toFixed(1)}" y="${height - 10}" text-anchor="middle" font-size="11" fill="#64748b">${item.date.slice(5)}</text>`).join('');

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="每日访问趋势" style="display:block;max-width:100%;height:auto;">${grid}<polyline points="${pvPoints}" fill="none" stroke="#ff8a4c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${uvPoints}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>${pvDots}${uvDots}${xLabels}</svg>`;
}

function renderDataTable(headers: string[], rows: Array<Array<string | number>>, className = ''): string {
  const formatCell = (value: string | number) => (typeof value === 'number' ? value.toLocaleString('en-US') : clipText(value, 140));
  const thead = `<tr>${headers.map((header) => `<th style="padding:8px 10px;text-align:left;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e5e9f2;">${escHtml(header)}</th>`).join('')}</tr>`;
  const tbody = rows.map((row) => `<tr>${row.map((cell, index) => `<td style="padding:7px 10px;font-size:13px;color:#172033;border-bottom:1px solid #f1f5f9;word-break:break-word;overflow-wrap:anywhere;${index === 0 ? '' : 'text-align:left;'}">${escHtml(formatCell(cell))}</td>`).join('')}</tr>`).join('');
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="${className}" style="border-collapse:collapse;width:100%;"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

function statToRows(stats: Array<{ name: string; count: number }>): Array<Array<string | number>> {
  return stats.map((item) => [item.name, item.count]);
}

const METRIC_UNITS: Record<string, string> = {
  pv: '次',
  uv: '人',
  registrations: '人',
  pathOpeners: '人',
  pathFinalized: '人',
  activatedUsers: '人',
  aiCalls: '次',
  aiTokens: 'tokens',
};

function formatMetricLine(item: ComparisonItem) {
  const unit = METRIC_UNITS[item.key] || '';
  const suffix = item.significant ? ' · 显著变化' : '';
  return `- ${item.label}：${item.current.toLocaleString('en-US')} ${unit}（上周 ${item.previous.toLocaleString('en-US')}，${formatChangeRate(item.changeRate)}${suffix}）`;
}

export function renderWeeklyReportText(report: Awaited<ReturnType<typeof buildWeeklyReport>>, title = '网站周报') {
  const {
    period,
    totals,
    comparison,
    growthFunnel,
    summary,
    alerts,
    internalExcluded,
    aiCost,
    aiUsage,
    realityPath,
    daily,
    topPages,
    cities,
    funnel,
    bots,
    retention,
    setupWarnings,
  } = report;
  const lines: string[] = [];

  lines.push(`EchoTalent ${title}（${period.start} 至 ${period.end}，${period.timezone}）`);
  lines.push('');

  lines.push('本周结论：');
  lines.push(...summary.map((item) => `- ${item}`));
  lines.push('');

  if (alerts.length) {
    lines.push('异常与数据质量：');
    lines.push(...alerts.map((item) => `- 【${item.level === 'warning' ? '警告' : '提示'}】${item.title}：${item.detail}`));
    lines.push('');
  }

  lines.push('核心指标（本周 vs 上周）：');
  lines.push(...comparison.map(formatMetricLine));
  lines.push('');

  lines.push('转化漏斗（访问 → 注册 → 路径开始 → 路径定稿 → 付费/开通）：');
  for (const stage of growthFunnel) {
    const stepText = stage.stepRate === null
      ? ''
      : `｜环节转化 ${stage.stepRate}%${stage.previousStepRate === null ? '' : `（上周 ${stage.previousStepRate}%，${stage.stepRateDelta !== null && stage.stepRateDelta > 0 ? '+' : ''}${stage.stepRateDelta ?? 0}pp）`}`;
    lines.push(`- ${stage.name}：${stage.count} 人（上周 ${stage.previous} 人，${formatChangeRate(stage.changeRate)}）${stepText}`);
  }
  lines.push('');

  lines.push('AI 用量与成本：');
  lines.push(`- 调用 ${aiCost.calls} 次，${aiCost.totalTokens.toLocaleString('en-US')} tokens，单次平均 ${aiCost.avgPerCall.toLocaleString('en-US')}，人均 ${aiCost.tokensPerVisitor === null ? '—' : aiCost.tokensPerVisitor.toLocaleString('en-US')} tokens`);
  if (aiCost.estimatedCostCny === null) {
    lines.push('- 未配置 ANALYTICS_AI_COST_PER_1K_TOKENS_CNY，仅展示用量，不估算金额。');
  } else {
    lines.push(`- 估算成本 ¥${aiCost.estimatedCostCny.toLocaleString('en-US')}（单价 ¥${aiCost.unitCostCnyPer1kTokens}/千 tokens，人均 ¥${aiCost.estimatedCostPerVisitorCny ?? '—'}）`);
  }
  lines.push('');

  lines.push('用户与留存：');
  lines.push(`- 累计注册 ${totals.registeredUsers} 人，已验证 ${totals.verifiedUsers} 人，已初始化资料 ${totals.initializedUsers} 人，历史累计访客 ${totals.totalVisitors} 人`);
  lines.push(`- 回访用户 ${retention.repeatVisitors}/${retention.visitors}（${retention.repeatVisitorRate}%）；重复有效使用 ${retention.repeatMeaningfulUsers} 人（${retention.repeatMeaningfulRate}%）；平均有效停留 ${totals.avgEngagement}`);
  lines.push(`- 对话 ${totals.conversations} 场，用户消息 ${totals.userMessages} 条`);
  lines.push('');

  if (cities.length) {
    lines.push('城市分布（按访客数排序）：');
    lines.push(...cities.map((item) => `- ${item.name}：${item.visitors} 位访客（${item.count} 次 PV）`));
    lines.push('');
  }

  if (topPages.length) {
    lines.push('访问页面（按访客数排序）：');
    lines.push(...topPages.map((item) => `- ${item.page}：${item.visitors} 位访客（${item.views} 次 PV）`));
    lines.push('');
  }

  const hasPathData = realityPath.openedVisitors > 0
    || realityPath.chatConversations > 0
    || realityPath.mainlinesSelected > 0
    || realityPath.evidence.total > 0
    || realityPath.readiness.count > 0;
  if (hasPathData) {
    lines.push('现实路径教练：');
    lines.push(`- 路径页访客 ${realityPath.openedVisitors} 人，教练对话 ${realityPath.chatConversations} 场 / 用户消息 ${realityPath.chatUserMessages} 条`);
    lines.push(`- 主线设定 ${realityPath.mainlinesSelected} 次（完成度不足被引导 ${realityPath.mainlineBlocked} 次），解锁 Step 2 ${realityPath.step2UnlockedVisitors} 人 / Step 3 ${realityPath.step3UnlockedVisitors} 人`);
    lines.push(`- 证据卡：已证实 ${realityPath.evidence.confirmed} / 部分证实 ${realityPath.evidence.partial} / 用户否定 ${realityPath.evidence.rejected}（共 ${realityPath.evidence.total}）`);
    lines.push(`- 需求对照：已对上 ${realityPath.requirements.checked} / 待确认 ${realityPath.requirements.pending} / 暂无线索 ${realityPath.requirements.gap}`);
    lines.push(`- 意愿：想做 ${realityPath.willingness.want} / 观望 ${realityPath.willingness.unsure} / 不想做 ${realityPath.willingness.no}；准备度 ${realityPath.readiness.count} 份，平均 ${realityPath.readiness.averageScore} 分`);
    lines.push('');
  }

  lines.push('附录（二级明细）：');
  if (daily.length) {
    lines.push(...daily.map((item) => `- ${item.date}: PV ${item.pv} / UV ${item.uv}`));
  } else {
    lines.push('- 本周期暂无每日访问数据。');
  }
  if (funnel.length) {
    lines.push(...funnel.map((item) => `- flow_step ${item.step}: 开始 ${item.starts}，流失 ${item.drops}（${item.dropRate}%）`));
  }
  if (bots.pv > 0) {
    lines.push(`- 已剔除爬虫：${bots.pv} 次访问 / ${bots.uv} 访客（${bots.types.map((item) => `${item.name} ${item.count}`).join('，')}）`);
  }
  lines.push(`- 事件：${report.events.map((item) => `${item.name} ${item.count}`).join('，') || '无'}`);
  lines.push(`- 来源：${report.sources.map((item) => `${item.name} ${item.count}`).join('，') || '无'}`);
  lines.push(`- 渠道：${report.channels.map((item) => `${item.name} ${item.count}`).join('，') || '无'}`);
  lines.push(`- 活动：${report.campaigns.map((item) => `${item.name} ${item.count}`).join('，') || '无'}`);
  lines.push(`- 设备：${report.devices.map((item) => `${item.name} ${item.count}`).join('，') || '无'}`);
  lines.push(`- 设备型号：${report.deviceModels.map((item) => `${item.name} ${item.count}`).join('，') || '无'}`);
  lines.push(`- 操作系统：${report.operatingSystems.map((item) => `${item.name} ${item.count}`).join('，') || '无'}`);
  lines.push(`- 浏览器：${report.browsers.map((item) => `${item.name} ${item.count}`).join('，') || '无'}`);
  const activeDays = Object.entries(retention.activeDayBuckets).filter(([, count]) => count > 0);
  lines.push(`- 活跃天数：${activeDays.length ? activeDays.map(([name, count]) => `${name} ${count} 人`).join('，') : '无'}`);
  if (aiUsage.calls > 0) {
    lines.push(`- AI 调用明细：登录用户 ${aiUsage.activeUsers} 人，人均 ${aiUsage.avgPerUser.toLocaleString('en-US')} tokens；匿名 ${aiUsage.anonCalls} 次 / ${aiUsage.anonTokens.toLocaleString('en-US')} tokens；单次中位 ${aiUsage.p50PerCall.toLocaleString('en-US')}，P90 ${aiUsage.p90PerCall.toLocaleString('en-US')}`);
    if (aiUsage.byRoute.length) {
      lines.push(`- AI 分路由：${aiUsage.byRoute.map((item) => `${item.name} ${item.tokens.toLocaleString('en-US')}/${item.calls}次`).join('，')}`);
    }
  }
  lines.push('');

  lines.push('口径说明：');
  lines.push(`- 统计周期：${period.start} 至 ${period.end}（${period.timezone}，UTC+8）；上周对比：${period.previousStart} 至 ${period.previousEnd}。`);
  lines.push(`- 排除规则：仅统计生产站真实访问，剔除爬虫与内部流量（本周 ${internalExcluded.current} 条、上周 ${internalExcluded.previous} 条）；原始事件仍保留。`);
  lines.push('- PV 是页面访问次数，不代表人数；城市、页面等分布类数据优先看访客数，PV 仅作参考。');
  lines.push('- UV 为周期内去重访客；注册为新增 user_profiles；路径开始为打开路径页的访客；路径定稿为设定主线的访客；付费/开通为 payment_requests 中 activated 且激活时间在周期内的去重用户。');
  lines.push('- AI 成本按 ai_usage_events 的 total_tokens 与 ANALYTICS_AI_COST_PER_1K_TOKENS_CNY 估算；未配置单价时只展示用量。');
  if (setupWarnings.length) {
    lines.push(`- 数据提示：${setupWarnings.join(' ')}`);
  }

  return lines.join('\n');
}

export function renderWeeklyReportHtml(report: WeeklyReport, title = '网站周报') {
  const {
    period, totals, daily, topPages, funnel, events, sources, channels, campaigns,
    cities, browsers, devices, deviceModels, operatingSystems, retention, bots,
    setupWarnings, aiUsage, realityPath, comparison, growthFunnel, summary, alerts,
    internalExcluded, aiCost,
  } = report;
  const section = (heading: string, body: string) => `
    <div style="margin:0 0 20px;background:#ffffff;border:1px solid #e8eefb;border-radius:14px;padding:20px;">
      <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:14px;">${heading}</div>
      ${body}
    </div>`;

  const kpiCell = (value: string, label: string, hint = '') => `
    <td style="width:25%;padding:12px 6px;text-align:center;background:#ffffff;border:1px solid #e8eefb;border-radius:12px;vertical-align:top;">
      <div style="font-size:22px;font-weight:800;color:#ff8a4c;line-height:1.2;">${value}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px;">${label}</div>
      ${hint ? `<div style="font-size:11px;margin-top:4px;line-height:1.5;">${hint}</div>` : ''}
    </td>`;

  const changeLabel = (item: ComparisonItem | undefined) => {
    if (!item) return '';
    if (item.changeRate === null) return '<span style="color:#64748b;">上周 0 · 新增</span>';
    const color = item.changeRate > 0 ? '#0f9d58' : item.changeRate < 0 ? '#dc2626' : '#64748b';
    const significant = item.significant ? '<span style="margin-left:3px;font-size:10px;color:#b45309;">显著</span>' : '';
    return `<span style="color:${color};font-weight:600;">${item.changeRate > 0 ? '+' : ''}${item.changeRate}%</span>${significant}`;
  };
  const metricItem = (key: string) => comparison.find((item) => item.key === key);

  const kpiPrimary = [
    kpiCell(String(totals.uv), '访客 UV', changeLabel(metricItem('uv'))),
    kpiCell(String(totals.pv), '页面 PV', changeLabel(metricItem('pv'))),
    kpiCell(String(totals.registrations), '新增注册', changeLabel(metricItem('registrations'))),
    kpiCell(String(metricItem('activatedUsers')?.current ?? 0), '付费/开通', changeLabel(metricItem('activatedUsers'))),
  ].join('');
  const kpiSecondary = [
    kpiCell(String(totals.avgEngagement), '平均有效停留'),
    kpiCell(String(totals.totalVisitors), '历史累计访客'),
    kpiCell(`${retention.repeatVisitorRate}%`, '回访率'),
    kpiCell(aiCost.estimatedCostCny === null ? '未配置' : `¥${aiCost.estimatedCostCny.toLocaleString('en-US')}`, 'AI 估算成本', `人均 ${aiCost.tokensPerVisitor === null ? '—' : aiCost.tokensPerVisitor.toLocaleString('en-US')} tokens`),
  ].join('');

  const summarySection = section('本周结论（先看这里）', `<ul style="margin:0;padding-left:18px;color:#0f172a;font-size:13px;line-height:1.9;">${summary.map((item) => `<li style="margin-bottom:6px;">${escHtml(item)}</li>`).join('')}</ul>`);

  const alertSection = alerts.length
    ? section('异常与数据质量', alerts.map((item) => {
      const warning = item.level === 'warning';
      return `<div style="margin-bottom:10px;padding:10px 12px;border-radius:10px;background:${warning ? '#fff7ed' : '#eff6ff'};border:1px solid ${warning ? '#fdba74' : '#bfdbfe'};">
        <div style="font-size:13px;font-weight:700;color:${warning ? '#9a3412' : '#1d4ed8'};">${escHtml(item.title)}</div>
        <div style="font-size:12px;color:#475569;margin-top:4px;line-height:1.7;">${escHtml(item.detail)}</div>
      </div>`;
    }).join(''))
    : '';

  const comparisonRows = comparison.map((item) => [
    item.label,
    item.current.toLocaleString('en-US'),
    item.previous.toLocaleString('en-US'),
    item.changeRate === null ? '上周 0 · 新增' : `${item.changeRate > 0 ? '+' : ''}${item.changeRate}%${item.significant ? ' · 显著' : ''}`,
  ]);
  const comparisonSection = section('核心指标与环比', renderDataTable(['指标', '本周', '上周', '变化'], comparisonRows));

  const growthFunnelRows = growthFunnel.map((stage) => [
    stage.name,
    stage.count.toLocaleString('en-US'),
    stage.previous.toLocaleString('en-US'),
    stage.stepRate === null ? '—' : `${stage.stepRate}%`,
    stage.stepRateDelta === null ? '—' : `${stage.stepRateDelta > 0 ? '+' : ''}${stage.stepRateDelta}pp`,
  ]);
  const growthFunnelSection = section('增长转化漏斗', `${renderDataTable(['阶段', '本周', '上周', '环节转化率', '较上周'], growthFunnelRows)}
    <div style="margin-top:10px;font-size:11px;color:#94a3b8;line-height:1.6;">访问 → 注册 → 路径开始 → 路径定稿 → 付费/开通；环节转化率指相对上一阶段的转化。</div>`);

  const kpiAi = [
    kpiCell(aiCost.calls.toLocaleString('en-US'), 'AI 调用'),
    kpiCell(aiCost.totalTokens.toLocaleString('en-US'), 'AI Token'),
    kpiCell(aiCost.tokensPerVisitor === null ? '—' : aiCost.tokensPerVisitor.toLocaleString('en-US'), '人均 Token'),
    kpiCell(aiCost.estimatedCostCny === null ? '未配置' : `¥${aiCost.estimatedCostCny.toLocaleString('en-US')}`, '估算成本'),
  ].join('');
  const aiCostRows: Array<Array<string | number>> = [
    ['调用次数 / 总 Token', `${aiCost.calls.toLocaleString('en-US')} 次 / ${aiCost.totalTokens.toLocaleString('en-US')} tokens`],
    ['单次平均 / 登录用户人均', `${aiCost.avgPerCall.toLocaleString('en-US')} / ${aiUsage.avgPerUser.toLocaleString('en-US')} tokens`],
    ['登录活跃用户', `${aiCost.activeUsers} 人`],
    ['单次消耗 P50 / P90', `${aiUsage.p50PerCall.toLocaleString('en-US')} / ${aiUsage.p90PerCall.toLocaleString('en-US')}`],
    ['匿名消耗', `${aiUsage.anonTokens.toLocaleString('en-US')} tokens / ${aiUsage.anonCalls} 次`],
    ['估算成本', aiCost.estimatedCostCny === null
      ? '未配置 ANALYTICS_AI_COST_PER_1K_TOKENS_CNY'
      : `¥${aiCost.estimatedCostCny.toLocaleString('en-US')}（单价 ¥${aiCost.unitCostCnyPer1kTokens}/千 tokens，人均 ¥${aiCost.estimatedCostPerVisitorCny ?? '—'}）`],
  ];
  const aiCostSection = section('AI 用量与成本', `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:8px;margin-bottom:14px;"><tr>${kpiAi}</tr></table>
    ${renderDataTable(['指标', '数值'], aiCostRows)}
    ${aiUsage.byRoute.length ? `<div style="margin-top:14px;">${renderDataTable(['路由', 'Tokens', '调用次数'], aiUsage.byRoute.map((item) => [item.name, item.tokens.toLocaleString('en-US'), item.calls]))}</div>` : ''}
  `);

  const legend = `
    <div style="margin-bottom:8px;font-size:12px;color:#64748b;">
      <span style="display:inline-block;margin-right:14px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ff8a4c;margin-right:4px;"></span>PV（访问量）</span>
      <span style="display:inline-block;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#3b82f6;margin-right:4px;"></span>UV（访客数）</span>
    </div>`;

  const trendSection = section('每日访问趋势', `${legend}${renderTrendSvg(daily)}${renderDataTable(['日期', 'PV', 'UV'], daily.map((item) => [item.date, item.pv, item.uv]))}`);

  const pagesSection = topPages.length
    ? section('访问页面（按访客数排序）', renderDataTable(['页面', '访客数', 'PV'], topPages.map((item) => [item.page, item.visitors, item.views]), 'compact-table'))
    : '';

  const hasRealityPathData = realityPath.openedVisitors > 0
    || realityPath.chatConversations > 0
    || realityPath.mainlinesSelected > 0
    || realityPath.evidence.total > 0
    || realityPath.readiness.count > 0;
  const realityPathKpi = [kpiCell(String(realityPath.openedVisitors), '路径页访客'), kpiCell(String(realityPath.step2UnlockedVisitors), 'Step 2 解锁'), kpiCell(String(realityPath.step3UnlockedVisitors), 'Step 3 解锁'), kpiCell(String(realityPath.microActions), '确认微行动')].join('');
  const realityPathSection = hasRealityPathData
    ? section('现实路径教练', `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:8px;margin-bottom:14px;"><tr>${realityPathKpi}</tr></table>
    ${renderDataTable(['阶段', '数值'], [
      ['路径页访客 / 教练对话 / 用户消息', `${realityPath.openedVisitors} 人 / ${realityPath.chatConversations} 场 / ${realityPath.chatUserMessages} 条`],
      ['主线设定（完成度不足被引导）', `${realityPath.mainlinesSelected} 次（${realityPath.mainlineBlocked} 次）`],
      ['Step 2 / Step 3 解锁', `${realityPath.step2UnlockedVisitors} 人 / ${realityPath.step3UnlockedVisitors} 人`],
      ['确认微行动 / 分享卡生成', `${realityPath.microActions} 条 / ${realityPath.shareCards} 次`],
    ])}
    <div style="margin-top:14px;">${renderDataTable(['证据与意愿', '数值'], [
      ['证据卡：已证实 / 部分证实 / 用户否定', `${realityPath.evidence.confirmed} / ${realityPath.evidence.partial} / ${realityPath.evidence.rejected}`],
      ['需求对照：已对上 / 待确认 / 暂无线索', `${realityPath.requirements.checked} / ${realityPath.requirements.pending} / ${realityPath.requirements.gap}`],
      ['意愿：想做 / 观望 / 不想做', `${realityPath.willingness.want} / ${realityPath.willingness.unsure} / ${realityPath.willingness.no}`],
      ['准备度卡数量 / 平均分', `${realityPath.readiness.count} / ${realityPath.readiness.averageScore}`],
    ])}</div>`)
    : '';

  const citiesSection = cities.length
    ? section('城市分布（按访客数排序）', renderDataTable(['城市', '访客数', 'PV'], cities.map((item) => [item.name, item.visitors, item.count]), 'compact-table'))
    : '';

  const appendixBlock = (heading: string, body: string) => `<div style="margin:16px 0 8px;font-size:13px;font-weight:700;color:#334155;">${heading}</div>${body}`;
  const appendixParts: string[] = [];
  if (funnel.length) {
    appendixParts.push(appendixBlock('flow_step 明细', renderDataTable(['步骤', '开始', '流失', '流失率'], funnel.map((item) => [item.step, item.starts, item.drops, `${item.dropRate}%`]))));
  }
  if (bots.pv > 0) {
    appendixParts.push(appendixBlock('爬虫访问（已剔除）', renderDataTable(['爬虫类型', '次数'], statToRows(bots.types))));
  }
  if (events.length) appendixParts.push(appendixBlock('事件分布', renderDataTable(['事件', '次数'], statToRows(events))));
  if (sources.length) appendixParts.push(appendixBlock('流量来源', renderDataTable(['来源', '次数'], statToRows(sources))));
  if (channels.length) appendixParts.push(appendixBlock('渠道类型', renderDataTable(['渠道', '次数'], statToRows(channels))));
  if (campaigns.length) appendixParts.push(appendixBlock('营销活动', renderDataTable(['活动', '次数'], statToRows(campaigns))));
  const deviceBlocks = [
    ['设备类别', devices],
    ['设备型号', deviceModels],
    ['操作系统', operatingSystems],
    ['浏览器', browsers],
  ] as const;
  for (const [label, stats] of deviceBlocks) {
    if (stats.length) appendixParts.push(appendixBlock(label, renderDataTable([label, '次数'], statToRows(stats))));
  }
  const activeDays = Object.entries(retention.activeDayBuckets).filter(([, count]) => count > 0);
  if (activeDays.length) {
    appendixParts.push(appendixBlock('活跃天数', renderDataTable(['活跃天数', '人数'], activeDays.map(([name, count]) => [name, count]))));
  }
  const insights = buildInsights(report);
  appendixParts.push(appendixBlock('运营观察', `<ul style="margin:0;padding-left:18px;color:#334155;font-size:12px;line-height:1.8;">${insights.map((item) => `<li style="margin-bottom:5px;">${escHtml(item)}</li>`).join('')}</ul>`));
  const appendixSection = `<div style="margin:0 0 20px;background:#ffffff;border:1px solid #e8eefb;border-radius:14px;padding:20px;">
    <details>
      <summary style="cursor:pointer;font-size:15px;font-weight:700;color:#0f172a;">附录：二级明细（点击展开）</summary>
      <div style="margin-top:10px;">${appendixParts.join('')}</div>
    </details>
  </div>`;

  const warningText = setupWarnings.length ? `<p style="margin:0 0 20px;padding:12px;background:#fff7ed;border:1px solid #fdba74;border-radius:10px;color:#9a3412;font-size:12px;">${setupWarnings.map(escHtml).join('<br>')}</p>` : '';

  const footer = `
    <div style="color:#94a3b8;font-size:11px;line-height:1.7;">
      <div style="font-weight:700;color:#64748b;margin-bottom:4px;">口径说明</div>
      <div>统计周期：${escHtml(period.start)} 至 ${escHtml(period.end)}（${escHtml(period.timezone)}，UTC+8）；上周对比：${escHtml(period.previousStart)} 至 ${escHtml(period.previousEnd)}。</div>
      <div>排除规则：仅统计生产站真实访问，剔除爬虫与内部流量（本周 ${internalExcluded.current} 条、上周 ${internalExcluded.previous} 条）；原始事件仍保留，仅统计口径不含内部访问。</div>
      <div>PV 是页面访问次数，不代表人数；城市、页面等分布类数据优先看访客数，PV 仅作次要参考。</div>
      <div>UV 为周期内去重访客；注册为新增 user_profiles；路径开始为打开路径页的访客；路径定稿为设定主线的访客；付费/开通为 payment_requests 中 activated 且激活时间在周期内的去重用户。</div>
      <div>page_view：页面打开/路由进入事件；page_engagement：离开页面或隐藏时上报的停留与滚动事件；对话同时统计登录 messages 与匿名 anonymous_chat_message。</div>
      <div>现实路径：按 path_* 行为事件与 /path 页匿名对话聚合；Step 解锁按访客去重，准备度分数仅来自用户已确认证据。</div>
      <div>城市/设备/浏览器：按请求地理标记与 User-Agent 聚合，IP 不写入周报。</div>
      <div>AI 用量与成本：按 ai_usage_events 流水聚合；成本按 total_tokens 与 ANALYTICS_AI_COST_PER_1K_TOKENS_CNY 估算，未配置单价时只展示用量。</div>
    </div>`;

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;background:#f5f8ff;padding:24px 12px;" class="report-wrap">
    <style>
      @media (max-width:520px) {
        .report-wrap { padding:12px 6px !important; }
        .report-wrap th, .report-wrap td { padding:5px 6px !important; font-size:12px !important; }
        .compact-table th:nth-child(3), .compact-table td:nth-child(3) { display:none !important; }
      }
    </style>
    <div style="max-width:680px;margin:0 auto;">
      <div style="margin-bottom:20px;">
        <div style="font-size:13px;letter-spacing:.08em;color:#6b7280;text-transform:uppercase;">EchoTalent 天赋探索</div>
        <h2 style="margin:6px 0 4px;font-size:24px;color:#0f172a;">EchoTalent ${escHtml(title)}</h2>
        <div style="font-size:13px;color:#64748b;">${escHtml(period.start)} 至 ${escHtml(period.end)}（${escHtml(period.timezone)}）</div>
      </div>

      ${summarySection}
      ${alertSection}

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:8px;margin-bottom:12px;"><tr>${kpiPrimary}</tr></table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:8px;margin-bottom:20px;"><tr>${kpiSecondary}</tr></table>

      ${comparisonSection}
      ${growthFunnelSection}
      ${aiCostSection}
      ${trendSection}
      ${pagesSection}
      ${citiesSection}
      ${realityPathSection}
      ${warningText}
      ${appendixSection}
      ${footer}
    </div>
  </div>`;
}
