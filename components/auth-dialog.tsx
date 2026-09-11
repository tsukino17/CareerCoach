'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { AUTH_REDIRECT_CONTEXT_KEY } from '@/lib/auth-redirect-context';
import { Button } from '@/components/ui/button';
import { X, Loader2, Mail, Lock } from 'lucide-react';

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: () => void;
  nextPath?: string;
  draftToken?: string | null;
}

export function AuthDialog({ isOpen, onClose, onAuthSuccess, nextPath, draftToken }: AuthDialogProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [trainingConsent, setTrainingConsent] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resending, setResending] = useState(false);

  const claimCareerDraft = async (accessToken: string) => {
    if (!draftToken) return true;

    const response = await fetch('/api/career-path/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, draftToken }),
    });

    if (response.ok) return true;
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setError(body?.error || '职业报告保存失败，请稍后重试。');
    return false;
  };

  const finalizeProfile = async () => {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setError('登录状态未准备完成，请稍后重试。');
      return false;
    }

    try {
      const response = await fetch('/api/auth/finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          termsAccepted,
          trainingConsent,
          policyVersion: 'v2026-05',
          draftToken: draftToken || null,
        }),
      });

      if (!response.ok) {
        throw new Error('资料初始化失败');
      }

      return accessToken;
    } catch (error) {
      console.error('Profile initialization failed:', error);
      setError('登录成功，但资料初始化失败。请稍后重试。');
      return null;
    }
  };

  const buildCallbackUrl = () => {
    const callbackUrl = new URL('/auth/callback', window.location.origin);
    if (nextPath) callbackUrl.searchParams.set('next', nextPath);
    if (draftToken) callbackUrl.searchParams.set('draft_token', draftToken);
    callbackUrl.searchParams.set('terms_accepted', termsAccepted ? '1' : '0');
    callbackUrl.searchParams.set('training_consent', trainingConsent ? '1' : '0');
    callbackUrl.searchParams.set('policy_version', 'v2026-05');
    return callbackUrl.toString();
  };

  const saveAuthRedirectContext = () => {
    if (!nextPath) return;
    window.sessionStorage.setItem(AUTH_REDIRECT_CONTEXT_KEY, JSON.stringify({
      nextPath,
      draftToken: draftToken || null,
      termsAccepted,
      trainingConsent,
      policyVersion: 'v2026-05',
    }));
  };

  const completeAuthentication = async () => {
    const accessToken = await finalizeProfile();
    if (!accessToken) return;
    if (!(await claimCareerDraft(accessToken))) return;

    onAuthSuccess();
    onClose();
    if (nextPath) {
      router.push(nextPath);
    }
  };

  // Poll for session status when waiting for email confirmation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isOpen && successMessage) {
        interval = setInterval(async () => {
            // Check if user has verified email (by trying to sign in silently or checking session)
            // Strategy: Since we have the password in state, we can try to sign in in background
            const { data } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (data.session) {
                clearInterval(interval);
                void completeAuthentication();
            }
        }, 3000); // Check every 3 seconds
    }
    return () => clearInterval(interval);
  }, [isOpen, successMessage, email, password, onAuthSuccess, onClose, nextPath, draftToken]);

  if (!isOpen) return null;

  const handleResendConfirmation = async () => {
    if (!email) return;
    setResending(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: buildCallbackUrl() },
      });
      if (resendError) throw resendError;
      setError(null);
      setSuccessMessage('验证邮件已重新发送，请检查收件箱或垃圾邮件。');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '重发失败，请稍后重试。';
      setError(message);
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (resetMode) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset`,
        });
        if (resetError) throw resetError;
        setSuccessMessage('重置邮件已发送，请检查邮箱；如果没有收到，请查看垃圾邮件。');
        return;
      }
      // 1. Try to Sign In first
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!signInError && signInData.session) {
        await completeAuthentication();
        return;
      }

      if (mode === 'sign_in') {
        // Check if the user exists but sign-in failed — could be wrong password or unconfirmed email
        const { data: checkData, error: checkError } = await supabase.auth.signUp({
          email,
          password: 'placeholder_check_only',
          options: { emailRedirectTo: buildCallbackUrl() },
        });
        if (checkError?.message.includes('already registered')) {
          throw new Error('密码似乎不正确。如果确认密码没错，可能邮箱还没有确认 — 请检查收件箱或垃圾邮件。');
        }
        if (checkData?.user) {
          // signUp returned a user — this email hadn't been registered at all, which is odd but means truly wrong credentials
          throw new Error('邮箱或密码不正确。若忘记密码，请重新获取登录邮件。');
        }
        throw new Error('邮箱或密码不正确。若忘记密码，请重新获取登录邮件。');
      }

      if (!termsAccepted) {
        throw new Error('请先阅读并同意用户协议与隐私政策。');
      }

      saveAuthRedirectContext();

      // 2. If Sign In failed, check if it's a credential issue
      // If so, try to Sign Up (assuming user might be new)
      if (signInError) {
        console.log('Sign in failed:', signInError.message);
        
        // If error indicates invalid credentials, we assume they might want to register
        // BUT we must differentiate between "Wrong Password" and "User Not Found"
        // Supabase often returns "Invalid login credentials" for both.
        
        // Let's try to Sign Up. If they already exist, Sign Up will fail with "User already registered"
        
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: buildCallbackUrl(),
          },
        });

        if (signUpError) {
          console.log('Sign up failed:', signUpError.message);
          
          // If Sign Up also fails, check if it's because user already exists
          // If user exists AND sign-in failed, it means WRONG PASSWORD
          if (signUpError.message.includes('User already registered') || signUpError.message.includes('already registered')) {
            throw new Error('用户已存在，但密码错误。请重试或重置密码。'); 
          }
          
          // Handle Network Error explicitly (Supabase specific)
          if (signUpError.message.includes('Network request failed') || signUpError.message.includes('fetch failed')) {
             throw new Error('网络连接失败，请检查您的网络设置');
          }

          // If it's a different error (e.g. rate limit, invalid email), throw it
          throw signUpError;
        }

        // Sign Up successful
        if (signUpData.session) {
            await completeAuthentication();
            return;
        } else if (signUpData.user && !signUpData.session) {
             // Registration successful but needs confirmation
             setSuccessMessage('注册成功！请前往您的邮箱查收验证邮件，点击链接后即可登录。');
             return;
        }
      }


    } catch (err: unknown) {
      console.error('Auth flow error:', err);
      const message = err instanceof Error ? err.message : 'Authentication failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 m-4 animate-in zoom-in-95 duration-200 border border-white/20">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            欢迎来到 EchoTalent
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            登录或注册以同步你的职业数据
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => { setMode('sign_in'); setResetMode(false); setError(null); setSuccessMessage(null); }}
            className={mode === 'sign_in' ? 'rounded-lg bg-white px-3 py-2 text-slate-900 shadow-sm' : 'rounded-lg px-3 py-2 text-slate-500'}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => { setMode('sign_up'); setResetMode(false); setError(null); setSuccessMessage(null); }}
            className={mode === 'sign_up' ? 'rounded-lg bg-white px-3 py-2 text-slate-900 shadow-sm' : 'rounded-lg px-3 py-2 text-slate-500'}
          >
            注册
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 ml-1">邮箱</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                placeholder="name@example.com"
              />
            </div>
          </div>

          {mode === 'sign_up' && !resetMode ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              <label className="flex cursor-pointer items-start gap-2">
                <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-1" />
                <span>我已阅读并同意 <Link href="/legal/privacy-policy" target="_blank" className="text-sky-700 underline">用户协议与隐私政策</Link></span>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <input type="checkbox" checked={trainingConsent} onChange={(event) => setTrainingConsent(event.target.checked)} className="mt-1" />
                <span>我同意将去标识化对话数据用于产品与模型改进。</span>
              </label>
            </div>
          ) : null}

          {!resetMode ? <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 ml-1">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                placeholder="••••••••"
                minLength={6}
              />
            </div>
          </div> : null}

          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 rounded-lg border border-red-100">
              {error}
              {error.includes('邮箱还没有确认') && (
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resending}
                  className="mt-2 w-full rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-100 transition-colors flex items-center justify-center gap-1.5"
                >
                  {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  重新发送验证邮件
                </button>
              )}
            </div>
          )}

          {successMessage && (
            <div className="p-3 text-sm text-green-600 bg-green-50 rounded-lg border border-green-100">
              {successMessage}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full rounded-xl py-5 text-base font-medium shadow-lg shadow-primary/20"
            disabled={loading || !!successMessage}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : null}
            {resetMode ? '发送重置邮件' : mode === 'sign_in' ? '登录' : '创建账号并发送验证邮件'}
          </Button>
        </form>

        {mode === 'sign_in' && !resetMode ? (
          <button type="button" onClick={() => { setResetMode(true); setError(null); setSuccessMessage(null); }} className="mt-4 w-full text-center text-xs text-sky-700 hover:underline">
            忘记密码？发送重置邮件
          </button>
        ) : null}
        {resetMode ? (
          <button type="button" onClick={() => { setResetMode(false); setError(null); setSuccessMessage(null); }} className="mt-4 w-full text-center text-xs text-slate-500 hover:underline">
            返回登录
          </button>
        ) : null}

        {mode === 'sign_up' ? (
          <p className="mt-6 text-center text-xs text-gray-400">
            注册后需要通过邮箱验证才能保存职业资料。
          </p>
        ) : null}
      </div>
    </div>
  );
}
