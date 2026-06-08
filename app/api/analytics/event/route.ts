import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const eventSchema = z.object({
  eventName: z.string().min(1).max(80),
  page: z.string().max(200).optional(),
  step: z.string().max(120).optional(),
  status: z.string().max(40).optional(),
  sessionId: z.string().max(120).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function getClientIp(req: Request) {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return req.headers.get('x-real-ip') || '';
}

function getGeoMetadata(req: Request) {
  return {
    country: req.headers.get('x-vercel-ip-country') || req.headers.get('cf-ipcountry') || '',
    region: req.headers.get('x-vercel-ip-country-region') || req.headers.get('x-region') || '',
    city: req.headers.get('x-vercel-ip-city') || req.headers.get('x-city') || '',
  };
}

export async function POST(req: Request) {
  try {
    const payload = eventSchema.parse(await req.json());

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ ok: true, skipped: 'analytics_not_configured' });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let userId: string | null = null;
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();
      if (token) {
        const { data } = await supabaseAdmin.auth.getUser(token);
        userId = data.user?.id || null;
      }
    }

    const { error } = await supabaseAdmin.from('analytics_events').insert({
      user_id: userId,
      session_id: payload.sessionId || null,
      event_name: payload.eventName,
      page: payload.page || null,
      step: payload.step || null,
      status: payload.status || null,
      metadata: {
        ...(payload.metadata || {}),
        ...getGeoMetadata(req),
      },
      ip: getClientIp(req) || null,
      user_agent: req.headers.get('user-agent') || null,
    });
    if (error) {
      console.warn(`[analytics] Skipped event insert. ${error.message}`);
      return NextResponse.json({ ok: true, skipped: 'insert_failed' });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid event payload';
    console.warn(`[analytics] Skipped invalid event. ${message}`);
    return NextResponse.json({ ok: true, skipped: 'invalid_event' });
  }
}
