import type { SupabaseClient } from '@supabase/supabase-js';

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

function dayKey(iso: string) { return iso.slice(0, 10); }
function countBy(values: string[]) {
  const map = new Map<string, number>();
  for (const value of values) map.set(value, (map.get(value) || 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, count]) => ({ name, count }));
}
function numberValue(value: unknown) {
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : 0;
}
function formatDuration(ms: number) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  return `${Math.floor(seconds / 60)}分${seconds % 60 ? `${seconds % 60}秒` : ''}`;
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

export async function buildWeeklyReport(supabase: SupabaseClient, now = new Date()) {
  return buildPeriodicReport(supabase, now, 'weekly');
}

export async function buildMonthlyReport(supabase: SupabaseClient, now = new Date()) {
  return buildPeriodicReport(supabase, now, 'monthly');
}

async function buildPeriodicReport(supabase: SupabaseClient, now: Date, cadence: 'weekly' | 'monthly') {
  const timezoneOffsetMs = 8 * 60 * 60 * 1000;
  const beijingNow = new Date(now.getTime() + timezoneOffsetMs);
  const until = new Date(beijingNow);
  until.setUTCHours(23, 59, 59, 999);
  const since = new Date(beijingNow);
  if (cadence === 'monthly') {
    until.setUTCDate(0);
    until.setUTCHours(23, 59, 59, 999);
    since.setUTCDate(1);
    since.setUTCMonth(since.getUTCMonth() - 1);
    since.setUTCHours(0, 0, 0, 0);
  } else {
    const daysSinceMonday = (beijingNow.getUTCDay() + 6) % 7;
    since.setUTCDate(since.getUTCDate() - daysSinceMonday - 7);
    since.setUTCHours(0, 0, 0, 0);
    until.setUTCDate(until.getUTCDate() - daysSinceMonday - 1);
    until.setUTCHours(23, 59, 59, 999);
  }
  const start = since.toISOString();
  const end = until.toISOString();
  const period = { start: since.toISOString().slice(0, 10), end: until.toISOString().slice(0, 10) };

  const [{ data: eventData, error: eventError }, { data: profileData, error: profileError }, { data: messageData, error: messageError }] = await Promise.all([
    supabase.from('analytics_events').select('event_name,page,step,status,session_id,user_id,metadata,user_agent,created_at').gte('created_at', start).lte('created_at', end).limit(50000),
    supabase.from('user_profiles').select('created_at').gte('created_at', start).lte('created_at', end).limit(10000),
    supabase.from('messages').select('conversation_id,role,created_at').gte('created_at', start).lte('created_at', end).limit(30000),
  ]);
  if (eventError) throw eventError;
  const events = ((eventData || []) as EventRow[]).filter(isProduction);
  const profiles = (profileData || []) as ProfileRow[];
  const messages = (messageData || []) as MessageRow[];
  const [{ data: allProfilesData, error: allProfilesError }, { data: authUsersData, error: authUsersError }] = await Promise.all([
    supabase.from('user_profiles').select('user_id').limit(10000),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const allProfiles = (allProfilesData || []) as Array<{ user_id: string }>;
  const authUsers = authUsersData?.users || [];
  const pageViews = events.filter((event) => event.event_name === 'page_view');
  const engagements = events.filter((event) => event.event_name === 'page_engagement');
  const anonymousMessages = events.filter((event) => event.event_name === 'anonymous_chat_message');
  const daily = new Map<string, { pv: number; visitors: Set<string> }>();
  for (const event of pageViews) {
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
  for (const event of pageViews) {
    const page = event.page || 'unknown';
    const item = pageMap.get(page) || { views: 0, visitors: new Set<string>() };
    item.views += 1;
    const visitor = event.user_id || event.session_id;
    if (visitor) item.visitors.add(visitor);
    pageMap.set(page, item);
  }
  const duration = engagements.reduce((sum, event) => sum + numberValue(event.metadata?.durationMs), 0);
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
  const cityStats = countBy(pageViews.map((event) => typeof event.metadata?.city === 'string' && event.metadata.city.trim() ? event.metadata.city : '未知城市'));
  const browserStats = countBy(pageViews.map((event) => classifyBrowser(event.user_agent || '')));
  const deviceStats = countBy(pageViews.map((event) => classifyDevice(event.user_agent || '')));
  const deviceModelStats = countBy(pageViews.map((event) => classifyDeviceModel(event.user_agent || '')));
  const operatingSystemStats = countBy(pageViews.map((event) => classifyOperatingSystem(event.user_agent || '')));
  const visitorDays = new Map<string, Set<string>>();
  for (const event of pageViews) {
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
  const report = {
    period,
    totals: {
      pv: pageViews.length,
      uv: new Set(pageViews.map((event) => event.user_id || event.session_id).filter(Boolean)).size,
      registrations: profiles.length,
      registeredUsers: authUsers.length,
      verifiedUsers: authUsers.filter((user) => Boolean(user.email_confirmed_at)).length,
      initializedUsers: allProfiles.length,
      engagedPages: engagements.length,
      avgEngagement: engagements.length ? formatDuration(duration / engagements.length) : '0秒',
      messages: messages.length + anonymousMessages.length,
      userMessages: userMessages + anonymousUserMessages,
      assistantMessages: messages.filter((message) => message.role === 'assistant').length + anonymousAssistantMessages,
      conversations: new Set([...messages.map((message) => message.conversation_id), ...anonymousConversations].filter(Boolean)).size,
    },
    daily: [...daily.entries()].sort().map(([date, item]) => ({ date, pv: item.pv, uv: item.visitors.size })),
    topPages: [...pageMap.entries()].sort((a, b) => b[1].views - a[1].views).slice(0, 10).map(([page, item]) => ({ page, views: item.views, visitors: item.visitors.size })),
    funnel: [...funnelStarts.entries()].map(([step, starts]) => ({ step, starts, drops: funnelDrops.get(step) || 0, dropRate: starts ? Math.round(((funnelDrops.get(step) || 0) / starts) * 100) : 0 })),
    events: countBy(events.map((event) => event.event_name || 'unknown')),
    sources: countBy(pageViews.map((event) => typeof event.metadata?.trafficSource === 'string' ? event.metadata.trafficSource : 'direct')),
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
    setupWarnings: [profileError && 'user_profiles 查询失败，新增注册数可能不完整。', allProfilesError && 'user_profiles 总数查询失败。', authUsersError && '认证用户查询失败，总注册数可能不完整。', messageError && 'messages 查询失败，对话数可能不完整。'].filter(Boolean),
  };
  return report;
}

export function renderWeeklyReportText(report: Awaited<ReturnType<typeof buildWeeklyReport>>, title = '网站周报') {
  const { period, totals } = report;
  return [
    `EchoTalent ${title}（${period.start} 至 ${period.end}）`,
    '',
    `访问：PV ${totals.pv}，UV ${totals.uv}，平均有效停留 ${totals.avgEngagement}`,
    `用户：注册账号 ${totals.registeredUsers}，已验证 ${totals.verifiedUsers}，已初始化资料 ${totals.initializedUsers}（本周新增 ${totals.registrations}）`,
    `使用：对话 ${totals.conversations}，用户消息 ${totals.userMessages}`,
    '',
    '每日访问：',
    ...report.daily.map((item) => `- ${item.date}: PV ${item.pv} / UV ${item.uv}`),
    '',
    '访问最多页面：',
    ...report.topPages.map((item) => `- ${item.page}: ${item.views} 次 / ${item.visitors} 人`),
    '',
    '漏斗：',
    ...(report.funnel.length ? report.funnel.map((item) => `- ${item.step}: 开始 ${item.starts}，流失 ${item.drops}（${item.dropRate}%）`) : ['- 本周期没有记录到 flow_step']),
    '',
    `事件：${report.events.map((item) => `${item.name} ${item.count}`).join('，') || '无'}`,
    `来源：${report.sources.map((item) => `${item.name} ${item.count}`).join('，') || '无'}`,
    `城市：${report.cities.map((item) => `${item.name} ${item.count}`).join('，') || '无'}`,
    `设备：${report.devices.map((item) => `${item.name} ${item.count}`).join('，') || '无'}`,
    `设备型号：${report.deviceModels.map((item) => `${item.name} ${item.count}`).join('，') || '无'}`,
    `操作系统：${report.operatingSystems.map((item) => `${item.name} ${item.count}`).join('，') || '无'}`,
    `浏览器：${report.browsers.map((item) => `${item.name} ${item.count}`).join('，') || '无'}`,
    `粘性：回访用户 ${report.retention.repeatVisitors}/${report.retention.visitors}（${report.retention.repeatVisitorRate}%），重复有效使用 ${report.retention.repeatMeaningfulUsers} 人（${report.retention.repeatMeaningfulRate}%）`,
    `活跃天数：${Object.entries(report.retention.activeDayBuckets).map(([name, count]) => `${name} ${count}`).join('，')}`,
    '',
    '指标说明：',
    '- PV（Page View）：页面被打开或切换显示的总次数，同一个人多次访问会重复计算。',
    '- UV（Unique Visitor）：周期内去重后的访客数，优先按登录用户或匿名会话识别。',
    '- page_view：页面打开/路由进入事件，用于统计访问量和访问页面。',
    '- page_engagement：用户离开页面、切换路由或页面隐藏时上报的停留与滚动事件，用于估算有效停留。',
    '- 对话：同时统计登录用户 messages 表，以及匿名用户的 anonymous_chat_message 埋点。',
    '- 城市、设备和浏览器：根据访问请求的地理标记与 User-Agent 聚合，IP 不直接写入周报。',
    ...(report.setupWarnings.length ? ['', `提示：${report.setupWarnings.join(' ')}`] : []),
  ].join('\n');
}

export function renderWeeklyReportHtml(report: Awaited<ReturnType<typeof buildWeeklyReport>>, title = '网站周报') {
  const text = renderWeeklyReportText(report, title);
  return `<div style="font-family:Arial,sans-serif;white-space:pre-line;color:#172033"><h2>EchoTalent ${title}</h2><p>${text.replace(/\n/g, '<br>')}</p></div>`;
}
