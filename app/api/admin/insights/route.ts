import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { isAllowedOrigin } from '@/lib/request-security';

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
  return event.user_id || event.session_id || null;
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

    const { data: eventsData, error: eventsError } = await supabaseAdmin
      .from('analytics_events')
      .select('event_name, page, step, status, session_id, user_id, metadata, user_agent, created_at')
      .gte('created_at', range.since)
      .lte('created_at', range.until)
      .order('created_at', { ascending: false })
      .limit(20000);
    if (eventsError && !isSetupSchemaError(eventsError)) throw eventsError;

    const allEvents = (eventsError ? [] : eventsData || []) as EventRow[];
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

    for (const e of events) {
      if (!e.created_at) continue;
      const d = dayKey(e.created_at);
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

    const { data: profilesData, error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, created_at')
      .gte('created_at', range.since)
      .lte('created_at', range.until)
      .order('created_at', { ascending: false })
      .limit(5000);
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

    const { data: messagesData, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('id, user_id, conversation_id, role, content, created_at')
      .gte('created_at', range.since)
      .lte('created_at', range.until)
      .order('created_at', { ascending: false })
      .limit(10000);
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

    return NextResponse.json({
      ok: true,
      range,
      siteScope,
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load admin insights';
    const status = /forbidden|authorization|token/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
