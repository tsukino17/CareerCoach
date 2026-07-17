import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

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
  const authorizationHeader = req.headers.get('authorization');
  if (authorizationHeader) {
    return requireAdminByBearerToken(authorizationHeader);
  }

  const cookieStore = await cookies();
  const localAdminEmail = cookieStore.get('local_admin_email')?.value || '';
  const isLocalDeviceAdmin = localAdminEmail === 'local-device-admin@echotalent.local';
  if (process.env.NODE_ENV === 'development' && localAdminEmail && (isAdminEmail(localAdminEmail) || isLocalDeviceAdmin)) {
    return {
      supabaseAdmin: getSupabaseAdminClient(),
      user: {
        id: `local-admin:${localAdminEmail}`,
        email: localAdminEmail,
      },
    };
  }

  throw new Error('Admin login required');
}
