type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

const store = new Map<string, Bucket>();

export function getClientIp(req: Request) {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (
    forwardedFor ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const now = Date.now();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (current.count >= limit) {
    return { ok: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  return { ok: true, remaining: limit - current.count, resetAt: current.resetAt };
}

type AsyncRateResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

let warnedFallback = false;

export async function checkRateLimitDistributed({ key, limit, windowMs }: RateLimitOptions): Promise<AsyncRateResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    if (!warnedFallback) {
      warnedFallback = true;
      console.warn('[rate-limit] Missing Supabase env, fallback to in-memory limiter.');
    }
    return checkRateLimit({ key, limit, windowMs });
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_rate_limit`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_key: key,
        p_limit: limit,
        p_window_ms: windowMs,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`rate-limit rpc failed: ${response.status} ${body}`);
    }

    const payload = (await response.json()) as Array<{ allowed?: boolean; remaining?: number; reset_at?: number }> | null;
    const first = Array.isArray(payload) ? payload[0] : null;
    if (!first) {
      throw new Error('rate-limit rpc empty response');
    }

    return {
      ok: Boolean(first.allowed),
      remaining: Number(first.remaining || 0),
      resetAt: Number(first.reset_at || Date.now() + windowMs),
    };
  } catch (error) {
    if (!warnedFallback) {
      warnedFallback = true;
      const message = error instanceof Error ? error.message : 'unknown error';
      console.warn(`[rate-limit] Distributed limiter unavailable, using in-memory fallback. ${message}`);
    }
    return checkRateLimit({ key, limit, windowMs });
  }
}

export function rateLimitResponse(resetAt: number) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return new Response(JSON.stringify({ error: 'Too many requests' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfter),
    },
  });
}

export type ApiMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export function normalizeMessages(
  messages: unknown,
  options: { maxMessages: number; maxContentLength: number; allowSystem?: boolean }
) {
  if (!Array.isArray(messages)) return [];

  return messages
    .slice(-options.maxMessages)
    .map((m) => {
      const mm = m as { role?: unknown; content?: unknown };
      const role =
        mm.role === 'user' || mm.role === 'assistant' || (options.allowSystem && mm.role === 'system')
          ? mm.role
          : null;
      const rawContent = typeof mm.content === 'string' ? mm.content.trim() : '';
      if (!role || !rawContent) return null;
      return {
        role,
        content: rawContent.slice(0, options.maxContentLength),
      };
    })
    .filter((m): m is ApiMessage => Boolean(m));
}
