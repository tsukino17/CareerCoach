export const runtime = 'edge';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sizeParam = url.searchParams.get('size') ?? '260';
  const sizeRaw = Number(sizeParam);
  const size = Number.isFinite(sizeRaw) ? Math.min(800, Math.max(120, Math.floor(sizeRaw))) : 260;

  const data = 'https://echotalent.fun/';
  const fg = '334155';
  const bg = 'ffffff';

  const upstream = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    data
  )}&color=${fg}&bgcolor=${bg}`;

  const res = await fetch(upstream, { cache: 'force-cache' });
  if (!res.ok) {
    return new Response('Upstream error', { status: 502 });
  }

  const body = await res.arrayBuffer();
  return new Response(body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
    },
  });
}

