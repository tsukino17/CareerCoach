'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { authHeaders } from '@/lib/api-auth';

type UsageSummary = {
  monthTokens: number;
  monthCalls: number;
  totalTokens: number;
  totalCalls: number;
  monthByRoute: Array<{ route: string; totalTokens: number; calls: number }>;
};

const ROUTE_LABELS: Record<string, string> = {
  chat: '教练对话',
  'coach/chat': '行动教练',
  'coach/path/chat': '现实路径教练',
  'coach/analysis': '深度分析',
  'coach/opportunity-search': '机会研究',
  report: '职业报告',
  plan: '执行计划',
  summarize: '对话标题',
  'compare-roles': '角色对比',
  'analyze-role': '角色分析',
  'career-path/preview': '路径预览',
};

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function UserCenterPage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.user) return;
      if (!active) return;
      setUserEmail(session.user.email || '已登录用户');
      try {
        const res = await fetch('/api/usage/me', { headers: await authHeaders() });
        if (res.ok) {
          const summary = (await res.json()) as UsageSummary;
          if (active) setUsage(summary);
        }
      } catch {
        // 用量加载失败不影响个人中心其它内容
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#ffffff 0%, #fbfbfe 55%, #ffffff 100%)',
      }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 16px 24px' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 14 }}>个人中心</div>

        <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 18, alignItems: 'start' }}>
          <section style={{ display: 'grid', gap: 14 }}>
            <div
              style={{
                borderRadius: 18,
                border: '1px solid rgba(15,23,42,0.08)',
                background: 'rgba(255,255,255,0.75)',
                padding: 16,
                boxShadow: '0 14px 40px rgba(15,23,42,0.06)',
              }}
            >
              <div style={{ display: 'grid', placeItems: 'center', gap: 10, padding: '12px 0 6px' }}>
                <div
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: 999,
                    background: 'rgba(134,184,255,0.12)',
                    border: '1px solid rgba(134,184,255,0.28)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <UserIcon />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                    {userEmail ? userEmail.split('@')[0] : '访客'}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(15,23,42,0.55)' }}>
                    {userEmail ? userEmail : '未登录'}
                  </div>
                </div>
                <button
                  type="button"
                  style={{
                    marginTop: 6,
                    width: '100%',
                    borderRadius: 999,
                    border: '1px solid rgba(134,184,255,0.32)',
                    background: 'rgba(134,184,255,0.22)',
                    padding: '10px 14px',
                    fontWeight: 800,
                    color: '#0f172a',
                    cursor: 'pointer',
                  }}
                >
                  立即登录/注册
                </button>
              </div>
            </div>

            <div
              style={{
                borderRadius: 18,
                border: '1px solid rgba(15,23,42,0.08)',
                background: 'rgba(255,255,255,0.75)',
                padding: 14,
              }}
            >
              <NavItem label="历史对话" href="/chat" icon={<ChatIcon />} />
              <NavItem label="我的报告" href="/report" icon={<ReportIcon />} badge="New" />
              <NavItem label="现实路径教练" href="/path" icon={<ActionIcon />} />
            </div>

            <div
              style={{
                borderRadius: 18,
                border: '1px solid rgba(15,23,42,0.08)',
                background: 'rgba(255,255,255,0.75)',
                padding: 16,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>AI 用量</div>
              {!userEmail || !usage ? (
                <div style={{ marginTop: 8, fontSize: 12.5, color: 'rgba(15,23,42,0.55)', lineHeight: 1.7 }}>
                  {userEmail ? '用量加载中…' : '登录后这里会记录你的 AI 对话与报告 token 用量。'}
                </div>
              ) : (
                <>
                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <UsageStat label="本月 Token" value={formatTokens(usage.monthTokens)} />
                    <UsageStat label="本月调用" value={String(usage.monthCalls)} />
                    <UsageStat label="累计 Token" value={formatTokens(usage.totalTokens)} />
                  </div>
                  {usage.monthByRoute.length > 0 ? (
                    <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                      {usage.monthByRoute.slice(0, 4).map((item) => (
                        <div
                          key={item.route}
                          style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}
                        >
                          <span style={{ color: 'rgba(15,23,42,0.62)' }}>
                            {ROUTE_LABELS[item.route] || item.route}
                          </span>
                          <span style={{ fontWeight: 700, color: 'rgba(15,23,42,0.80)' }}>
                            {formatTokens(item.totalTokens)} · {item.calls} 次
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ marginTop: 10, fontSize: 12.5, color: 'rgba(15,23,42,0.55)' }}>
                      本月还没有 AI 调用记录。
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* 现实路径教练卡片暂隐藏，待后续面板完善后再启用
          <section
            style={{
              borderRadius: 18,
              border: '1px solid rgba(15,23,42,0.08)',
              background: 'rgba(255,255,255,0.75)',
              padding: 22,
              minHeight: 420,
              boxShadow: '0 14px 40px rgba(15,23,42,0.06)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: 'rgba(134,184,255,0.14)',
                    border: '1px solid rgba(134,184,255,0.22)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <CalendarIcon />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>现实路径教练</div>
                  <div style={{ marginTop: 4, color: 'rgba(15,23,42,0.55)', fontSize: 13 }}>
                    你的记录会自然累积在这里
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, color: 'rgba(15,23,42,0.62)', lineHeight: 1.7, fontSize: 14 }}>
                我们不会用"完成/未完成"去评判一天。只记录你已经做过的，并把它轻轻联结回你的理想身份。
              </div>

              <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link
                  href="/path"
                  style={{
                    display: 'inline-block',
                    borderRadius: 999,
                    border: '1px solid rgba(134,184,255,0.35)',
                    background: 'rgba(134,184,255,0.22)',
                    padding: '10px 14px',
                    fontWeight: 800,
                    color: '#0f172a',
                    textDecoration: 'none',
                  }}
                >
                  回到对话
                </Link>
                <Link
                  href="/coach/action/vision"
                  style={{
                    display: 'inline-block',
                    borderRadius: 999,
                    border: '1px solid rgba(15,23,42,0.12)',
                    background: 'rgba(255,255,255,0.85)',
                    padding: '10px 14px',
                    fontWeight: 700,
                    color: '#0f172a',
                    textDecoration: 'none',
                  }}
                >
                  身份愿景板（可编辑）
                </Link>
              </div>
            </div>

            <div
              style={{
                marginTop: 18,
                borderRadius: 16,
                border: '1px solid rgba(15,23,42,0.08)',
                background: 'rgba(243,248,255,0.55)',
                padding: 16,
                color: 'rgba(15,23,42,0.60)',
                lineHeight: 1.7,
                fontSize: 13,
              }}
            >
              后续这里会增加面板：记录概览（事实/心情）、趋势（只呈现，不催促）、阶段洞察（行动力教练总结）。
            </div>
          </section>
          */}
        </div>
      </div>
    </main>
  );
}

function UsageStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid rgba(15,23,42,0.06)',
        background: 'rgba(243,248,255,0.55)',
        padding: '8px 6px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{value}</div>
      <div style={{ marginTop: 2, fontSize: 11, color: 'rgba(15,23,42,0.52)' }}>{label}</div>
    </div>
  );
}

function NavItem({
  label,
  href,
  badge,
  icon,
}: {
  label: string;
  href: string;
  badge?: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '10px 10px',
        borderRadius: 14,
        color: '#0f172a',
        textDecoration: 'none',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 12,
            border: '1px solid rgba(15,23,42,0.08)',
            background: 'rgba(255,255,255,0.85)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {icon}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(15,23,42,0.78)' }}>{label}</span>
      </span>
      {badge ? (
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            padding: '3px 8px',
            borderRadius: 999,
            border: '1px solid rgba(134,184,255,0.35)',
            background: 'rgba(134,184,255,0.16)',
            color: 'rgba(15,23,42,0.75)',
          }}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function UserIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M20 21a8 8 0 0 0-16 0" stroke="rgba(134,184,255,0.95)" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke="rgba(134,184,255,0.95)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 15a4 4 0 0 1-4 4H9l-5 3V7a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v8Z"
        stroke="rgba(15,23,42,0.60)"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 3h7l4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
        stroke="rgba(15,23,42,0.60)"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M14 3v5h5" stroke="rgba(15,23,42,0.60)" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 13h8" stroke="rgba(15,23,42,0.45)" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 17h6" stroke="rgba(15,23,42,0.45)" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ActionIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M7 12h10" stroke="rgba(134,184,255,0.95)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 7v10" stroke="rgba(134,184,255,0.95)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="rgba(134,184,255,0.65)" strokeWidth="1.6" />
    </svg>
  );
}

// function CalendarIcon() {
//   return (
//     <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
//       <path d="M7 4v3M17 4v3M5 9h14" stroke="rgba(134,184,255,0.95)" strokeWidth="1.8" strokeLinecap="round" />
//       <path
//         d="M6 6h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
//         stroke="rgba(134,184,255,0.65)"
//         strokeWidth="1.6"
//         strokeLinejoin="round"
//       />
//     </svg>
//   );
// }
