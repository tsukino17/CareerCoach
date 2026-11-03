import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { INTERNAL_DEVICE_COOKIE, INTERNAL_DEVICE_COOKIE_VALUE } from '@/lib/analytics-internal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function isValidToken(token: unknown) {
  const expected = process.env.ANALYTICS_INTERNAL_TOKEN || '';
  if (!expected || typeof token !== 'string' || !token) return false;
  return safeEqual(token, expected);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = body && typeof body === 'object' ? (body as { token?: unknown }).token : null;
  const enabled = body && typeof body === 'object' ? Boolean((body as { enabled?: unknown }).enabled) : false;

  if (!isValidToken(token)) {
    // 不返回 token、期望值或具体失败原因，避免泄露内部令牌信息
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, enabled });
  response.cookies.set(INTERNAL_DEVICE_COOKIE, enabled ? INTERNAL_DEVICE_COOKIE_VALUE : '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: enabled ? 60 * 60 * 24 * 365 : 0,
  });
  return response;
}
