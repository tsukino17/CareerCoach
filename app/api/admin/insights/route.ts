import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { isAllowedOrigin } from '@/lib/request-security';
import { getAiUsageAdminStats, type AiUsageAdminStats } from '@/lib/token-usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

type MessageRow = {
  id?: string | null;
  user_id?: string | null;
  conversation_id?: string | null;
  role: string | null;
  content: string | null;
  created_at: string | null;
};

type ProfileRow = {
  user_id: string | null;
  created_at: string | null;
};

const STOPWORDS = new Set([
  '我们', '你们', '他们', '这个', '那个', '然后', '就是', '因为', '所以', '一个', '不是',
  '没有', '可以', '自己', '已经', '如果', '还是', '一下', '现在', '今天', '感觉', '比较',
  '你', '我', '他', '她', '它', '了', '呢', '吗', '啊', '吧', '和', '在', '是', '有',
  'to', 'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your',
]);

function tokenize(input: string) {
  const raw = input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return raw.filter((word) => {
    if (word.length < 2 || word.length > 24 || STOPWORDS.has(word)) return false;
    if (/^\d{5,}$/.test(word)) return false;
    if (/^\d+[\d\-_\s]+$/.test(word)) return false;
    if (/^[a-z0-9._%+-]+@[a-z0-9.-]+$/i.test(word)) return false;
    return true;
  });
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function getRange(req: Request) {
  const url = new URL(req.url);
  const preset = url.searchParams.get('preset') || 'today';
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  if (preset === '7d') {
    start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  } else if (preset === '30d' || preset === 'month') {
    start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  } else if (preset === 'custom') {
    const startRaw = url.searchParams.get('start');
    const endRaw = url.searchParams.get('end');
    if (startRaw) start = new Date(`${startRaw}T00:00:00`);
    if (endRaw) end = new Date(`${endRaw}T23:59:59`);
  }

  start.setHours(0, 0, 0, 0);
  if (preset !== 'custom') end.setHours(23, 59, 59, 999);

  return {
    preset,
    since: start.toISOString(),
    until: end.toISOString(),
    startDate: dayKey(start.toISOString()),
    endDate: dayKey(end.toISOString()),
  };
}

function getSiteScope(req: Request) {
  const url = new URL(req.url);
  const scope = url.searchParams.get('site') || 'production';
  return scope === 'all' ? 'all' : 'production';
}

function getEventHost(event: EventRow) {
  const metadataHost = event.metadata?.host;
  if (typeof metadataHost === 'string' && metadataHost.trim()) {
    return metadataHost.trim().replace(/^www\./, '').toLowerCase();
  }

  const siteUrl = event.metadata?.siteUrl || event.metadata?.url;
  if (typeof siteUrl === 'string' && siteUrl.trim()) {
    try {
      return new URL(siteUrl).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return '';
    }
  }

  return '';
}

function isProductionSiteEvent(event: EventRow) {
  const isProductionSite = event.metadata?.isProductionSite;
  if (isProductionSite === true) return true;
  const host = getEventHost(event);
  return host === 'echotalent.fun';
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function getVisitorKey(event: EventRow) {
  const anonymousVisitorId = event.metadata?.anonymousVisitorId;
  return event.user_id || (typeof anonymousVisitorId === 'string' ? anonymousVisitorId : null) || event.session_id || null;
}

function getTextValue(value: unknown, fallback = 'unknown') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function addCount(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function mapToRank(map: Map<string, number>, limit = 20) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

const INPUT_CATEGORIES = [
  { name: '职业迷茫', pattern: /迷茫|不知道|方向|选择|卡住|困惑|焦虑|未来/ },
  { name: '转行求职', pattern: /转行|转岗|求职|简历|面试|岗位|职业|工作|跳槽|offer/i },
  { name: '自我认知', pattern: /天赋|优势|性格|适合|能力|兴趣|价值观|自我|喜欢|擅长/ },
  { name: '创业产品', pattern: /创业|产品|用户|市场|商业化|增长|获客|流量|需求|竞品/ },
  { name: '情绪能量', pattern: /累|疲惫|崩溃|压力|害怕|低落|抑郁|内耗|没力气|撑不住/ },
  { name: '学习成长', pattern: /学习|成长|技能|课程|训练|提升|路径|计划|行动/ },
  { name: '报告工具', pattern: /报告|分析|测评|画像|工具|功能|生成|页面/ },
];

function categorizeInput(text: string) {
  return INPUT_CATEGORIES.find((item) => item.pattern.test(text))?.name || '其他问题';
}

function sanitizeInputPreview(text: string) {
  return text
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[邮箱]')
    .replace(/1[3-9]\d{9}/g, '[手机号]')
    .replace(/\d{6,}/g, '[数字]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return '0秒';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}分${rest}秒` : `${minutes}分钟`;
}

function isSetupSchemaError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  return code === '42P01' || code === '42703' || /could not find the table|column .* does not exist|does not exist|schema cache/i.test(message);
}

export async function GET(req: Request) {
  try {
    if (!isAllowedOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    }
    const { supabaseAdmin } = await requireAdmin(req);

    const range = getRange(req);
    const siteScope = getSiteScope(req);

    // 并行查询所有独立数据源，避免串行等待
    const [eventsResult, profilesResult, messagesResult, aiUsageResult] = await Promise.all([
      supabaseAdmin
        .from('analytics_events')
        .select('event_name, page, step, status, session_id, user_id, metadata, user_agent, created_at')
        .gte('created_at', range.since)
        .lte('created_at', range.until)
        .order('created_at', { ascending: false })
        .limit(20000),
      supabaseAdmin
        .from('user_profiles')
        .select('user_id, created_at')
        .gte('created_at', range.since)
        .lte('created_at', range.until)
        .order('created_at', { ascending: false })
        .limit(5000),
      supabaseAdmin
        .from('messages')
        .select('id, user_id, conversation_id, role, content, created_at')
        .gte('created_at', range.since)
        .lte('created_at', range.until)
        .order('created_at', { ascending: false })
        .limit(10000),
      getAiUsageAdminStats(range.since, range.until).catch(() => null),
    ]);

    const eventsError = eventsResult.error;
    if (eventsError && !isSetupSchemaError(eventsError)) throw eventsError;
    const allEvents = (eventsResult.error ? [] : eventsResult.data || []) as EventRow[];
    const events = siteScope === 'production'
      ? allEvents.filter(isProductionSiteEvent)
      : allEvents;
    const visitMap = new Map<string, number>();
    const registrationMap = new Map<string, number>();
    const dailyVisitorMap = new Map<string, Set<string>>();
    const pageStatsMap = new Map<string, { page: string; views: number; visitors: Set<string>; totalDurationMs: number; engagementCount: number; totalScrollDepth: number }>();
    const stepStartMap = new Map<string, number>();
    const stepDropMap = new Map<string, number>();
    const sourceMap = new Map<string, number>();
    const cityMap = new Map<string, number>();
    const featureMap = new Map<string, number>();
    const eventNameMap = new Map<string, number>();
    const dailyAuthenticatedMap = new Map<string, Set<string>>();
    const dailyEngagementMap = new Map<string, { totalDurationMs: number; count: number }>();
    const visitorActivityMap = new Map<string, Set<string>>();
    const visitorMeaningfulActivityMap = new Map<string, Set<string>>();
    const visitorSessionMap = new Map<string, Set<string>>();

    for (const e of events) {
      if (!e.created_at) continue;
      const d = dayKey(e.created_at);
      const visitorKey = getVisitorKey(e);
      if (visitorKey) {
        const activity = visitorActivityMap.get(visitorKey) || new Set<string>();
        activity.add(d);
        visitorActivityMap.set(visitorKey, activity);
        if (['anonymous_chat_message', 'chat_message_sent', 'meaningful_page_view', 'report_generation_success', 'path_opened', 'meaningful_action_completed'].includes(e.event_name || '')) {
          const meaningful = visitorMeaningfulActivityMap.get(visitorKey) || new Set<string>();
          meaningful.add(d);
          visitorMeaningfulActivityMap.set(visitorKey, meaningful);
        }
        if (e.session_id) {
          const sessions = visitorSessionMap.get(visitorKey) || new Set<string>();
          sessions.add(e.session_id);
          visitorSessionMap.set(visitorKey, sessions);
        }
      }
      if (e.event_name) addCount(eventNameMap, e.event_name);
      if (e.user_id) {
        const users = dailyAuthenticatedMap.get(d) || new Set<string>();
        users.add(e.user_id);
        dailyAuthenticatedMap.set(d, users);
      }
      if (e.event_name === 'page_view') {
        visitMap.set(d, (visitMap.get(d) || 0) + 1);
        addCount(sourceMap, getTextValue(e.metadata?.trafficSource, 'direct'));
        addCount(cityMap, getTextValue(e.metadata?.city, '未知城市'));
        addCount(featureMap, getTextValue(e.metadata?.feature, 'general'));
        const visitorKey = getVisitorKey(e);
        if (visitorKey) {
          const visitors = dailyVisitorMap.get(d) || new Set<string>();
          visitors.add(visitorKey);
          dailyVisitorMap.set(d, visitors);
        }
        const page = e.page || 'unknown';
        const pageStats = pageStatsMap.get(page) || {
          page,
          views: 0,
          visitors: new Set<string>(),
          totalDurationMs: 0,
          engagementCount: 0,
          totalScrollDepth: 0,
        };
        pageStats.views += 1;
        if (visitorKey) pageStats.visitors.add(visitorKey);
        pageStatsMap.set(page, pageStats);
      }
      if (e.event_name === 'page_engagement') {
        const page = e.page || 'unknown';
        addCount(featureMap, getTextValue(e.metadata?.feature, 'general'));
        const dailyEngagement = dailyEngagementMap.get(d) || { totalDurationMs: 0, count: 0 };
        dailyEngagement.totalDurationMs += asNumber(e.metadata?.durationMs);
        dailyEngagement.count += 1;
        dailyEngagementMap.set(d, dailyEngagement);
        const pageStats = pageStatsMap.get(page) || {
          page,
          views: 0,
          visitors: new Set<string>(),
          totalDurationMs: 0,
          engagementCount: 0,
          totalScrollDepth: 0,
        };
        pageStats.totalDurationMs += asNumber(e.metadata?.durationMs);
        pageStats.totalScrollDepth += asNumber(e.metadata?.maxScrollDepth);
        pageStats.engagementCount += 1;
        pageStatsMap.set(page, pageStats);
      }
      if (e.event_name === 'flow_step' && e.step) {
        if (e.status === 'start') stepStartMap.set(e.step, (stepStartMap.get(e.step) || 0) + 1);
        if (e.status === 'drop' || e.status === 'error') stepDropMap.set(e.step, (stepDropMap.get(e.step) || 0) + 1);
      }
    }

    const dailyVisits = Array.from(visitMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count, visitors: dailyVisitorMap.get(date)?.size || 0 }));

    const pageStats = Array.from(pageStatsMap.values())
      .sort((a, b) => b.views - a.views)
      .slice(0, 20)
      .map((item) => {
        const avgDurationMs = item.engagementCount > 0 ? Math.round(item.totalDurationMs / item.engagementCount) : 0;
        const avgScrollDepth = item.engagementCount > 0 ? Math.round(item.totalScrollDepth / item.engagementCount) : 0;
        return {
          page: item.page,
          views: item.views,
          visitors: item.visitors.size,
          avgDurationMs,
          avgDurationLabel: formatDuration(avgDurationMs),
          avgScrollDepth,
        };
      });

    const funnel = Array.from(stepStartMap.entries()).map(([step, starts]) => {
      const drops = stepDropMap.get(step) || 0;
      const dropRate = starts > 0 ? Number(((drops / starts) * 100).toFixed(2)) : 0;
      return { step, starts, drops, dropRate };
    });

    const profilesError = profilesResult.error;
    const profilesData = profilesResult.data;
    if (profilesError && !isSetupSchemaError(profilesError)) throw profilesError;

    const profiles = (profilesError ? [] : profilesData || []) as ProfileRow[];
    for (const profile of profiles) {
      if (!profile.created_at) continue;
      const d = dayKey(profile.created_at);
      registrationMap.set(d, (registrationMap.get(d) || 0) + 1);
    }

    const dailyRegistrations = Array.from(registrationMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    const uniqueVisitors = new Set(events.map(getVisitorKey).filter(Boolean)).size;
    const repeatVisitors = Array.from(visitorActivityMap.values()).filter((days) => days.size >= 2).length;
    const repeatMeaningfulUsers = Array.from(visitorMeaningfulActivityMap.values()).filter((days) => days.size >= 2).length;
    const activeDayBuckets = { '1天': 0, '2-3天': 0, '4-6天': 0, '7天及以上': 0 };
    for (const days of visitorActivityMap.values()) {
      if (days.size === 1) activeDayBuckets['1天'] += 1;
      else if (days.size <= 3) activeDayBuckets['2-3天'] += 1;
      else if (days.size <= 6) activeDayBuckets['4-6天'] += 1;
      else activeDayBuckets['7天及以上'] += 1;
    }
    const authenticatedVisitors = new Set(events.map((event) => event.user_id).filter(Boolean)).size;
    const totalEngagementMs = Array.from(pageStatsMap.values()).reduce((sum, item) => sum + item.totalDurationMs, 0);
    const totalEngagementCount = Array.from(pageStatsMap.values()).reduce((sum, item) => sum + item.engagementCount, 0);
    const avgEngagementMs = totalEngagementCount > 0 ? Math.round(totalEngagementMs / totalEngagementCount) : 0;

    const recentVisitors = events
      .filter((event) => event.event_name === 'page_view')
      .slice(0, 30)
      .map((event) => ({
        at: event.created_at,
        page: event.page || 'unknown',
        visitor: event.user_id ? `user:${event.user_id.slice(0, 8)}` : event.session_id ? `anon:${event.session_id.slice(-8)}` : 'unknown',
        userAgent: event.user_agent || '',
      }));

    const journeyMap = new Map<string, {
      visitor: string;
      userId: string | null;
      sessions: Set<string>;
      chatTurns: number;
      reportsGenerated: number;
      reportViews: number;
      reportEngagementMs: number;
      shares: number;
      pathMessages: number;
      actionsCompleted: number;
      lastAt: string | null;
      // 详细维度
      firstAt: string | null;
      pageViews: number;
      dwellMs: number;
      firstPage: string | null;
      lastPage: string | null;
      entrySource: string;
      stagesReached: Set<string>;
      firstActionAt: string | null;
      firstChatAt: string | null;
      firstReportAt: string | null;
      keyActions: Array<{ type: string; at: string | null; page: string | null }>;
    }>();
    // 全局聚合：页面跳转路径、停留分布、入口/出口、阶段漏斗、首次行动耗时
    const pageTransitionMap = new Map<string, number>();
    const dwellBucketMap = new Map<string, number>();
    const dropOffPageMap = new Map<string, number>();
    const entryPageMap = new Map<string, number>();
    const exitPageMap = new Map<string, number>();
    const stageUserMap = new Map<string, Set<string>>();
    const timeToFirstActionMsList: number[] = [];
    // 每个访客上一次看到的 page_view（DESC 迭代中是较晚的一个，新事件是较早的）
    const visitorPageViewLastMap = new Map<string, { page: string; at: string }>();

    for (const event of events) {
      const visitor = getVisitorKey(event);
      if (!visitor) continue;
      const item = journeyMap.get(visitor) || {
        visitor,
        userId: event.user_id,
        sessions: new Set<string>(),
        chatTurns: 0,
        reportsGenerated: 0,
        reportViews: 0,
        reportEngagementMs: 0,
        shares: 0,
        pathMessages: 0,
        actionsCompleted: 0,
        lastAt: event.created_at,
        firstAt: event.created_at,
        pageViews: 0,
        dwellMs: 0,
        firstPage: null as string | null,
        lastPage: null as string | null,
        entrySource: 'direct',
        stagesReached: new Set<string>(),
        firstActionAt: null as string | null,
        firstChatAt: null as string | null,
        firstReportAt: null as string | null,
        keyActions: [] as Array<{ type: string; at: string | null; page: string | null }>,
      };
      if (event.session_id) item.sessions.add(event.session_id);
      if (event.created_at) {
        if (!item.lastAt || event.created_at > item.lastAt) item.lastAt = event.created_at;
        if (!item.firstAt || event.created_at < item.firstAt) item.firstAt = event.created_at;
      }
      if (event.event_name === 'chat_message_sent' || (event.event_name === 'anonymous_chat_message' && event.metadata?.role === 'user')) {
        item.chatTurns += 1;
        item.stagesReached.add('chat');
        stageUserMap.set('chat', (stageUserMap.get('chat') || new Set<string>()).add(visitor));
        if (!item.firstChatAt || (event.created_at && event.created_at < item.firstChatAt)) item.firstChatAt = event.created_at;
        if (!item.firstActionAt && event.created_at) {
          item.firstActionAt = event.created_at;
          item.keyActions.push({ type: 'first_chat', at: event.created_at, page: event.page });
        }
      }
      if (event.event_name === 'report_generation_success') {
        item.reportsGenerated += 1;
        item.stagesReached.add('report');
        stageUserMap.set('report', (stageUserMap.get('report') || new Set<string>()).add(visitor));
        if (!item.firstReportAt || (event.created_at && event.created_at < item.firstReportAt)) item.firstReportAt = event.created_at;
        if (item.firstChatAt && event.created_at) {
          // 已经设置过 timeToFirstAction 时跳过
        }
        if (!item.firstActionAt && event.created_at) {
          item.firstActionAt = event.created_at;
          item.keyActions.push({ type: 'first_report', at: event.created_at, page: event.page });
        }
      }
      if (event.event_name === 'report_viewed') item.reportViews += 1;
      if (event.event_name === 'report_engagement') item.reportEngagementMs += asNumber(event.metadata?.durationMs);
      if (event.event_name === 'report_shared' || event.event_name === 'report_image_saved') item.shares += 1;
      if (event.event_name === 'path_chat_message_sent' || event.event_name === 'path_opened') {
        if (event.event_name === 'path_chat_message_sent') item.pathMessages += 1;
        item.stagesReached.add('path');
        stageUserMap.set('path', (stageUserMap.get('path') || new Set<string>()).add(visitor));
        if (!item.firstActionAt && event.created_at) {
          item.firstActionAt = event.created_at;
          item.keyActions.push({ type: 'first_path', at: event.created_at, page: event.page });
        }
      }
      if (event.event_name === 'action_completed') {
        item.actionsCompleted += 1;
        item.stagesReached.add('action');
        stageUserMap.set('action', (stageUserMap.get('action') || new Set<string>()).add(visitor));
        if (!item.firstActionAt && event.created_at) {
          item.firstActionAt = event.created_at;
          item.keyActions.push({ type: 'first_action', at: event.created_at, page: event.page });
        }
      }
      // page_view：构建每个访客的页面序列、入口/出口、页面跳转图
      if (event.event_name === 'page_view' && event.created_at) {
        item.pageViews += 1;
        item.stagesReached.add('visit');
        stageUserMap.set('visit', (stageUserMap.get('visit') || new Set<string>()).add(visitor));
        // 由于 events 是 DESC 排序，先看到的是较晚的事件
        // lastPage = 首次看到的（最晚的）；firstPage = 最后看到的（最早的）
        if (!item.lastPage) {
          item.lastPage = event.page || 'unknown';
          // lastPage 也即 dropOffPage
          if (event.page) dropOffPageMap.set(event.page, (dropOffPageMap.get(event.page) || 0) + 1);
        }
        item.firstPage = event.page || 'unknown';
        // 入口页：firstPage 是 DESC 迭代里最后一次赋值的（即最早的 page_view）
        // 出口页：lastPage 是 DESC 迭代里第一次赋值的（即最晚的 page_view）
        const prev = visitorPageViewLastMap.get(visitor);
        if (prev && event.created_at < prev.at) {
          // 当前事件较早，prev 较晚 → 跳转方向 event.page → prev.page
          const from = event.page || 'unknown';
          const to = prev.page;
          const key = `${from}→${to}`;
          pageTransitionMap.set(key, (pageTransitionMap.get(key) || 0) + 1);
        }
        visitorPageViewLastMap.set(visitor, { page: event.page || 'unknown', at: event.created_at });
        if (!item.entrySource || item.entrySource === 'direct') {
          const src = getTextValue(event.metadata?.trafficSource, 'direct');
          if (src && src !== 'direct') item.entrySource = src;
        }
      }
      // page_engagement：累计停留时长，分桶
      if (event.event_name === 'page_engagement') {
        const durationMs = asNumber(event.metadata?.durationMs);
        item.dwellMs += durationMs;
        const bucket = durationMs < 10000 ? '<10秒'
          : durationMs < 30000 ? '10-30秒'
          : durationMs < 60000 ? '30-60秒'
          : durationMs < 180000 ? '1-3分钟'
          : durationMs < 600000 ? '3-10分钟'
          : '10分钟+';
        dwellBucketMap.set(bucket, (dwellBucketMap.get(bucket) || 0) + 1);
      }
      journeyMap.set(visitor, item);
    }

    // 入口/出口页统计（基于每个访客的 firstPage/lastPage）
    for (const item of journeyMap.values()) {
      if (item.firstPage) entryPageMap.set(item.firstPage, (entryPageMap.get(item.firstPage) || 0) + 1);
      if (item.lastPage) exitPageMap.set(item.lastPage, (exitPageMap.get(item.lastPage) || 0) + 1);
    }

    const userJourneys = Array.from(journeyMap.values())
      .sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)))
      .slice(0, 100)
      .map((item) => {
        const timeToFirstActionMs = item.firstActionAt && item.firstAt
          ? Math.max(0, new Date(item.firstActionAt).getTime() - new Date(item.firstAt).getTime())
          : null;
        if (timeToFirstActionMs !== null && timeToFirstActionMs >= 0) timeToFirstActionMsList.push(timeToFirstActionMs);
        const timeFromChatToReportMs = item.firstChatAt && item.firstReportAt
          ? Math.max(0, new Date(item.firstReportAt).getTime() - new Date(item.firstChatAt).getTime())
          : null;
        return {
          visitor: item.userId ? `user:${item.userId.slice(0, 8)}` : `anon:${item.visitor.slice(-8)}`,
          sessions: item.sessions.size,
          chatTurns: item.chatTurns,
          reportsGenerated: item.reportsGenerated,
          reportViews: item.reportViews,
          reportEngagementMs: item.reportEngagementMs,
          shares: item.shares,
          pathMessages: item.pathMessages,
          actionsCompleted: item.actionsCompleted,
          lastAt: item.lastAt,
          firstAt: item.firstAt,
          pageViews: item.pageViews,
          dwellMs: item.dwellMs,
          avgDwellMs: item.pageViews > 0 ? Math.round(item.dwellMs / item.pageViews) : 0,
          firstPage: item.firstPage,
          lastPage: item.lastPage,
          entrySource: item.entrySource,
          stagesReached: Array.from(item.stagesReached),
          dropOffPage: item.lastPage,
          timeToFirstActionMs,
          timeFromChatToReportMs,
          keyActions: item.keyActions.slice(0, 10),
        };
      });

    // 全局旅程聚合
    const totalVisitorsForJourney = journeyMap.size || 1;
    const pageTransitions = Array.from(pageTransitionMap.entries())
      .map(([key, count]) => {
        const [from, to] = key.split('→');
        return { from: from || 'unknown', to: to || 'unknown', count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
    const dwellOrder = ['<10秒', '10-30秒', '30-60秒', '1-3分钟', '3-10分钟', '10分钟+'];
    const dwellDistribution = dwellOrder
      .filter((bucket) => dwellBucketMap.has(bucket))
      .map((bucket) => ({ bucket, count: dwellBucketMap.get(bucket) || 0 }));
    const dropOffPages = Array.from(dropOffPageMap.entries())
      .map(([page, count]) => ({ page, count, rate: Number(((count / totalVisitorsForJourney) * 100).toFixed(1)) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
    const stageOrder = ['visit', 'chat', 'report', 'path', 'action'];
    const stageLabels: Record<string, string> = {
      visit: '访问页面',
      chat: '发起对话',
      report: '生成报告',
      path: '进入现实路径',
      action: '完成行动',
    };
    const stageFunnel = stageOrder.map((stage) => {
      const users = stageUserMap.get(stage)?.size || 0;
      return {
        stage: stageLabels[stage] || stage,
        users,
        rate: totalVisitorsForJourney > 0 ? Number(((users / totalVisitorsForJourney) * 100).toFixed(1)) : 0,
      };
    });
    const entryPages = Array.from(entryPageMap.entries())
      .map(([page, count]) => ({ page, count, rate: Number(((count / totalVisitorsForJourney) * 100).toFixed(1)) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
    const exitPages = Array.from(exitPageMap.entries())
      .map(([page, count]) => ({ page, count, rate: Number(((count / totalVisitorsForJourney) * 100).toFixed(1)) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
    const sortedTimes = timeToFirstActionMsList.slice().sort((a, b) => a - b);
    const medianMs = sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length / 2)] : 0;
    const timeBuckets = [
      { label: '<30秒', test: (ms: number) => ms < 30000 },
      { label: '30秒-2分钟', test: (ms: number) => ms >= 30000 && ms < 120000 },
      { label: '2-10分钟', test: (ms: number) => ms >= 120000 && ms < 600000 },
      { label: '10-30分钟', test: (ms: number) => ms >= 600000 && ms < 1800000 },
      { label: '30分钟+', test: (ms: number) => ms >= 1800000 },
    ];
    const timeBucketsResult = timeBuckets.map((bucket) => ({
      bucket: bucket.label,
      count: sortedTimes.filter(bucket.test).length,
    }));
    const journeyAggregates = {
      pageTransitions,
      dwellDistribution,
      dropOffPages,
      stageFunnel,
      entryPages,
      exitPages,
      timeToFirstAction: {
        buckets: timeBucketsResult,
        medianMs,
        sampleSize: sortedTimes.length,
      },
      visitorLifecycle: {
        newVisitors: journeyMap.size - repeatVisitors,
        returningVisitors: repeatVisitors,
        engagedVisitors: Array.from(journeyMap.values()).filter((item) => item.chatTurns > 0 || item.pathMessages > 0).length,
        convertedVisitors: Array.from(journeyMap.values()).filter((item) => item.reportsGenerated > 0 || item.actionsCompleted > 0).length,
      },
    };

    const messagesError = messagesResult.error;
    const messagesData = messagesResult.data;
    if (messagesError && !isSetupSchemaError(messagesError)) throw messagesError;

    const messages = (messagesError ? [] : messagesData || []) as MessageRow[];
    const anonymousMessages = events
      .filter((event) => event.event_name === 'anonymous_chat_message')
      .map((event) => ({
        user_id: typeof event.metadata?.anonymousVisitorId === 'string'
          ? `anonymous:${event.metadata.anonymousVisitorId}`
          : event.user_id,
        conversation_id: typeof event.metadata?.anonymousConversationId === 'string'
          ? `anon:${event.metadata.anonymousConversationId}`
          : typeof event.metadata?.batchId === 'string'
            ? `anon:${event.session_id || 'unknown'}:${event.metadata.batchId}`
            : event.session_id ? `anon:${event.session_id}` : null,
        role: typeof event.metadata?.role === 'string' ? event.metadata.role : null,
        content: typeof event.metadata?.content === 'string' ? event.metadata.content : null,
        created_at: event.created_at,
      })) as MessageRow[];
    const insightMessages = [...messages, ...anonymousMessages];
    const wordCount = new Map<string, number>();
    let userMessageCount = 0;
    let assistantMessageCount = 0;
    let userTextChars = 0;
    let assistantTextChars = 0;
    const conversationSet = new Set<string>();
    const messageUserSet = new Set<string>();
    const inputCategoryMap = new Map<string, number>();
    const inputSamples: Array<{ at: string | null; category: string; preview: string; chars: number }> = [];
    const dailyMessageMap = new Map<string, {
      totalMessages: number;
      userMessages: number;
      assistantMessages: number;
      userTextChars: number;
      assistantTextChars: number;
      conversations: Set<string>;
      users: Set<string>;
    }>();
    for (const m of insightMessages) {
      const d = m.created_at ? dayKey(m.created_at) : null;
      const dailyMessage = d ? dailyMessageMap.get(d) || {
        totalMessages: 0,
        userMessages: 0,
        assistantMessages: 0,
        userTextChars: 0,
        assistantTextChars: 0,
        conversations: new Set<string>(),
        users: new Set<string>(),
      } : null;
      if (m.conversation_id) conversationSet.add(m.conversation_id);
      if (m.user_id) messageUserSet.add(m.user_id);
      if (dailyMessage) {
        dailyMessage.totalMessages += 1;
        if (m.conversation_id) dailyMessage.conversations.add(m.conversation_id);
        if (m.user_id) dailyMessage.users.add(m.user_id);
      }
      const textLength = m.content?.length || 0;
      if (m.role === 'user') {
        userMessageCount += 1;
        userTextChars += textLength;
        const category = categorizeInput(m.content || '');
        addCount(inputCategoryMap, category);
        const preview = sanitizeInputPreview(m.content || '');
        if (preview && inputSamples.length < 12) {
          inputSamples.push({
            at: m.created_at,
            category,
            preview,
            chars: textLength,
          });
        }
        if (dailyMessage) {
          dailyMessage.userMessages += 1;
          dailyMessage.userTextChars += textLength;
        }
      }
      if (m.role === 'assistant') {
        assistantMessageCount += 1;
        assistantTextChars += textLength;
        if (dailyMessage) {
          dailyMessage.assistantMessages += 1;
          dailyMessage.assistantTextChars += textLength;
        }
      }
      if (d && dailyMessage) dailyMessageMap.set(d, dailyMessage);
      if (m.content && m.role === 'user') {
        for (const token of tokenize(m.content)) {
          wordCount.set(token, (wordCount.get(token) || 0) + 1);
        }
      }
    }
    const keywordCloud = Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 80)
      .map(([text, value]) => ({ text, value }));

    // AI Token 用量统计（已在上方并行查询）
    const aiUsage: AiUsageAdminStats | null = aiUsageResult;

    // 对话深度分析：按 conversation_id 聚合消息数，统计分布、首条意图、流失会话
    const conversationMessageMap = new Map<string, { messages: MessageRow[]; firstUserMessage: string | null }>();
    for (const m of insightMessages) {
      const cid = m.conversation_id || 'unknown';
      const entry = conversationMessageMap.get(cid) || { messages: [], firstUserMessage: null as string | null };
      entry.messages.push(m);
      if (entry.firstUserMessage === null && m.role === 'user' && m.content) {
        entry.firstUserMessage = m.content;
      }
      conversationMessageMap.set(cid, entry);
    }
    const totalConversations = conversationMessageMap.size;
    const depthBucketsMap = new Map<string, number>([
      ['仅1条消息', 0],
      ['2-3条', 0],
      ['4-6条', 0],
      ['7-10条', 0],
      ['11条以上', 0],
    ]);
    const firstIntentMap = new Map<string, number>();
    let dropOffConversations = 0;
    let singleMessageConversations = 0;
    let multiTurnConversations = 0;
    for (const entry of conversationMessageMap.values()) {
      const total = entry.messages.length;
      const userMsgs = entry.messages.filter((m) => m.role === 'user').length;
      const assistantMsgs = entry.messages.filter((m) => m.role === 'assistant').length;
      if (total <= 1) depthBucketsMap.set('仅1条消息', (depthBucketsMap.get('仅1条消息') || 0) + 1);
      else if (total <= 3) depthBucketsMap.set('2-3条', (depthBucketsMap.get('2-3条') || 0) + 1);
      else if (total <= 6) depthBucketsMap.set('4-6条', (depthBucketsMap.get('4-6条') || 0) + 1);
      else if (total <= 10) depthBucketsMap.set('7-10条', (depthBucketsMap.get('7-10条') || 0) + 1);
      else depthBucketsMap.set('11条以上', (depthBucketsMap.get('11条以上') || 0) + 1);
      if (total > 1) multiTurnConversations += 1;
      else singleMessageConversations += 1;
      // 流失会话：用户提问但 AI 未回复，或用户只发1条消息就离开
      if (userMsgs > 0 && assistantMsgs === 0) dropOffConversations += 1;
      else if (total === 1 && userMsgs === 1) dropOffConversations += 1;
      if (entry.firstUserMessage) {
        addCount(firstIntentMap, categorizeInput(entry.firstUserMessage));
      }
    }
    const conversationAnalysis = {
      depthBuckets: Array.from(depthBucketsMap.entries()).map(([bucket, count]) => ({
        bucket,
        count,
        rate: totalConversations > 0 ? Number(((count / totalConversations) * 100).toFixed(1)) : 0,
      })),
      firstIntentCategories: Array.from(firstIntentMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
      dropOffConversations,
      dropOffRate: totalConversations > 0 ? Number(((dropOffConversations / totalConversations) * 100).toFixed(1)) : 0,
      totalConversations,
      avgMessagesPerConversation: totalConversations > 0 ? Number((insightMessages.length / totalConversations).toFixed(1)) : 0,
      singleMessageConversations,
      multiTurnConversations,
    };

    return NextResponse.json({
      ok: true,
      range,
      siteScope,
      aiUsage,
      journeyAggregates,
      conversationAnalysis,
      dailyVisits,
      dailyRegistrations,
      dailyMetrics: Array.from(new Set([
        ...dailyVisits.map((item) => item.date),
        ...dailyRegistrations.map((item) => item.date),
        ...dailyAuthenticatedMap.keys(),
        ...dailyEngagementMap.keys(),
        ...dailyMessageMap.keys(),
      ]))
        .sort((a, b) => a.localeCompare(b))
        .map((date) => {
          const visit = dailyVisits.find((item) => item.date === date);
          const engagement = dailyEngagementMap.get(date);
          const message = dailyMessageMap.get(date);
          return {
            date,
            pv: visit?.count || 0,
            uv: visit?.visitors || 0,
            registrations: registrationMap.get(date) || 0,
            authenticatedVisitors: dailyAuthenticatedMap.get(date)?.size || 0,
            avgEngagementMs: engagement && engagement.count > 0
              ? Math.round(engagement.totalDurationMs / engagement.count)
              : 0,
            totalMessages: message?.totalMessages || 0,
            userMessages: message?.userMessages || 0,
            assistantMessages: message?.assistantMessages || 0,
            conversations: message?.conversations.size || 0,
            activeChatUsers: message?.users.size || 0,
            userTextChars: message?.userTextChars || 0,
            assistantTextChars: message?.assistantTextChars || 0,
            totalTextChars: (message?.userTextChars || 0) + (message?.assistantTextChars || 0),
          };
        }),
      pageStats,
      recentVisitors,
      userJourneys,
      sourceStats: mapToRank(sourceMap),
      cityStats: mapToRank(cityMap),
      featureStats: mapToRank(featureMap),
      eventStats: mapToRank(eventNameMap),
      funnel,
      keywordCloud,
      inputInsights: {
        categories: mapToRank(inputCategoryMap, 12),
        samples: inputSamples,
        averages: {
          userMessageChars: userMessageCount > 0 ? Math.round(userTextChars / userMessageCount) : 0,
          messagesPerConversation: conversationSet.size > 0 ? Number((insightMessages.length / conversationSet.size).toFixed(1)) : 0,
          userMessagesPerActiveUser: messageUserSet.size > 0 ? Number((userMessageCount / messageUserSet.size).toFixed(1)) : 0,
        },
      },
      conversationStats: {
        totalMessages: insightMessages.length,
        userMessageCount,
        assistantMessageCount,
        userTextChars,
        assistantTextChars,
        totalTextChars: userTextChars + assistantTextChars,
        conversations: conversationSet.size,
        activeChatUsers: messageUserSet.size + new Set(anonymousMessages.map((m) => m.conversation_id).filter(Boolean)).size,
        avgUserMessageChars: userMessageCount > 0 ? Math.round(userTextChars / userMessageCount) : 0,
      },
      setupWarnings: [
        eventsError ? 'analytics_events 表还没有创建，访问、来源、城市、停留时间等数据暂时为空。' : null,
        profilesError ? 'user_profiles 表暂时不可用，注册人数暂时为空。' : null,
        messagesError ? 'messages 表暂时不可用，对话统计暂时为空。' : null,
      ].filter(Boolean),
      totals: {
        events: events.length,
        messages: insightMessages.length,
        registrations: profiles.length,
        uniqueVisitors,
        authenticatedVisitors,
        avgEngagementMs,
        avgEngagementLabel: formatDuration(avgEngagementMs),
      },
      retention: {
        visitors: uniqueVisitors,
        repeatVisitors,
        repeatVisitorRate: uniqueVisitors > 0 ? Number(((repeatVisitors / uniqueVisitors) * 100).toFixed(1)) : 0,
        repeatMeaningfulUsers,
        repeatMeaningfulRate: uniqueVisitors > 0 ? Number(((repeatMeaningfulUsers / uniqueVisitors) * 100).toFixed(1)) : 0,
        activeDayBuckets,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load admin insights';
    const status = /forbidden|authorization|token/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
