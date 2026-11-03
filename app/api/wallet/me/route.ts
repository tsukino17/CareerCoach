// [RESERVED:payment] 钱包余额接口：用户中心余额展示在用（共享点），最近订单随充值功能一并预留
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getOrCreateWallet, getUserPaymentRequests } from '@/lib/payment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create wallet (auto-create with free quota on first access)
    const wallet = await getOrCreateWallet(user.id);
    const orders = await getUserPaymentRequests(user.id, 5).catch(() => []);

    return NextResponse.json({
      balance: wallet.balance,
      totalRecharged: wallet.total_recharged,
      totalConsumed: wallet.total_consumed,
      isPaidUser: wallet.total_recharged > 0,
      recentOrders: orders.map((order) => ({
        id: order.id,
        packageType: order.package_type,
        tokens: order.tokens,
        amountCny: order.amount_cny,
        status: order.activated_at ? 'activated' : order.status,
        createdAt: order.created_at,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch wallet' },
      { status: 500 }
    );
  }
}
