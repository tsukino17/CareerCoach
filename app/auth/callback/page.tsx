'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

function parseFriendlyError(message: string) {
  const text = message.toLowerCase();
  if (text.includes('expired') || text.includes('otp')) {
    return '这个登录链接已经失效了，请返回重新获取一封新的登录邮件。';
  }
  if (text.includes('auth session missing')) {
    return '登录结果没有成功保存下来，请重新点击邮件里的最新链接。';
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
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
          <h1 className="text-xl font-bold text-slate-900">正在完成登录</h1>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">正在确认你的登录状态...</p>
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

  const nextPath = useMemo(() => searchParams.get('next') || '/chat', [searchParams]);

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
        const code = url.searchParams.get('code');
        const tokenHash = url.searchParams.get('token_hash');
        const token = url.searchParams.get('token');
        const type = url.searchParams.get('type');
        const email = url.searchParams.get('email');

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else if ((tokenHash || token) && type) {
          const verifyType = type === 'signup' || type === 'email' || type === 'magiclink' ? 'email' : null;
          if (!verifyType) {
            throw new Error('unsupported_verify_type');
          }
          if (tokenHash) {
            const { error: verifyError } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: verifyType,
            });
            if (verifyError) throw verifyError;
          } else if (token && email) {
            const { error: verifyError } = await supabase.auth.verifyOtp({
              email,
              token,
              type: verifyType,
            });
            if (verifyError) throw verifyError;
          } else {
            throw new Error('missing_otp_payload');
          }
        } else {
          throw new Error('missing_auth_payload');
        }

        setMessage('登录成功，正在整理你的档案...');
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError || !session?.access_token) {
          throw sessionError || new Error('auth_session_missing');
        }

        const finalizeResponse = await fetch('/api/auth/finalize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            termsAccepted: searchParams.get('terms_accepted') === '1',
            trainingConsent: searchParams.get('training_consent') === '1',
            policyVersion: searchParams.get('policy_version') || 'v2026-05',
            draftToken: searchParams.get('draft_token'),
          }),
        });

        if (!finalizeResponse.ok) {
          throw new Error('finalize_failed');
        }

        if (cancelled) return;
        router.replace(nextPath);
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
  }, [nextPath, router, searchParams]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
          <h1 className="text-xl font-bold text-slate-900">正在完成登录</h1>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">{error || message}</p>
        {error ? (
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams({
                error: rawError || error,
                next: nextPath,
              });
              router.replace(`/auth/auth-code-error?${params.toString()}`);
            }}
            className="mt-6 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-600"
          >
            重新获取登录链接
          </button>
        ) : null}
      </div>
    </main>
  );
}
