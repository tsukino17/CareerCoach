export function isAllowedOrigin(req: Request) {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const host = req.headers.get('host');

  if (!host) return true;
  if (!origin && !referer) return true;

  const allowedHosts = new Set<string>([
    host,
    'localhost:3000',
    'localhost:3001',
    'localhost:3002',
    'localhost:3003',
    'echotalent.fun',
    'www.echotalent.fun',
  ]);

  const checkUrl = (value: string | null) => {
    if (!value) return true;
    try {
      const u = new URL(value);
      return allowedHosts.has(u.host);
    } catch {
      return false;
    }
  };

  return checkUrl(origin) && checkUrl(referer);
}
