import { NextResponse } from 'next/server';
import { isAllowedOrigin } from '@/lib/request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LocalAdminPayload = {
  secret?: string;
};

export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: '本机管理员入口仅在开发环境可用。' }, { status: 403 });
    }
    if (!isAllowedOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    }

    const configuredSecret = process.env.LOCAL_ADMIN_SECRET || '';
    if (!configuredSecret) {
      return NextResponse.json({ error: '本机管理员密钥未配置。' }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as LocalAdminPayload;
    if (!body.secret || body.secret !== configuredSecret) {
      return NextResponse.json({ error: '本机管理员密钥不正确。' }, { status: 401 });
    }

    const response = NextResponse.json({
      ok: true,
      mode: 'local_admin_device',
      message: '本机管理员权限已启用，正在刷新后台。',
    });
    response.cookies.set('local_admin_email', 'local-device-admin@echotalent.local', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch {
    return NextResponse.json({ error: '启用本机管理员权限失败。' }, { status: 500 });
  }
}
