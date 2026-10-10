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
