'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Cpu,
  FileText,
  ExternalLink,
  LogIn,
  RefreshCw,
  Calendar,
  UserCircle,
  Star,
  GraduationCap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { InsightsResponse, RangePreset } from '@/lib/admin-types';

// ===== 共享数据 Context =====
type AdminDataState = {
  data: InsightsResponse | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  preset: RangePreset;
  startDate: string;
  endDate: string;
  setRange: (preset: RangePreset, startDate?: string, endDate?: string) => void;
  site: 'all' | 'production';
  setSite: (site: 'all' | 'production') => void;
};

const AdminDataContext = createContext<AdminDataState | null>(null);

export function useAdminData() {
  const ctx = useContext(AdminDataContext);
  if (!ctx) throw new Error('useAdminData 必须在 AdminShell 内使用');
  return ctx;
}

async function getSessionWithTimeout(timeoutMs = 3500) {
  return Promise.race([
    supabase.auth.getSession(),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('session_timeout')), timeoutMs);
    }),
  ]);
}

function getAdminErrorMessage(message: string) {
  if (/missing authorization|admin login required|authorization header|invalid user token|forbidden|local admin/i.test(message)) {
    return '请先登录管理员账号（本机密钥或邮箱登录链接）。';
  }
  return message || '加载失败';
}

const NAV_ITEMS: Array<{ href: string; label: string; icon: typeof LayoutDashboard }> = [
  { href: '/admin', label: '概览', icon: LayoutDashboard },
  { href: '/admin/user-journey', label: '用户行为旅程', icon: Users },
  { href: '/admin/conversations', label: '对话分析', icon: MessageSquare },
  { href: '/admin/ai-usage', label: 'AI Token 用量', icon: Cpu },
  { href: '/admin/raw-conversations', label: '原始对话', icon: FileText },
  { href: '/admin/user-profiles', label: '用户画像', icon: UserCircle },
  { href: '/admin/starred', label: '收藏案例', icon: Star },
  { href: '/admin/coach-studio', label: '督导工作室', icon: GraduationCap },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const preset = (searchParams.get('preset') as RangePreset) || '30d';
  const startDate = searchParams.get('start') || '';
  const endDate = searchParams.get('end') || '';
  const site = searchParams.get('site') === 'production' ? 'production' : 'all';

  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set('preset', preset);
    params.set('site', site);
    if (preset === 'custom') {
      if (startDate) params.set('start', startDate);
      if (endDate) params.set('end', endDate);
    }
    return params;
  }, [preset, startDate, endDate, site]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: authData } = await getSessionWithTimeout();
      const token = authData.session?.access_token;
      const params = buildParams();
      const res = await fetch(`/api/admin/insights?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `加载失败（${res.status}）`);
      }
      const json = (await res.json()) as InsightsResponse;
      setData(json);
    } catch (e) {
      const rawMessage = e instanceof Error && e.message === 'session_timeout'
        ? '请先登录管理员账号。'
        : e instanceof Error ? e.message : '加载失败';
      setData(null);
      setError(getAdminErrorMessage(rawMessage));
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setRange = useCallback((nextPreset: RangePreset, nextStart?: string, nextEnd?: string) => {
    const params = new URLSearchParams();
    params.set('preset', nextPreset);
    params.set('site', site);
    if (nextPreset === 'custom') {
      if (nextStart) params.set('start', nextStart);
      if (nextEnd) params.set('end', nextEnd);
    }
    router.push(`${pathname}?${params.toString()}`);
  }, [pathname, router, site]);

  const setSite = useCallback((nextSite: 'all' | 'production') => {
    const params = new URLSearchParams();
    params.set('preset', preset);
    params.set('site', nextSite);
    if (preset === 'custom') {
      if (startDate) params.set('start', startDate);
      if (endDate) params.set('end', endDate);
    }
    router.push(`${pathname}?${params.toString()}`);
  }, [pathname, router, preset, startDate, endDate]);

  const value = useMemo<AdminDataState>(() => ({
    data,
    loading,
    error,
    reload,
    preset,
    startDate,
    endDate,
    setRange,
    site,
    setSite,
  }), [data, loading, error, reload, preset, startDate, endDate, setRange, site, setSite]);

  return (
    <AdminDataContext.Provider value={value}>
      <div className="flex min-h-screen bg-slate-100">
        <AdminSidebar pathname={pathname} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopBar />
          <main className="flex-1 overflow-y-auto px-6 py-6">
            {loading ? (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-10 text-sm text-slate-500">
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" />
                正在加载数据...
              </div>
            ) : error ? (
              <AdminAuthGate error={error} onReload={reload} />
            ) : (
              <div className="mx-auto max-w-6xl">{children}</div>
            )}
          </main>
        </div>
      </div>
    </AdminDataContext.Provider>
  );
}

function AdminSidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          E
        </div>
        <span className="text-sm font-semibold text-slate-900">EchoTalent</span>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 px-3 py-3">
        <a
          href="https://echotalent.fun"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          打开线上站点
        </a>
      </div>
    </aside>
  );
}

function AdminTopBar() {
  const { preset, startDate, endDate, setRange, data, reload, site, setSite } = useAdminData();
  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-3">
        <Calendar className="h-4 w-4 text-slate-400" />
        <div className="flex items-center gap-1.5">
          {([
            { p: 'today' as const, label: '今日' },
            { p: '7d' as const, label: '近 7 天' },
            { p: '30d' as const, label: '近 30 天' },
          ]).map((opt) => (
            <button
              key={opt.p}
              type="button"
              onClick={() => setRange(opt.p)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                preset === opt.p
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setRange('custom', startDate || '', endDate || '')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
              preset === 'custom'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            自选
          </button>
        </div>
        {preset === 'custom' ? (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setRange('custom', e.target.value, endDate)}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-400"
            />
            <span className="text-xs text-slate-400">至</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setRange('custom', startDate, e.target.value)}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-400"
            />
          </div>
        ) : null}
        {data?.range ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
            {data.range.startDate} — {data.range.endDate}
          </span>
        ) : null}
        <div className="ml-2 flex items-center gap-1.5 border-l border-slate-200 pl-3">
          {([
            { s: 'all' as const, label: '全部数据' },
            { s: 'production' as const, label: '仅线上' },
          ]).map((opt) => (
            <button
              key={opt.s}
              type="button"
              onClick={() => setSite(opt.s)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                site === opt.s
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={reload}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        刷新
      </button>
    </header>
  );
}

function AdminAuthGate({ error, onReload }: { error: string; onReload: () => void }) {
  return <AdminAuthForm error={error} onReload={onReload} />;
}

export function AdminAuthForm({ error, onReload }: { error: string; onReload: () => void }) {
  const [mode, setMode] = useState<'device' | 'local' | 'email'>('device');
  const [localSecret, setLocalSecret] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function enableDeviceAdmin() {
    setDeviceLoading(true);
    setFormError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/auth/local-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'device' }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `登录失败（${response.status}）`);
      setMessage('已在此设备登录，正在进入后台...');
      window.setTimeout(() => window.location.reload(), 500);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '设备登录失败。');
    } finally {
      setDeviceLoading(false);
    }
  }

  async function enableLocalAdmin(event: React.FormEvent) {
    event.preventDefault();
    setLocalLoading(true);
    setFormError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/auth/local-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: localSecret }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `启用失败（${response.status}）`);
      setMessage(body.message || '本机管理员权限已启用，正在刷新后台。');
      window.setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '启用本机管理员权限失败。');
    } finally {
      setLocalLoading(false);
    }
  }

  async function sendAdminLoginLink(event: React.FormEvent) {
    event.preventDefault();
    setEmailLoading(true);
    setFormError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/auth/admin-login-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `发送登录链接失败（${response.status}）`);
      if (body.mode === 'local_admin_session') {
        setMessage(body.message || '本地管理员预览会话已启用，正在刷新后台。');
        window.setTimeout(() => window.location.reload(), 600);
        return;
      }
      setMessage('登录链接已发送，请去管理员邮箱点击登录。');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '发送登录链接失败，请稍后再试。');
    } finally {
      setEmailLoading(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <LogIn className="h-5 w-5 text-indigo-500" />
          <h2 className="text-lg font-semibold text-slate-900">管理员登录</h2>
        </div>
        <p className="mb-5 text-sm text-slate-500">{error}</p>

        {mode === 'device' ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void enableDeviceAdmin()}
              disabled={deviceLoading}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {deviceLoading ? '登录中...' : '此设备一键登录'}
            </button>
            <p className="text-xs leading-5 text-slate-400">
              仅限本机使用，无需密码，登录状态保持 30 天。
            </p>
            <div className="flex items-center gap-3 pt-2">
              <span className="h-px flex-1 bg-slate-100" />
              <span className="text-xs text-slate-400">其他方式</span>
              <span className="h-px flex-1 bg-slate-100" />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('local')}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                本机密钥
              </button>
              <button
                type="button"
                onClick={() => setMode('email')}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                邮箱登录链接
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-5 flex border-b border-slate-100">
            <button
              type="button"
              onClick={() => setMode('device')}
              className="-mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-700"
            >
              ← 返回一键登录
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === 'local' ? 'local' : 'email')}
              className="-mb-px border-b-2 border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600"
            >
              {mode === 'local' ? '本机密钥' : '邮箱登录链接'}
            </button>
          </div>
        )}

        {mode === 'local' ? (
          <form onSubmit={enableLocalAdmin} className="space-y-3">
            <label htmlFor="local-admin-secret" className="text-sm font-medium text-slate-700">
              本机管理员密钥
            </label>
            <input
              id="local-admin-secret"
              type="password"
              value={localSecret}
              onChange={(event) => setLocalSecret(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400"
              placeholder="输入 LOCAL_ADMIN_SECRET"
              disabled={localLoading}
            />
            <button
              type="submit"
              disabled={localLoading}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {localLoading ? '验证中...' : '启用本机管理员权限'}
            </button>
          </form>
        ) : (
          <form onSubmit={sendAdminLoginLink} className="space-y-3">
            <label htmlFor="admin-email" className="text-sm font-medium text-slate-700">管理员邮箱</label>
            <input
              id="admin-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400"
              placeholder="admin@example.com"
              disabled={emailLoading}
            />
            <button
              type="submit"
              disabled={emailLoading}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {emailLoading ? '发送中...' : '发送登录链接'}
            </button>
          </form>
        )}

        {message ? <p className="mt-3 text-sm text-emerald-600">{message}</p> : null}
        {formError ? <p className="mt-3 text-sm text-red-600">{formError}</p> : null}

        <button
          type="button"
          onClick={onReload}
          className="mt-4 text-xs text-slate-500 underline underline-offset-4 hover:text-slate-700"
        >
          登录后点此重新加载数据
        </button>
      </div>
    </div>
  );
}
