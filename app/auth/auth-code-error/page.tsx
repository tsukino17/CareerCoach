'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

function parseErrorMessage(raw: string | null) {
  const text = (raw || '').toLowerCase();
  if (!text) return '登录链接无效，请重新获取。';
  if (text.includes('otp_expired') || text.includes('invalid or has expired') || text.includes('expired')) {
    return '这个登录链接已过期或已被使用，请重新获取一封新的登录邮件。';
  }
  if (text.includes('missing_env')) return '服务器配置不完整，请联系管理员检查环境变量。';
  return '登录失败，请重新获取登录链接后再试。';
}

function getRedirectOrigin() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) return appUrl.replace(/\/+$/, '');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) return siteUrl.replace(/\/+$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense fallback={<AuthCodeErrorLoading />}>
      <AuthCodeErrorContent />
    </Suspense>
  );
}

function AuthCodeErrorLoading() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">登录链接不可用</h1>
        <p className="mt-3 text-sm text-slate-500">正在读取登录状态...</p>
      </div>
    </main>
  );
}

function AuthCodeErrorContent() {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const friendlyError = useMemo(() => parseErrorMessage(params.get('error')), [params]);
  const nextPath = useMemo(() => params.get('next') || '/user', [params]);

  async function resendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const redirectBase = getRedirectOrigin();
      const params = new URLSearchParams({
        next: nextPath,
        terms_accepted: '1',
        training_consent: '1',
        policy_version: 'v2026-05',
      });
      const redirectTo = `${redirectBase}/auth/callback?${params.toString()}`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: redirectTo,
        },
      });
      if (error) throw error;
      setMessage('新的登录链接已发送，请返回邮箱使用最新邮件登录。');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '发送失败，请稍后重试。';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">登录链接不可用</h1>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {friendlyError}
        </p>

        <form className="mt-5 space-y-3" onSubmit={resendMagicLink}>
          <label className="block text-sm font-medium text-slate-700">重新发送到这个邮箱</label>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
            placeholder="name@example.com"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-60"
          >
            {loading ? '发送中...' : '重新发送登录链接'}
          </button>
        </form>

        {message ? <p className="mt-3 text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

        <div className="mt-6 text-center text-sm">
          <Link href="/user" className="text-slate-500 hover:text-slate-800">
            返回登录页
          </Link>
        </div>
      </div>
    </main>
  );
}
