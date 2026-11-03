'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { authHeaders } from '@/lib/api-auth';
import { AuthDialog } from '@/components/auth-dialog';
import { isRechargeEnabled } from '@/lib/payment-feature';

// ─── Types ───────────────────────────────────────────────────────────────────

type TalentProfile = {
  id: string;
  archetype: string | null;
  transferable_skills: string[] | null;
  recommended_roles: Array<{ title?: string; fit?: string }> | null;
  profile_json: { summary?: string } | null;
};

type PathContext = {
  talent_profile_id: string | null;
  current_snapshot: {
    currentStep?: number;
    confirmedDeliveryFormat?: string;
    nicheThemes?: Array<{ title: string }>;
    evidenceCards?: Array<{ id: string; status: string }>;
  } | null;
  updated_at: string;
};

type UsageSummary = {
  monthTokens: number;
  monthCalls: number;
  totalTokens: number;
  totalCalls: number;
};

type WalletInfo = {
  balance: number;
  totalRecharged: number;
  totalConsumed: number;
  isPaidUser: boolean;
};

type Conversation = {
  id: string;
  title: string;
  created_at: string;
};

type ReportMeta = {
  id: string;
  title: string;
  created_at: string;
  summary?: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const FREE_TOKEN_QUOTA = 10000; // 注册赠送额度
const LOW_THRESHOLD = 0.2; // 20% 低量提醒
const CRITICAL_THRESHOLD = 0.1; // 10% 严重不足

const ARCHETYPE_LABELS: Record<string, string> = {
  connector: '连接者',
  creator: '创造者',
  analyst: '分析者',
  guardian: '守护者',
  explorer: '探索者',
  builder: '建造者',
};

const STAGE_LABELS: Record<number, string> = {
  1: '探索期',
  2: '验证期',
  3: '行动期',
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function UserCenterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [registrationDays, setRegistrationDays] = useState<number | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  // Data states
  const [talentProfile, setTalentProfile] = useState<TalentProfile | null>(null);
  const [pathContext, setPathContext] = useState<PathContext | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [latestReport, setLatestReport] = useState<ReportMeta | null>(null);

  // ─── Data Fetching ─────────────────────────────────────────────────────────

  const fetchAllData = useCallback(async (uid: string) => {
    const headers = await authHeaders();

    // Parallel fetch
    const [profileRes, usageRes, walletRes, convRes] = await Promise.all([
      fetch('/api/career-path/profile', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: headers.authorization?.replace('Bearer ', '') || '' }),
      }).then(r => r.ok ? r.json() : null).catch(() => null),

      fetch('/api/usage/me', { headers })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),

      fetch('/api/wallet/me', { headers })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),

      Promise.resolve(
        supabase
          .from('conversations')
          .select('id, title, created_at')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(5)
      )
        .then(({ data }) => data || [])
        .catch(() => []),
    ]);

    // Process profile
    if (profileRes?.profile) {
      setTalentProfile(profileRes.profile.talentProfile || null);
      setPathContext(profileRes.profile.context || null);
    }

    // Process usage
    if (usageRes) {
      setUsage(usageRes);
    }

    // [RESERVED:payment] Process wallet：字段缺失或非数值时按无数据处理，由开关决定是否渲染
    if (walletRes && typeof walletRes.balance === 'number' && Number.isFinite(walletRes.balance)) {
      setWallet({
        balance: walletRes.balance,
        totalRecharged: typeof walletRes.totalRecharged === 'number' && Number.isFinite(walletRes.totalRecharged) ? walletRes.totalRecharged : 0,
        totalConsumed: typeof walletRes.totalConsumed === 'number' && Number.isFinite(walletRes.totalConsumed) ? walletRes.totalConsumed : 0,
        isPaidUser: Boolean(walletRes.isPaidUser),
      });
    } else {
      setWallet(null);
    }

    // Process conversations
    setConversations(convRes);

    // Check local report
    const savedReport = localStorage.getItem('career_report_v1');
    if (savedReport) {
      try {
        const parsed = JSON.parse(savedReport);
        setLatestReport({
          id: 'local',
          title: parsed.title || '职业分析报告',
          created_at: parsed.generatedAt || new Date().toISOString(),
          summary: parsed.summary,
        });
      } catch {}
    }
  }, []);

  // ─── Auth & Init ───────────────────────────────────────────────────────────

  const applySessionUser = useCallback(async (user: { email?: string | null; id: string; created_at?: string }) => {
    setUserEmail(user.email || '已登录用户');
    setUserId(user.id);

    if (user.created_at) {
      const created = new Date(user.created_at);
      const now = new Date();
      setRegistrationDays(Math.max(1, Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))));
    } else {
      setRegistrationDays(null);
    }

    await fetchAllData(user.id);
  }, [fetchAllData]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;

        if (!active) return;

        if (session?.user) {
          await applySessionUser(session.user);
        }
      } catch {
        // 读取登录态失败时按未登录展示，不阻塞页面渲染
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [applySessionUser]);

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const formatTokens = (n: number) => {
    if (!Number.isFinite(n)) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  };

  // 退出登录后清空上一账号的数据，避免访客状态看到他人余额与记录
  const resetUserData = () => {
    setWallet(null);
    setUsage(null);
    setTalentProfile(null);
    setPathContext(null);
    setConversations([]);
    setLatestReport(null);
    setRegistrationDays(null);
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString();
  };

  const isLoggedIn = Boolean(userEmail);
  const totalTokens = wallet ? wallet.balance + wallet.totalConsumed : 0;
  const usagePercent = wallet && totalTokens > 0 ? Math.min(100, Math.round((wallet.totalConsumed / totalTokens) * 100)) : 0;
  const remainingRatio = wallet && totalTokens > 0 ? wallet.balance / totalTokens : 1;
  const isLow = wallet ? remainingRatio <= LOW_THRESHOLD : false;
  const isCritical = wallet ? wallet.balance <= CRITICAL_THRESHOLD * FREE_TOKEN_QUOTA : false;
  // [RESERVED:payment] 余额/能量功能总开关：关闭时整张卡片与充值入口都不渲染
  const paymentEnabled = isRechargeEnabled();

  const currentStep = pathContext?.current_snapshot?.currentStep || 1;
  const evidenceCards = pathContext?.current_snapshot?.evidenceCards || [];
  const confirmedEvidence = evidenceCards.filter(e => e.status === 'confirmed').length;
  const totalEvidence = evidenceCards.length;

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', background: '#f5f8ff', display: 'grid', placeItems: 'center' }}>
        <div style={{ color: '#64748b', fontSize: 14 }}>加载中...</div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f5f8ff' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 16px 48px' }}>

        {/* ─── Layer 1: Identity Card ─── */}
        <section style={{
          borderRadius: 20,
          border: '1px solid rgba(15,23,42,0.08)',
          background: '#ffffff',
          padding: 24,
          marginBottom: 20,
          boxShadow: '0 4px 24px rgba(15,23,42,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            {/* Avatar */}
            <div style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              background: 'rgba(134,184,255,0.12)',
              border: '2px solid rgba(134,184,255,0.3)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}>
              <UserIcon />
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>
                  {userEmail ? userEmail.split('@')[0] : '访客'}
                </div>
                {registrationDays !== null && (
                  <span style={{
                    fontSize: 12,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'rgba(134,184,255,0.15)',
                    color: '#0f172a',
                    fontWeight: 600,
                  }}>
                    已陪伴你 {registrationDays} 天
                  </span>
                )}
                {isLoggedIn && (
                  <span style={{
                    fontSize: 12,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: currentStep >= 3 ? 'rgba(52,211,153,0.15)' : currentStep >= 2 ? 'rgba(251,191,36,0.15)' : 'rgba(134,184,255,0.15)',
                    color: currentStep >= 3 ? '#059669' : currentStep >= 2 ? '#d97706' : '#0f172a',
                    fontWeight: 600,
                  }}>
                    {STAGE_LABELS[currentStep] || '探索期'}
                  </span>
                )}
              </div>
              <div style={{ marginTop: 6, fontSize: 14, color: '#64748b' }}>
                {userEmail || '登录后同步你的职业探索数据'}
              </div>
            </div>

            {/* Action */}
            <div style={{ flexShrink: 0, marginLeft: 'auto' }}>
              {userEmail ? (
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setUserEmail(null);
                    setUserId(null);
                    resetUserData();
                  }}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 999,
                    border: '1px solid rgba(15,23,42,0.15)',
                    background: 'transparent',
                    color: '#64748b',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  退出登录
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAuth(true)}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 999,
                    border: 'none',
                    background: '#ff8a4c',
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(255,138,76,0.3)',
                  }}
                >
                  立即登录/注册
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ─── Layer 2: Core Assets ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>

          {/* Talent Profile Card */}
          <section style={{
            borderRadius: 18,
            border: '1px solid rgba(15,23,42,0.08)',
            background: '#ffffff',
            padding: 20,
            boxShadow: '0 4px 24px rgba(15,23,42,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'rgba(134,184,255,0.14)',
                display: 'grid', placeItems: 'center',
              }}>
                <SparkleIcon />
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>天赋画像</div>
            </div>

            {talentProfile ? (
              <>
                <div style={{
                  fontSize: 24, fontWeight: 800, color: '#0f172a',
                  marginBottom: 10,
                }}>
                  {ARCHETYPE_LABELS[talentProfile.archetype || ''] || talentProfile.archetype || '探索者'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {(talentProfile.transferable_skills || []).slice(0, 3).map((skill, i) => (
                    <span key={i} style={{
                      fontSize: 12, padding: '4px 10px', borderRadius: 999,
                      background: 'rgba(134,184,255,0.12)', color: '#0f172a',
                    }}>
                      {skill}
                    </span>
                  ))}
                </div>
                <Link href="/path" style={{
                  fontSize: 13, color: '#2563eb', textDecoration: 'none', fontWeight: 600,
                }}>
                  查看完整画像 →
                </Link>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 14, color: '#64748b', marginBottom: 12, lineHeight: 1.7 }}>
                  完成一次对话<br />发现你的天赋优势
                </div>
                <Link href="/chat" style={{
                  display: 'inline-block',
                  padding: '10px 20px', borderRadius: 999,
                  background: 'rgba(134,184,255,0.22)', color: '#0f172a',
                  fontSize: 13, fontWeight: 700, textDecoration: 'none',
                }}>
                  开始对话
                </Link>
              </div>
            )}
          </section>

          {/* Path Progress Card */}
          <section style={{
            borderRadius: 18,
            border: '1px solid rgba(15,23,42,0.08)',
            background: '#ffffff',
            padding: 20,
            boxShadow: '0 4px 24px rgba(15,23,42,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'rgba(134,184,255,0.14)',
                display: 'grid', placeItems: 'center',
              }}>
                <PathIcon />
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>路径进度</div>
            </div>

            {pathContext ? (
              <>
                {/* Step Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14 }}>
                  {[1, 2, 3].map((step) => (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 999,
                        background: step <= currentStep ? '#86B8FF' : 'rgba(15,23,42,0.08)',
                        display: 'grid', placeItems: 'center',
                        color: step <= currentStep ? '#fff' : '#94a3b8',
                        fontSize: 12, fontWeight: 700,
                      }}>
                        {step}
                      </div>
                      {step < 3 && <div style={{ flex: 1, height: 2, background: step < currentStep ? '#86B8FF' : 'rgba(15,23,42,0.08)', margin: '0 4px' }} />}
                    </div>
                  ))}
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gap: 8, fontSize: 13, color: '#64748b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>交付形态</span>
                    <span style={{ color: pathContext.current_snapshot?.confirmedDeliveryFormat ? '#059669' : '#94a3b8' }}>
                      {pathContext.current_snapshot?.confirmedDeliveryFormat ? '已确认' : '待确认'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>利基主题</span>
                    <span style={{ color: (pathContext.current_snapshot?.nicheThemes?.length || 0) > 0 ? '#059669' : '#94a3b8' }}>
                      {(pathContext.current_snapshot?.nicheThemes?.length || 0) > 0 ? `${pathContext.current_snapshot?.nicheThemes?.length} 个` : '待探索'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>证据卡</span>
                    <span style={{ color: confirmedEvidence >= 2 ? '#059669' : '#94a3b8' }}>
                      {confirmedEvidence}/{totalEvidence} 已确认
                    </span>
                  </div>
                </div>

                <Link href="/path" style={{
                  display: 'block', marginTop: 14, textAlign: 'center',
                  padding: '10px', borderRadius: 12,
                  background: 'rgba(134,184,255,0.12)', color: '#0f172a',
                  fontSize: 13, fontWeight: 700, textDecoration: 'none',
                }}>
                  继续路径探索
                </Link>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 14, color: '#64748b', marginBottom: 12, lineHeight: 1.7 }}>
                  开始你的职业路径探索<br />一步步验证可行性
                </div>
                <Link href="/path" style={{
                  display: 'inline-block',
                  padding: '10px 20px', borderRadius: 999,
                  background: 'rgba(134,184,255,0.22)', color: '#0f172a',
                  fontSize: 13, fontWeight: 700, textDecoration: 'none',
                }}>
                  探索路径
                </Link>
              </div>
            )}
          </section>

          {/* [RESERVED:payment] 余额/能量卡片：开关关闭时整卡（含低能量提示与充值入口）不渲染 */}
          {paymentEnabled && (!isLoggedIn || Boolean(wallet)) && (
            <section style={{
              borderRadius: 18,
              border: '1px solid rgba(15,23,42,0.08)',
              background: '#ffffff',
              padding: 20,
              boxShadow: '0 4px 24px rgba(15,23,42,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: isCritical ? 'rgba(239,68,68,0.12)' : isLow ? 'rgba(251,191,36,0.12)' : 'rgba(134,184,255,0.14)',
                  display: 'grid', placeItems: 'center',
                }}>
                  <EnergyIcon color={isCritical ? '#ef4444' : isLow ? '#f59e0b' : '#86B8FF'} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>剩余能量</div>
              </div>

              {!isLoggedIn ? (
                <div style={{ textAlign: 'center', padding: '14px 0' }}>
                  <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
                    登录后查看你的能量余额
                    <br />
                    注册即赠 {formatTokens(FREE_TOKEN_QUOTA)} Token
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAuth(true)}
                    style={{
                      marginTop: 12,
                      padding: '10px 20px',
                      borderRadius: 999,
                      border: 'none',
                      background: 'rgba(134,184,255,0.22)',
                      color: '#0f172a',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    登录 / 注册
                  </button>
                </div>
              ) : wallet ? (
                <>
                  <div style={{ textAlign: 'center', padding: '10px 0' }}>
                    <div style={{
                      fontSize: 36, fontWeight: 800,
                      color: isCritical ? '#ef4444' : isLow ? '#f59e0b' : '#0f172a',
                      lineHeight: 1,
                    }}>
                      {formatTokens(wallet.balance)}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
                      剩余可用 Token
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginTop: 14 }}>
                    <div style={{
                      height: 6, borderRadius: 999,
                      background: 'rgba(15,23,42,0.06)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${100 - usagePercent}%`,
                        height: '100%', borderRadius: 999,
                        background: isCritical ? '#ef4444' : isLow ? '#f59e0b' : '#34d399',
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>
                      已用 {usagePercent}%
                    </div>
                  </div>

                  {(isLow || isCritical) && (
                    <div style={{
                      marginTop: 12, padding: '10px 12px', borderRadius: 12,
                      background: isCritical ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.08)',
                      fontSize: 12, color: isCritical ? '#dc2626' : '#d97706',
                      textAlign: 'center',
                    }}>
                      {isCritical ? '能量即将用完' : '能量偏低，注意使用'}
                    </div>
                  )}

                  {/* [RESERVED:payment] 充值入口：随总开关一起显隐 */}
                  <Link href="/recharge" style={{
                    display: 'block',
                    marginTop: 14,
                    padding: '10px',
                    borderRadius: 12,
                    background: isCritical ? '#ef4444' : 'rgba(134,184,255,0.22)',
                    color: isCritical ? '#ffffff' : '#0f172a',
                    fontSize: 13,
                    fontWeight: 700,
                    textAlign: 'center',
                    textDecoration: 'none',
                  }}>
                    {isCritical ? '立即充值' : '充值能量'}
                  </Link>
                </>
              ) : null}
            </section>
          )}
        </div>

        {/* ─── Layer 3: Actions & Records ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>

          {/* Recent Conversations */}
          <section style={{
            borderRadius: 18,
            border: '1px solid rgba(15,23,42,0.08)',
            background: '#ffffff',
            padding: 20,
            boxShadow: '0 4px 24px rgba(15,23,42,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: 'rgba(134,184,255,0.14)',
                  display: 'grid', placeItems: 'center',
                }}>
                  <ChatIcon />
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>最近对话</div>
              </div>
              <Link href="/chat?new=true" style={{
                fontSize: 13, color: '#2563eb', textDecoration: 'none', fontWeight: 600,
              }}>
                新对话 →
              </Link>
            </div>

            {conversations.length > 0 ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {conversations.slice(0, 3).map((conv) => (
                  <Link
                    key={conv.id}
                    href={`/chat?id=${conv.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 14px', borderRadius: 12,
                      border: '1px solid rgba(15,23,42,0.06)',
                      textDecoration: 'none', color: 'inherit',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.title || '新对话'}
                      </div>
                      <div style={{ marginTop: 2, fontSize: 12, color: '#94a3b8' }}>
                        {formatTimeAgo(conv.created_at)}
                      </div>
                    </div>
                    <ChevronRightIcon />
                  </Link>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <div style={{ fontSize: 14, color: '#64748b', marginBottom: 12, lineHeight: 1.7 }}>
                  暂无对话记录<br />开始你的第一次职业探索
                </div>
                <Link href="/chat" style={{
                  display: 'inline-block',
                  padding: '10px 20px', borderRadius: 999,
                  background: 'rgba(134,184,255,0.22)', color: '#0f172a',
                  fontSize: 13, fontWeight: 700, textDecoration: 'none',
                }}>
                  开始对话
                </Link>
              </div>
            )}
          </section>

          {/* My Report */}
          <section style={{
            borderRadius: 18,
            border: '1px solid rgba(15,23,42,0.08)',
            background: '#ffffff',
            padding: 20,
            boxShadow: '0 4px 24px rgba(15,23,42,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'rgba(134,184,255,0.14)',
                display: 'grid', placeItems: 'center',
              }}>
                <ReportIcon />
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>我的报告</div>
            </div>

            {latestReport ? (
              <div>
                <div style={{
                  borderRadius: 12, border: '1px solid rgba(15,23,42,0.08)',
                  padding: 16, marginBottom: 14,
                  background: 'linear-gradient(135deg, rgba(134,184,255,0.08) 0%, rgba(255,255,255,0.9) 100%)',
                }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                    {latestReport.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    生成于 {formatTimeAgo(latestReport.created_at)}
                  </div>
                  {latestReport.summary && (
                    <div style={{ marginTop: 10, fontSize: 13, color: '#475569', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {latestReport.summary}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Link href="/report" style={{
                    flex: 1, textAlign: 'center',
                    padding: '10px', borderRadius: 12,
                    background: 'rgba(134,184,255,0.22)', color: '#0f172a',
                    fontSize: 13, fontWeight: 700, textDecoration: 'none',
                  }}>
                    查看完整报告
                  </Link>
                  <button
                    type="button"
                    onClick={() => router.push('/report')}
                    style={{
                      padding: '10px 16px', borderRadius: 12,
                      border: '1px solid rgba(15,23,42,0.12)',
                      background: 'transparent', color: '#64748b',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    分享
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <div style={{ fontSize: 14, color: '#64748b', marginBottom: 12, lineHeight: 1.7 }}>
                  暂无报告<br />生成你的第一份职业分析报告
                </div>
                <Link href="/chat" style={{
                  display: 'inline-block',
                  padding: '10px 20px', borderRadius: 999,
                  background: 'rgba(134,184,255,0.22)', color: '#0f172a',
                  fontSize: 13, fontWeight: 700, textDecoration: 'none',
                }}>
                  去生成
                </Link>
              </div>
            )}
          </section>
        </div>

        {/* Quick Links */}
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 24 }}>
          <Link href="/chat" style={{ fontSize: 13, color: '#64748b', textDecoration: 'none' }}>
            返回对话
          </Link>
          <Link href="/path" style={{ fontSize: 13, color: '#64748b', textDecoration: 'none' }}>
            路径探索
          </Link>
        </div>
      </div>

      <AuthDialog
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onAuthSuccess={() => {
          setShowAuth(false);
          supabase.auth.getSession().then(({ data }) => {
            const session = data.session;
            if (session?.user) {
              void applySessionUser(session.user);
            }
          });
        }}
      />
    </main>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function UserIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path d="M20 21a8 8 0 0 0-16 0" stroke="#86B8FF" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="#86B8FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 2v4m0 12v4M2 12h4m12 0h4" stroke="#86B8FF" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" stroke="#86B8FF" strokeWidth="1.8" />
    </svg>
  );
}

function PathIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 19l5-5 4 4 7-8" stroke="#86B8FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 5h16" stroke="#86B8FF" strokeWidth="1.8" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

function EnergyIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M20 15a4 4 0 0 1-4 4H9l-5 3V7a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8Z" stroke="#86B8FF" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M7 3h7l4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="#86B8FF" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M14 3v5h5" stroke="#86B8FF" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 13h8" stroke="#86B8FF" strokeWidth="1.7" strokeLinecap="round" opacity="0.6" />
      <path d="M8 17h6" stroke="#86B8FF" strokeWidth="1.7" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginLeft: 8 }}>
      <path d="M9 18l6-6-6-6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
