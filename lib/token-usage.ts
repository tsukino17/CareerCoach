import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getClientIp } from '@/lib/rate-limit';

// AI 用量统计：每次模型调用后记录 token 消耗。
// 写入与查询都走 service role，绝不向下暴露；记录失败不影响主流程。

export type AiUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

type UsageEventRow = {
  user_id: string | null;
  anonymous_ip: string | null;
  route: string;
  model: string;
  provider: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

let adminClient: SupabaseClient | null = null;

function getAdmin(): SupabaseClient | null {
  if (adminClient) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as SupabaseClient;
  return adminClient;
}

// 从 Authorization: Bearer <token> 解析并校验用户身份，匿名返回 null
export async function resolveUsageUser(req: Request): Promise<string | null> {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const token = header.replace('Bearer ', '').trim();
  if (!token) return null;
  const admin = getAdmin();
  if (!admin) return null;
  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

// 记录一次模型调用。任何失败都静默吞掉，不影响对话主流程。
export async function recordAiUsage(options: {
  req: Request;
  route: string;
  model: string;
  provider?: string;
  usage?: AiUsage;
}): Promise<void> {
  try {
    const admin = getAdmin();
    if (!admin) return;
    const usage = options.usage || {};
    const promptTokens = Math.max(0, Math.round(usage.promptTokens || 0));
    const completionTokens = Math.max(0, Math.round(usage.completionTokens || 0));
    const totalTokens =
      Math.max(0, Math.round(usage.totalTokens || 0)) || promptTokens + completionTokens;
    if (totalTokens <= 0) return;

    const userId = await resolveUsageUser(options.req);
    const row: UsageEventRow = {
      user_id: userId,
      anonymous_ip: userId ? null : getClientIp(options.req),
      route: options.route,
      model: options.model,
      provider: options.provider || 'tokendance',
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
    };
    const { error } = await admin.from('ai_usage_events').insert(row);
    if (error) console.warn('[usage] record failed', error.message);
  } catch (error) {
    console.warn('[usage] record error', error);
  }
}

export type AiUsageSummary = {
  authenticated: boolean;
  monthTokens: number;
  monthCalls: number;
  totalTokens: number;
  totalCalls: number;
  monthByRoute: Array<{ route: string; totalTokens: number; calls: number }>;
};

// 查询某用户的用量汇总（本月 + 累计 + 本月分路由），供个人中心展示
export async function getAiUsageSummary(userId: string): Promise<AiUsageSummary> {
  const admin = getAdmin();
  if (!admin) throw new Error('Supabase admin not configured');

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [monthResult, allResult] = await Promise.all([
    admin
      .from('ai_usage_events')
      .select('route,total_tokens')
      .eq('user_id', userId)
      .gte('created_at', monthStart.toISOString()),
    admin.from('ai_usage_events').select('total_tokens').eq('user_id', userId),
  ]);
  if (monthResult.error) throw new Error(monthResult.error.message);
  if (allResult.error) throw new Error(allResult.error.message);

  const monthRows = (monthResult.data || []) as Array<{ route: string; total_tokens: number }>;
  const allRows = (allResult.data || []) as Array<{ total_tokens: number }>;

  const byRoute = new Map<string, { totalTokens: number; calls: number }>();
  let monthTokens = 0;
  for (const row of monthRows) {
    const tokens = row.total_tokens || 0;
    monthTokens += tokens;
    const current = byRoute.get(row.route) || { totalTokens: 0, calls: 0 };
    byRoute.set(row.route, { totalTokens: current.totalTokens + tokens, calls: current.calls + 1 });
  }

  return {
    authenticated: true,
    monthTokens,
    monthCalls: monthRows.length,
    totalTokens: allRows.reduce((sum, row) => sum + (row.total_tokens || 0), 0),
    totalCalls: allRows.length,
    monthByRoute: [...byRoute.entries()]
      .map(([route, value]) => ({ route, ...value }))
      .sort((a, b) => b.totalTokens - a.totalTokens),
  };
}

export type AiUsageAdminStats = {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCalls: number;
  avgTokensPerCall: number;
  uniqueUsers: number;
  avgTokensPerUser: number;
  byRoute: Array<{ route: string; tokens: number; calls: number; promptTokens: number; completionTokens: number }>;
  byUser: Array<{ userKey: string; tokens: number; calls: number }>;
  byDay: Array<{ date: string; tokens: number; calls: number }>;
  byModel: Array<{ model: string; tokens: number; calls: number }>;
};

// 管理端用量统计：按日期范围查询全量 AI 调用数据
export async function getAiUsageAdminStats(since: string, until: string): Promise<AiUsageAdminStats> {
  const admin = getAdmin();
  if (!admin) throw new Error('Supabase admin not configured');

  const { data, error } = await admin
    .from('ai_usage_events')
    .select('user_id, anonymous_ip, route, model, prompt_tokens, completion_tokens, total_tokens, created_at')
    .gte('created_at', since)
    .lte('created_at', until)
    .order('created_at', { ascending: false })
    .limit(20000);

  if (error) {
    if (/42P01|could not find the table|does not exist/i.test(error.message)) {
      return { totalTokens: 0, promptTokens: 0, completionTokens: 0, totalCalls: 0, avgTokensPerCall: 0, uniqueUsers: 0, avgTokensPerUser: 0, byRoute: [], byUser: [], byDay: [], byModel: [] };
    }
    throw new Error(error.message);
  }

  const rows = (data || []) as Array<{
    user_id: string | null;
    anonymous_ip: string | null;
    route: string;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    created_at: string | null;
  }>;

  let totalTokens = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  const routeMap = new Map<string, { tokens: number; calls: number; promptTokens: number; completionTokens: number }>();
  const userMap = new Map<string, { tokens: number; calls: number }>();
  const dayMap = new Map<string, { tokens: number; calls: number }>();
  const modelMap = new Map<string, { tokens: number; calls: number }>();
  const userSet = new Set<string>();

  for (const row of rows) {
    const t = row.total_tokens || 0;
    const pt = row.prompt_tokens || 0;
    const ct = row.completion_tokens || 0;
    totalTokens += t;
    promptTokens += pt;
    completionTokens += ct;

    const route = row.route || 'unknown';
    const routeEntry = routeMap.get(route) || { tokens: 0, calls: 0, promptTokens: 0, completionTokens: 0 };
    routeEntry.tokens += t;
    routeEntry.calls += 1;
    routeEntry.promptTokens += pt;
    routeEntry.completionTokens += ct;
    routeMap.set(route, routeEntry);

    const userKey = row.user_id ? `user:${row.user_id.slice(0, 8)}` : row.anonymous_ip ? `ip:${row.anonymous_ip.slice(-8)}` : 'anonymous';
    userSet.add(userKey);
    const userEntry = userMap.get(userKey) || { tokens: 0, calls: 0 };
    userEntry.tokens += t;
    userEntry.calls += 1;
    userMap.set(userKey, userEntry);

    if (row.created_at) {
      const day = row.created_at.slice(0, 10);
      const dayEntry = dayMap.get(day) || { tokens: 0, calls: 0 };
      dayEntry.tokens += t;
      dayEntry.calls += 1;
      dayMap.set(day, dayEntry);
    }

    const model = row.model || 'unknown';
    const modelEntry = modelMap.get(model) || { tokens: 0, calls: 0 };
    modelEntry.tokens += t;
    modelEntry.calls += 1;
    modelMap.set(model, modelEntry);
  }

  const uniqueUsers = userSet.size;

  return {
    totalTokens,
    promptTokens,
    completionTokens,
    totalCalls: rows.length,
    avgTokensPerCall: rows.length > 0 ? Math.round(totalTokens / rows.length) : 0,
    uniqueUsers,
    avgTokensPerUser: uniqueUsers > 0 ? Math.round(totalTokens / uniqueUsers) : 0,
    byRoute: [...routeMap.entries()]
      .map(([route, v]) => ({ route, ...v }))
      .sort((a, b) => b.tokens - a.tokens),
    byUser: [...userMap.entries()]
      .map(([userKey, v]) => ({ userKey, ...v }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 10),
    byDay: [...dayMap.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byModel: [...modelMap.entries()]
      .map(([model, v]) => ({ model, ...v }))
      .sort((a, b) => b.tokens - a.tokens),
  };
}
