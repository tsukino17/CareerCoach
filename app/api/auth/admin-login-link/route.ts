import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAllowedOrigin } from '@/lib/request-security';
import { isAdminEmail } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AdminLoginPayload = {
  email?: string;
};

function getRequestOrigin(req: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');

  const origin = req.headers.get('origin');
  if (origin) return origin.replace(/\/+$/, '');

  const host = req.headers.get('host');
  return host ? `http://${host}` : '';
}

export async function POST(req: Request) {
  let email = '';
  try {
    if (!isAllowedOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    }

    const body = (await req.json().catch(() => ({}))) as AdminLoginPayload;
    email = body.email?.trim().toLowerCase() || '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '请输入正确的管理员邮箱。' }, { status: 400 });
    }

    if (!isAdminEmail(email)) {
      return NextResponse.json({ error: '这个邮箱还没有管理员权限。' }, { status: 403 });
    }

    if (process.env.NODE_ENV === 'development') {
      const response = NextResponse.json({
        ok: true,
        mode: 'local_admin_session',
        message: '本地管理员预览会话已启用，正在刷新后台。',
      });
      response.cookies.set('local_admin_email', email, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 8,
      });
      return response;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabasePublishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabasePublishableKey) {
      return NextResponse.json({ error: '登录服务环境变量未配置完整。' }, { status: 500 });
    }

    const redirectOrigin = getRequestOrigin(req);
    if (!redirectOrigin) {
      return NextResponse.json({ error: '无法识别当前站点地址。' }, { status: 500 });
    }

    const redirectTo = `${redirectOrigin}/auth/callback?${new URLSearchParams({
      next: '/admin',
      terms_accepted: '1',
      training_consent: '1',
      policy_version: 'v2026-05',
    }).toString()}`;

    const supabase = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      const message = /rate limit|too many/i.test(error.message)
        ? '发送太频繁了，请稍等一会儿再试。'
        : error.message || '发送登录链接失败。';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : '';
    if (
      process.env.NODE_ENV === 'development' &&
      email &&
      isAdminEmail(email) &&
      /fetch failed|network|econnreset|enotfound|tls/i.test(rawMessage)
    ) {
      const response = NextResponse.json({
        ok: true,
        mode: 'local_admin_session',
        message: '本地网络无法连接邮件服务，已启用本地管理员预览会话。',
      });
      response.cookies.set('local_admin_email', email, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 8,
      });
      return response;
    }

    const message = /fetch failed|network|econnreset|enotfound|tls/i.test(rawMessage)
      ? '登录邮件服务暂时连接失败，请检查本地网络或稍后再试。'
      : rawMessage || '发送登录链接失败，请稍后再试。';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
