// [RESERVED:payment] 充值/退款核心逻辑（钱包、订单、退款、管理员调账）。整体可摘除，详见 docs/payment-reserved.md
import { getSupabaseAdminClient } from './admin-auth';

// ─── Types ───────────────────────────────────────────────────────────────────

export type Wallet = {
  user_id: string;
  balance: number;
  total_recharged: number;
  total_consumed: number;
  is_paid_user: boolean;
  created_at: string;
  updated_at: string;
};

export type PaymentRequest = {
  id: string;
  email: string;
  user_id: string | null;
  package_type: 'starter' | 'weekly' | 'monthly';
  tokens: number;
  amount_cny: number;
  wechat_note: string | null;
  screenshot_url: string | null;
  status: 'pending' | 'confirmed' | 'activated' | 'rejected' | 'suspicious';
  confirmed_at: string | null;
  activated_at: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

export type RefundRequest = {
  id: string;
  email: string;
  user_id: string | null;
  original_payment_id: string | null;
  amount_cny: number;
  reason: string;
  payment_screenshot_url: string | null;
  refund_screenshot_url: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  admin_note: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PackageType = 'starter' | 'weekly' | 'monthly';

export const PACKAGE_MAP: Record<PackageType, { tokens: number; amountCny: number; label: string }> = {
  starter: { tokens: 10000, amountCny: 300, label: '体验包' },
  weekly: { tokens: 30000, amountCny: 600, label: '周订阅' },
  monthly: { tokens: 150000, amountCny: 1900, label: '月订阅' },
};

export const FREE_QUOTA = 10000;
export const ADMIN_EMAIL = '1710582228@qq.com';

// ─── Wallet Core ─────────────────────────────────────────────────────────────

export async function getWallet(userId: string): Promise<Wallet | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('user_wallets')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Wallet | null;
}

export async function createWallet(userId: string): Promise<Wallet> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('user_wallets')
    .insert({ user_id: userId, balance: FREE_QUOTA })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Wallet;
}

export async function getOrCreateWallet(userId: string): Promise<Wallet> {
  const existing = await getWallet(userId);
  if (existing) return existing;
  return createWallet(userId);
}

export async function consumeTokens(userId: string, tokens: number): Promise<{ success: boolean; remaining: number }> {
  const supabase = getSupabaseAdminClient();

  // 乐观并发控制：以读取到的 balance 作为更新条件，冲突时重试，避免并发对话导致余额覆盖
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const wallet = await getOrCreateWallet(userId);
    if (wallet.balance < tokens) {
      return { success: false, remaining: wallet.balance };
    }

    const { data, error } = await supabase
      .from('user_wallets')
      .update({
        balance: wallet.balance - tokens,
        total_consumed: wallet.total_consumed + tokens,
      })
      .eq('user_id', userId)
      .eq('balance', wallet.balance)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return { success: true, remaining: (data as Wallet).balance };
  }

  const wallet = await getOrCreateWallet(userId);
  return { success: false, remaining: wallet.balance };
}

export async function addTokens(userId: string, tokens: number, isRecharge: boolean = false): Promise<Wallet> {
  const wallet = await getOrCreateWallet(userId);
  const supabase = getSupabaseAdminClient();

  const updates: Partial<Wallet> = {
    balance: wallet.balance + tokens,
  };
  if (isRecharge) {
    updates.total_recharged = wallet.total_recharged + tokens;
    updates.is_paid_user = true;
  }

  const { data, error } = await supabase
    .from('user_wallets')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Wallet;
}

// ─── Payment Request ─────────────────────────────────────────────────────────

export async function createPaymentRequest(input: {
  email: string;
  userId?: string;
  packageType: PackageType;
  wechatNote?: string;
  screenshotUrl?: string;
}): Promise<PaymentRequest> {
  const pkg = PACKAGE_MAP[input.packageType];
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from('payment_requests')
    .insert({
      email: input.email,
      user_id: input.userId || null,
      package_type: input.packageType,
      tokens: pkg.tokens,
      amount_cny: pkg.amountCny,
      wechat_note: input.wechatNote || null,
      screenshot_url: input.screenshotUrl || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as PaymentRequest;
}

export async function getPaymentRequest(id: string): Promise<PaymentRequest | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as PaymentRequest | null;
}

export async function confirmPaymentRequest(requestId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('payment_requests')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', requestId);

  if (error) throw new Error(error.message);
}

/**
 * 开通订单并发安全的实现：以 status=confirmed 且 activated_at 为空作为条件原子占用订单，
 * 只有抢占成功的一次才发放能量；发放失败时回滚 activated_at，避免用户付款却不到账。
 * 说明：已上线的数据库 status 约束不含 'activated'，因此以 activated_at 作为「已到账」的判定字段。
 * @returns true 表示本次真正发放了能量；false 表示订单已被其他请求开通。
 */
export async function activatePaymentRequest(requestId: string, userId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();

  const { data: claimed, error } = await supabase
    .from('payment_requests')
    .update({ activated_at: new Date().toISOString(), user_id: userId })
    .eq('id', requestId)
    .eq('status', 'confirmed')
    .is('activated_at', null)
    .select()
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!claimed) return false;

  try {
    await addTokens(userId, (claimed as PaymentRequest).tokens, true);
  } catch (creditError) {
    await supabase
      .from('payment_requests')
      .update({ activated_at: null })
      .eq('id', requestId)
      .eq('activated_at', claimed.activated_at);
    throw creditError;
  }

  return true;
}

/** 按邮箱查找注册用户（Supabase admin listUsers 默认只返回 50 条，必须分页遍历） */
export async function findUserByEmail(email: string): Promise<{ id: string; email?: string } | null> {
  const supabase = getSupabaseAdminClient();
  const target = email.trim().toLowerCase();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const users = data?.users || [];
    const found = users.find((user) => (user.email || '').toLowerCase() === target);
    if (found) return { id: found.id, email: found.email };
    if (users.length < 1000) return null;
  }

  return null;
}

// ─── Confirmation Token ─────────────────────────────────────────────────────

export async function createConfirmationToken(requestId: string): Promise<string> {
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('payment_confirmations')
    .insert({ token, request_id: requestId, expires_at: expiresAt.toISOString() });

  if (error) throw new Error(error.message);
  return token;
}

export async function validateConfirmationToken(token: string): Promise<{ valid: boolean; requestId?: string }> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('payment_confirmations')
    .select('request_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !data) return { valid: false };
  if (data.used_at) return { valid: false };
  if (new Date(data.expires_at) < new Date()) return { valid: false };

  return { valid: true, requestId: data.request_id };
}

export async function markTokenUsed(token: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from('payment_confirmations')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token);
}

/** 读取确认令牌记录（含已使用/过期状态，用于幂等处理） */
export async function getConfirmationToken(token: string): Promise<{
  request_id: string;
  expires_at: string;
  used_at: string | null;
} | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('payment_confirmations')
    .select('request_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as { request_id: string; expires_at: string; used_at: string | null } | null;
}

/** 原子占用令牌：并发点击确认链接时只有一个请求能抢占成功 */
export async function claimConfirmationToken(token: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('payment_confirmations')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
    .is('used_at', null)
    .select('token')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

// ─── Refund Request ──────────────────────────────────────────────────────────

export async function createRefundRequest(input: {
  email: string;
  userId?: string;
  originalPaymentId?: string;
  amountCny: number;
  reason: string;
  paymentScreenshotUrl?: string;
}): Promise<RefundRequest> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('refund_requests')
    .insert({
      email: input.email,
      user_id: input.userId || null,
      original_payment_id: input.originalPaymentId || null,
      amount_cny: input.amountCny,
      reason: input.reason,
      payment_screenshot_url: input.paymentScreenshotUrl || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as RefundRequest;
}

// ─── Admin Operations ────────────────────────────────────────────────────────

export async function adminAdjustWallet(
  adminEmail: string,
  targetUserId: string,
  tokens: number,
  reason: string
): Promise<Wallet> {
  const wallet = await getOrCreateWallet(targetUserId);
  const supabase = getSupabaseAdminClient();

  const newBalance = wallet.balance + tokens;
  if (newBalance < 0) throw new Error('Insufficient balance');

  const { data, error } = await supabase
    .from('user_wallets')
    .update({ balance: newBalance })
    .eq('user_id', targetUserId)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Log admin action
  await supabase.from('admin_actions').insert({
    admin_email: adminEmail,
    action_type: 'wallet_adjust',
    target_user_id: targetUserId,
    details: { tokens, reason, previous_balance: wallet.balance, new_balance: newBalance },
  });

  return data as Wallet;
}

export async function getAdminPaymentStats() {
  const supabase = getSupabaseAdminClient();

  const [payments, refunds, wallets] = await Promise.all([
    supabase.from('payment_requests').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('refund_requests').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('user_wallets').select('*').order('total_recharged', { ascending: false }).limit(100),
  ]);

  return {
    payments: (payments.data || []) as PaymentRequest[],
    refunds: (refunds.data || []) as RefundRequest[],
    wallets: (wallets.data || []) as Wallet[],
  };
}

// ─── Admin List Queries ─────────────────────────────────────────────────────

export async function getPaymentRequests(status = 'all'): Promise<PaymentRequest[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from('payment_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as PaymentRequest[];
}

export async function rejectPaymentRequest(requestId: string, reason?: string, adminEmail = 'system'): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('payment_requests')
    .update({ status: 'rejected', admin_note: reason || null })
    .eq('id', requestId);

  if (error) throw new Error(error.message);

  // Log admin action
  const { error: logError } = await supabase.from('admin_actions').insert({
    admin_email: adminEmail,
    action_type: 'payment_reject',
    details: { requestId, reason: reason || 'No reason provided' },
  });
  if (logError) console.error('[admin_actions] payment_reject log failed', logError.message);
}

export async function getUserPaymentRequests(userId: string, limit = 5): Promise<PaymentRequest[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data || []) as PaymentRequest[];
}

export async function getRefundRequests(): Promise<RefundRequest[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('refund_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data || []) as RefundRequest[];
}

export async function getRefundRequest(id: string): Promise<RefundRequest | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('refund_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data || null) as RefundRequest | null;
}

export async function getLatestActivatedPayment(userId: string): Promise<PaymentRequest | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('user_id', userId)
    .not('activated_at', 'is', null)
    .order('activated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data || null) as PaymentRequest | null;
}

export async function processRefund(refundId: string, approved: boolean, adminEmail = 'system'): Promise<void> {
  const supabase = getSupabaseAdminClient();

  // 只允许 pending -> approved/rejected，防止重复点击导致重复扣减
  const { data: refund, error: claimError } = await supabase
    .from('refund_requests')
    .update({
      status: approved ? 'approved' : 'rejected',
      processed_at: new Date().toISOString(),
    })
    .eq('id', refundId)
    .eq('status', 'pending')
    .select()
    .maybeSingle();

  if (claimError) throw new Error(claimError.message);
  if (!refund) throw new Error('该退款申请已处理过，请勿重复操作');

  const item = refund as RefundRequest;

  // If approved, deduct purchased tokens from user wallet (not below zero)
  if (approved && item.user_id) {
    let payment = item.original_payment_id
      ? await getPaymentRequest(item.original_payment_id)
      : null;

    if (!payment) {
      const { data } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('user_id', item.user_id)
        .not('activated_at', 'is', null)
        .order('activated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      payment = (data || null) as PaymentRequest | null;
    }

    const wallet = await getWallet(item.user_id);
    const tokensToDeduct = Math.min(payment?.tokens || 0, wallet?.balance || 0);
    if (tokensToDeduct > 0) {
      await adminAdjustWallet(adminEmail, item.user_id, -tokensToDeduct, `Refund approved: ${item.reason}`);
    }
  }

  // Log admin action
  const { error: logError } = await supabase.from('admin_actions').insert({
    admin_email: adminEmail,
    action_type: approved ? 'refund_approve' : 'refund_reject',
    target_user_id: item.user_id,
    target_email: item.email,
    details: { refundId, amountCny: item.amount_cny, reason: item.reason },
  });
  if (logError) console.error('[admin_actions] refund log failed', logError.message);
}

export async function adjustUserTokens(
  userId: string,
  tokens: number,
  reason: string
): Promise<Wallet> {
  return adminAdjustWallet('admin', userId, tokens, reason);
}
