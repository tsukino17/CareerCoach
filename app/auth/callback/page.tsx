'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { clearAuthRedirectContext, isSafeAuthNextPath, readAuthRedirectContext } from '@/lib/auth-redirect-context';

const STEP_TIMEOUT_MS = 12000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`timeout:${label}`)), STEP_TIMEOUT_MS);
    }),
  ]);
}

function parseFriendlyError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('timeout')) {
    return '登录响应超时，可能是网络不稳定。请返回重新获取一封新的登录链接。';
  }
  if (text.includes('expired') || text.includes('otp') || text.includes('invalid')) {
    return '这个登录链接已经失效或已过期，请返回重新获取一封新的登录邮件。';
  }
  if (text.includes('auth session missing') || text.includes('missing_token')) {
    return '登录结果没有成功保存下来，请重新点击邮件里的最新链接。';
  }
  if (text.includes('pkce') || text.includes('verifier') || text.includes('code_verifier')) {
    return '登录验证信息缺失（可能是邮件链接已被使用过），请重新获取一封新的登录链接。';
  }
  if (text.includes('finalize_failed')) {
    return '登录已成功，但档案同步失败。请稍后重试或直接访问后台。';
  }
  if (text.includes('missing_auth_payload')) {
    return '登录链接缺少必要的参数，请重新获取一封新的登录邮件。';
  }
  return '登录没有成功完成，请稍后再试。';
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackLoading />}>
      <AuthCallbackContent />
    </Suspense>
  );
}

function AuthCallbackLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          <h1 className="text-lg font-semibold text-slate-900">正在完成登录</h1>
        </div>
        <p className="mt-3 text-sm text-slate-500">正在确认你的登录状态...</p>
      </div>
    </main>
  );
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('正在确认你的登录状态...');
  const [error, setError] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);

  const redirectContext = useMemo(() => readAuthRedirectContext(), []);
  const nextPath = useMemo(() => {
    const requestedPath = searchParams.get('next');
    if (isSafeAuthNextPath(requestedPath)) return requestedPath;
    return redirectContext?.nextPath || '/chat';
  }, [redirectContext, searchParams]);

  useEffect(() => {
    let cancelled = false;

    const finalizeLogin = async () => {
      try {
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
        const errorCode = url.searchParams.get('error_code') || hashParams.get('error_code');
        const errorDescription =
          url.searchParams.get('error_description') ||
          url.searchParams.get('msg') ||
          hashParams.get('error_description') ||
          hashParams.get('msg');
        if (errorCode || errorDescription) {
          throw new Error(`${errorCode || 'auth_error'} ${errorDescription || ''}`.trim());
        }

        // 1. 尝试 PKCE flow (code in query string)
        const code = url.searchParams.get('code');
        // 2. 尝试 OTP flow (token_hash / token in query string)
        const tokenHash = url.searchParams.get('token_hash');
        const token = url.searchParams.get('token');
        const type = url.searchParams.get('type');
        // 3. Implicit flow fallback (access_token in hash)
        const hashAccessToken = hashParams.get('access_token');
        const hashRefreshToken = hashParams.get('refresh_token');

        let sessionEstablished = false;

        if (code) {
          // PKCE flow
          try {
            const { error: exchangeError } = await withTimeout(
              supabase.auth.exchangeCodeForSession(code),
              'exchange_code',
            );
            if (exchangeError) throw exchangeError;
            sessionEstablished = true;
          } catch (exchangeErr) {
            // PKCE 可能因 code verifier 缺失而失败，尝试回退
            const errMsg = exchangeErr instanceof Error ? exchangeErr.message : '';
            if (hashAccessToken && hashRefreshToken) {
              // implicit flow 回退
              const { error: setSessionError } = await withTimeout(
                supabase.auth.setSession({
                  access_token: hashAccessToken,
                  refresh_token: hashRefreshToken,
                }),
                'set_session',
              );
              if (setSessionError) throw setSessionError;
              sessionEstablished = true;
            } else if (errMsg.includes('timeout')) {
              throw exchangeErr;
            } else {
              throw exchangeErr;
            }
          }
        } else if ((tokenHash || token) && type) {
          // OTP flow
          const verifyType = type === 'signup' || type === 'email' || type === 'magiclink' ? 'email' : null;
          if (!verifyType) {
            throw new Error('unsupported_verify_type');
          }
          if (tokenHash) {
            const { error: verifyError } = await withTimeout(
              supabase.auth.verifyOtp({ token_hash: tokenHash, type: verifyType }),
              'verify_otp',
            );
            if (verifyError) throw verifyError;
          } else if (token && url.searchParams.get('email')) {
            const { error: verifyError } = await withTimeout(
              supabase.auth.verifyOtp({
                email: url.searchParams.get('email')!,
                token,
                type: verifyType,
              }),
              'verify_otp',
            );
            if (verifyError) throw verifyError;
          } else {
            throw new Error('missing_otp_payload');
          }
          sessionEstablished = true;
        } else if (hashAccessToken && hashRefreshToken) {
          // implicit flow
          const { error: setSessionError } = await withTimeout(
            supabase.auth.setSession({
              access_token: hashAccessToken,
              refresh_token: hashRefreshToken,
            }),
            'set_session',
          );
          if (setSessionError) throw setSessionError;
          sessionEstablished = true;
        } else {
          throw new Error('missing_auth_payload');
        }

        if (!sessionEstablished) {
          throw new Error('missing_auth_payload');
        }

        setMessage('登录成功，正在整理你的档案...');
        const { data: sessionData, error: sessionError } = await withTimeout(
          supabase.auth.getSession(),
          'get_session',
        );

        if (sessionError || !sessionData.session?.access_token) {
          throw sessionError || new Error('auth_session_missing');
        }

        const finalizeResponse = await withTimeout(
          fetch('/api/auth/finalize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${sessionData.session.access_token}`,
            },
            body: JSON.stringify({
              termsAccepted: searchParams.get('terms_accepted') === '1' || redirectContext?.termsAccepted === true,
              trainingConsent: searchParams.get('training_consent') === '1' || redirectContext?.trainingConsent === true,
              policyVersion: searchParams.get('policy_version') || redirectContext?.policyVersion || 'v2026-05',
              draftToken: searchParams.get('draft_token') || redirectContext?.draftToken || null,
            }),
          }),
          'finalize',
        );

        if (!finalizeResponse.ok) {
          throw new Error('finalize_failed');
        }

        const draftToken = searchParams.get('draft_token') || redirectContext?.draftToken;
        if (draftToken) {
          try {
            await withTimeout(
              fetch('/api/career-path/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessToken: sessionData.session.access_token, draftToken }),
              }),
              'claim_draft',
            );
          } catch {
            // draft claim 失败不阻塞登录
          }
        }

        if (cancelled) return;
        clearAuthRedirectContext();
        router.replace(nextPath || '/chat');
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : 'unknown_error';
        setRawError(raw);
        setError(parseFriendlyError(raw));
      }
    };

    finalizeLogin();

    return () => {
      cancelled = true;
    };
  }, [nextPath, redirectContext, router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {error ? (
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <h1 className="text-lg font-semibold text-slate-900">登录遇到问题</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">{error}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            <h1 className="text-lg font-semibold text-slate-900">正在完成登录</h1>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-400">{message}</p>
        {error ? (
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams({ error: rawError || error });
                if (nextPath) params.set('next', nextPath);
                router.replace(`/auth/auth-code-error?${params.toString()}`);
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              重新获取登录链接
            </button>
            <button
              type="button"
              onClick={() => router.push(nextPath || '/chat')}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              直接访问页面
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
