import { NextResponse } from 'next/server';
import { resolveUsageUser, getAiUsageSummary } from '@/lib/token-usage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 个人中心用量查询：需要携带登录态（Authorization: Bearer <supabase access_token>）
export async function GET(req: Request) {
  try {
    const userId = await resolveUsageUser(req);
    if (!userId) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    const summary = await getAiUsageSummary(userId);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('[usage/me] failed', error);
    return NextResponse.json({ error: 'usage_summary_unavailable' }, { status: 500 });
  }
}
