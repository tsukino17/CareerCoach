import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';

const LOCAL_ADMIN_COOKIE = 'local_admin_session';
const LOCAL_ADMIN_MAX_AGE = 60 * 60 * 24 * 30;

function getRequestHostname(req: Request) {
  try {
    return new URL(req.url).hostname.toLowerCase();
  } catch {
    return (req.headers.get('host') || '').split(':')[0].toLowerCase();
  }
}

export function isLocalAdminRequest(req: Request) {
  return ['localhost', '127.0.0.1', '::1'].includes(getRequestHostname(req));
}

function signLocalAdminSession(expiresAt: number) {
  const secret = process.env.LOCAL_ADMIN_SECRET || '';
  return createHmac('sha256', secret).update(`local-admin:${expiresAt}`).digest('hex');
}

export function createLocalAdminSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + LOCAL_ADMIN_MAX_AGE;
  return `${expiresAt}.${signLocalAdminSession(expiresAt)}`;
}

function isValidLocalAdminSession(value: string) {
  const [expiresRaw, signature] = value.split('.');
  const expiresAt = Number(expiresRaw);
  const expected = signLocalAdminSession(expiresAt);
  if (!expiresAt || expiresAt < Math.floor(Date.now() / 1000) || !signature || signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin environment variables');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function parseAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string) {
  return parseAdminEmails().includes(email.trim().toLowerCase());
}

export async function requireAdminByBearerToken(authorizationHeader: string | null) {
  if (!authorizationHeader) {
    throw new Error('Missing Authorization header');
  }
  const token = authorizationHeader.replace('Bearer ', '').trim();
  if (!token) {
    throw new Error('Invalid Authorization header');
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    throw new Error('Invalid user token');
  }

  const email = (data.user.email || '').toLowerCase();
  const allowlist = parseAdminEmails();
  if (allowlist.length === 0) {
    throw new Error('Forbidden: admin allowlist is empty');
  }
  if (!allowlist.includes(email)) {
    throw new Error('Forbidden');
  }

  return { supabaseAdmin, user: data.user };
}

export async function requireAdmin(req: Request) {
  if (!isLocalAdminRequest(req)) {
    throw new Error('Local admin access required');
  }

  const authorizationHeader = req.headers.get('authorization');
  if (authorizationHeader) {
    return requireAdminByBearerToken(authorizationHeader);
  }

  const cookieStore = await cookies();
  const localSession = cookieStore.get(LOCAL_ADMIN_COOKIE)?.value || '';
  if (localSession && isValidLocalAdminSession(localSession)) {
    return {
      supabaseAdmin: getSupabaseAdminClient(),
      user: {
        id: 'local-admin:device',
        email: 'local-device-admin@echotalent.local',
      },
    };
  }

  throw new Error('Admin login required');
}
