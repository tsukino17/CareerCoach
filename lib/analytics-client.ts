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
const SESSION_STARTED_AT_KEY = 'career_analytics_session_started_at';
const VISITOR_KEY = 'career_analytics_visitor_id';
// Career exploration is an infrequent workflow; keep one session across normal same-day pauses.
const SESSION_TIMEOUT_MS = 6 * 60 * 60 * 1000;

function getOrCreateId(key: string, prefix: string) {
  if (typeof window === 'undefined') return `${prefix}_server`;
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    window.localStorage.setItem(key, id);
  }
  return id;
}

function getSessionId() {
  if (typeof window === 'undefined') return 'server';
  const now = Date.now();
  const startedAt = Number(window.localStorage.getItem(SESSION_STARTED_AT_KEY) || 0);
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id || !startedAt || now - startedAt > SESSION_TIMEOUT_MS) {
    id = `session_${now}_${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(SESSION_KEY, id);
    window.localStorage.setItem(SESSION_STARTED_AT_KEY, String(now));
  }
  return id;
}

export function getAnalyticsContext() {
  return {
    sessionId: getSessionId(),
    visitorId: getOrCreateId(VISITOR_KEY, 'visitor'),
  };
}

export async function trackEvent(payload: TrackEventPayload) {
  try {
    const { sessionId, visitorId } = getAnalyticsContext();
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
        metadata: {
          ...(payload.metadata || {}),
          anonymousVisitorId: visitorId,
        },
      }),
      keepalive: true,
    });
  } catch {
    // Silently ignore analytics failures to keep UX smooth.
  }
}
