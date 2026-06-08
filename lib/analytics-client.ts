'use client';

import { supabase } from '@/lib/supabase';

export type TrackEventPayload = {
  eventName: string;
  page?: string;
  step?: string;
  status?: string;
  metadata?: Record<string, unknown>;
};

const SESSION_KEY = 'career_analytics_session_id';

function getSessionId() {
  if (typeof window === 'undefined') return 'server';
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export async function trackEvent(payload: TrackEventPayload) {
  try {
    const sessionId = getSessionId();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    await fetch('/api/analytics/event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        ...payload,
        sessionId,
      }),
      keepalive: true,
    });
  } catch {
    // Silently ignore analytics failures to keep UX smooth.
  }
}
