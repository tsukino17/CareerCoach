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

  // All-time unique visitors: distinct user_id + anonymousVisitorId + session_id
  const { data: allTimeVisitorsData, error: allTimeVisitorsError } = await supabase
    .from('analytics_events')
    .select('user_id,session_id,metadata')
    .limit(100000);
  let totalVisitors = 0;
  if (!allTimeVisitorsError && allTimeVisitorsData) {
    const visitorSet = new Set<string>();
    for (const row of allTimeVisitorsData as Array<{ user_id: string | null; session_id: string | null; metadata: Record<string, unknown> | null }>) {
      const key = row.user_id || (typeof row.metadata?.anonymousVisitorId === 'string' ? row.metadata.anonymousVisitorId : null) || row.session_id;
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
    const page = event.page || 'unknown';
    const item = pageMap.get(page) || { views: 0, visitors: new Set<string>() };
    item.views += 1;
    const visitor = event.user_id || event.session_id;
    if (visitor) item.visitors.add(visitor);
    pageMap.set(page, item);
  }
  const duration = humanEngagements.reduce((sum, event) => sum + numberValue(event.metadata?.durationMs), 0);
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
  const cityStats = countBy(humanPageViews.map((event) => typeof event.metadata?.city === 'string' && event.metadata.city.trim() ? event.metadata.city : '未知城市'));
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
  const report = {
    period,
    totals: {
      pv: humanPageViews.length,
      uv: new Set(humanPageViews.map((event) => event.user_id || event.session_id).filter(Boolean)).size,
      registrations: profiles.length,
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
    daily: [...daily.entries()].sort().map(([date, item]) => ({ date, pv: item.pv, uv: item.visitors.size })),
    topPages: [...pageMap.entries()].sort((a, b) => b[1].views - a[1].views).slice(0, 10).map(([page, item]) => ({ page, views: item.views, visitors: item.visitors.size })),
    funnel: [...funnelStarts.entries()].map(([step, starts]) => ({ step, starts, drops: funnelDrops.get(step) || 0, dropRate: starts ? Math.round(((funnelDrops.get(step) || 0) / starts) * 100) : 0 })),
    events: countBy(events.map((event) => event.event_name || 'unknown')),
    sources: countBy(humanPageViews.map((event) => typeof event.metadata?.trafficSource === 'string' && event.metadata.trafficSource.trim() ? event.metadata.trafficSource : 'direct')),
    channels: countBy(humanPageViews.map((event) => typeof event.metadata?.trafficMedium === 'string' && event.metadata.trafficMedium.trim() ? event.metadata.trafficMedium : 'direct')),
    campaigns: countBy(humanPageViews.map((event) => typeof event.metadata?.trafficCampaign === 'string' && event.metadata.trafficCampaign.trim() ? event.metadata.trafficCampaign : '无')),
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
    setupWarnings: [profileError && 'user_profiles 查询失败，新增注册数可能不完整。', allProfilesError && 'user_profiles 总数查询失败。', authUsersError && '认证用户查询失败，总注册数可能不完整。', messageError && 'messages 查询失败，对话数可能不完整。', allTimeVisitorsError && 'analytics_events 历史查询失败，总访客数可能不完整。'].filter(Boolean),
  };
  return report;
}

type WeeklyReport = Awaited<ReturnType<typeof buildWeeklyReport>>;

function escHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string
  ));
}

function buildInsights(report: WeeklyReport): string[] {
  const { totals, daily, topPages, retention, sources, cities, bots } = report;
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
    insights.push(`地域分布以「${cities[0].name}」领先（${cities[0].count} 次），可用于判断内容与目标人群的匹配度。`);
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

function renderDataTable(headers: string[], rows: Array<Array<string | number>>): string {
  const thead = `<tr>${headers.map((header) => `<th style="padding:8px 10px;text-align:left;font-size:12px;color:#64748b;font-weight:600;border-bottom:1px solid #e5e9f2;">${escHtml(header)}</th>`).join('')}</tr>`;
  const tbody = rows.map((row) => `<tr>${row.map((cell, index) => `<td style="padding:7px 10px;font-size:13px;color:#172033;border-bottom:1px solid #f1f5f9;${index === 0 ? '' : 'text-align:left;'}">${escHtml(cell)}</td>`).join('')}</tr>`).join('');
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
}

function statToRows(stats: Array<{ name: string; count: number }>): Array<Array<string | number>> {
  return stats.map((item) => [item.name, item.count]);
}

export function renderWeeklyReportText(report: Awaited<ReturnType<typeof buildWeeklyReport>>, title = '网站周报') {
  const { period, totals } = report;
  const insights = buildInsights(report);
  return [
    `EchoTalent ${title}（${period.start} 至 ${period.end}）`,
    '',
    '运营洞察：',
    ...insights.map((item) => `- ${item}`),
    '',
    `访问：PV ${totals.pv}，UV ${totals.uv}，平均有效停留 ${totals.avgEngagement}`,
    `爬虫：${report.bots.pv} 次访问 / ${report.bots.uv} 访客（${report.bots.types.map((item) => `${item.name} ${item.count}`).join('，') || '无'}）`,
    `用户：注册账号 ${totals.registeredUsers}，已验证 ${totals.verifiedUsers}，已初始化资料 ${totals.initializedUsers}（本周新增 ${totals.registrations}）`,
    `全部：历史累计访客 ${totals.totalVisitors} 人，累计注册 ${totals.registeredUsers} 人`,
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
    `渠道：${report.channels.map((item) => `${item.name} ${item.count}`).join('，') || '无'}`,
    `活动：${report.campaigns.map((item) => `${item.name} ${item.count}`).join('，') || '无'}`,
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

export function renderWeeklyReportHtml(report: WeeklyReport, title = '网站周报') {
  const { period, totals, daily, topPages, funnel, events, sources, channels, campaigns, cities, browsers, devices, deviceModels, operatingSystems, retention, bots, setupWarnings } = report;
  const insights = buildInsights(report);
  const perCapita = totals.uv ? (totals.pv / totals.uv).toFixed(1) : '—';

  const section = (heading: string, body: string) => `
    <div style="margin:0 0 20px;background:#ffffff;border:1px solid #e8eefb;border-radius:14px;padding:20px;">
      <div style="font-size:15px;font-weight:700;color:#0f172a;margin-bottom:14px;">${heading}</div>
      ${body}
    </div>`;

  const kpiCell = (value: string, label: string) => `
    <td style="width:25%;padding:12px 6px;text-align:center;background:#ffffff;border:1px solid #e8eefb;border-radius:12px;">
      <div style="font-size:22px;font-weight:800;color:#ff8a4c;line-height:1.2;">${value}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px;">${label}</div>
    </td>`;

  const kpiPrimary = [kpiCell(String(totals.pv), '总访问 PV'), kpiCell(String(totals.uv), '访客 UV'), kpiCell(String(totals.totalVisitors), '历史累计访客'), kpiCell(String(totals.registeredUsers), '累计注册')].join('');
  const kpiSecondary = [kpiCell(String(totals.registrations), '本周新增注册'), kpiCell(perCapita, '人均浏览页数'), kpiCell(totals.avgEngagement, '平均有效停留'), kpiCell(`${retention.repeatVisitorRate}%`, '回访率')].join('');

  const insightList = `<ul style="margin:0;padding-left:18px;color:#334155;font-size:13px;line-height:1.8;">${insights.map((item) => `<li style="margin-bottom:6px;">${escHtml(item)}</li>`).join('')}</ul>`;

  const legend = `
    <div style="margin-bottom:8px;font-size:12px;color:#64748b;">
      <span style="display:inline-block;margin-right:14px;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ff8a4c;margin-right:4px;"></span>PV（访问量）</span>
      <span style="display:inline-block;"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#3b82f6;margin-right:4px;"></span>UV（访客数）</span>
    </div>`;

  const trendSection = section('每日访问趋势', `${legend}${renderTrendSvg(daily)}${renderDataTable(['日期', 'PV', 'UV'], daily.map((item) => [item.date, item.pv, item.uv]))}`);

  const pagesSection = section('访问页面排名', renderDataTable(['页面', '访问次数', '访客数'], topPages.map((item) => [item.page, item.views, item.visitors])));

  const funnelSection = section('转化漏斗', funnel.length
    ? renderDataTable(['步骤', '开始', '流失', '流失率'], funnel.map((item) => [item.step, item.starts, item.drops, `${item.dropRate}%`]))
    : '<p style="margin:0;color:#64748b;font-size:13px;">本周期没有记录到 flow_step。</p>');

  const eventsSection = section('事件分布', renderDataTable(['事件', '次数'], statToRows(events)));
  const sourcesSection = section('流量来源', renderDataTable(['来源', '次数'], statToRows(sources)));
  const channelsSection = section('渠道类型', renderDataTable(['渠道', '次数'], statToRows(channels)));
  const campaignsSection = section('营销活动', renderDataTable(['活动', '次数'], statToRows(campaigns)));
  const botsSection = section('爬虫访问（已剔除）', renderDataTable(['爬虫类型', '次数'], statToRows(bots.types)));

  const citiesSection = section('访问城市', renderDataTable(['城市', '次数'], statToRows(cities)));
  const devicesSection = section('设备类别', renderDataTable(['设备', '次数'], statToRows(devices)));
  const modelsSection = section('设备型号', renderDataTable(['型号', '次数'], statToRows(deviceModels)));
  const osSection = section('操作系统', renderDataTable(['系统', '次数'], statToRows(operatingSystems)));
  const browsersSection = section('浏览器', renderDataTable(['浏览器', '次数'], statToRows(browsers)));

  const retentionSection = section('粘性与活跃', `${renderDataTable(['指标', '数值'], [
    ['访客数', retention.visitors],
    ['回访用户', retention.repeatVisitors],
    ['回访率', `${retention.repeatVisitorRate}%`],
    ['重复有效使用', retention.repeatMeaningfulUsers],
    ['重复有效使用率', `${retention.repeatMeaningfulRate}%`],
  ])}${renderDataTable(['活跃天数', '人数'], Object.entries(retention.activeDayBuckets).map(([name, count]) => [name, count]))}`);

  const warningText = setupWarnings.length ? `<p style="margin:0 0 20px;padding:12px;background:#fff7ed;border:1px solid #fdba74;border-radius:10px;color:#9a3412;font-size:12px;">${setupWarnings.map(escHtml).join('<br>')}</p>` : '';

  const footer = `
    <div style="color:#94a3b8;font-size:11px;line-height:1.7;">
      <div style="font-weight:700;color:#64748b;margin-bottom:4px;">指标说明</div>
      <div>PV：页面打开或切换显示的总次数，同一访客多次访问重复计算。</div>
      <div>UV：周期内去重后的访客数，优先按登录用户或匿名会话识别。</div>
      <div>page_view：页面打开/路由进入事件；page_engagement：离开页面或隐藏时上报的停留与滚动事件。</div>
      <div>对话：同时统计登录用户 messages 表与匿名用户 anonymous_chat_message 埋点。</div>
      <div>城市/设备/浏览器：按请求地理标记与 User-Agent 聚合，IP 不写入周报。</div>
    </div>`;

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;background:#f5f8ff;padding:24px 12px;">
    <div style="max-width:680px;margin:0 auto;">
      <div style="margin-bottom:20px;">
        <div style="font-size:13px;letter-spacing:.08em;color:#6b7280;text-transform:uppercase;">EchoTalent 天赋探索</div>
        <h2 style="margin:6px 0 4px;font-size:24px;color:#0f172a;">EchoTalent ${escHtml(title)}</h2>
        <div style="font-size:13px;color:#64748b;">${escHtml(period.start)} 至 ${escHtml(period.end)}</div>
      </div>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:8px;margin-bottom:12px;"><tr>${kpiPrimary}</tr></table>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:8px;margin-bottom:20px;"><tr>${kpiSecondary}</tr></table>

      ${section('运营洞察', insightList)}
      ${warningText}
      ${trendSection}
      ${pagesSection}
      ${funnelSection}
      ${eventsSection}
      ${sourcesSection}
      ${channelsSection}
      ${campaignsSection}
      ${botsSection}
      ${citiesSection}
      ${devicesSection}
      ${modelsSection}
      ${osSection}
      ${browsersSection}
      ${retentionSection}
      ${footer}
    </div>
  </div>`;
}
