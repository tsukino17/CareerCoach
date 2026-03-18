export const runtime = 'edge';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const data = url.searchParams.get('data');
  const sizeParam = url.searchParams.get('size') ?? '240';
  // Optional foreground/background colors in hex without '#'
  const fg = (url.searchParams.get('fg') || '').replace('#', '');
  const bg = (url.searchParams.get('bg') || '').replace('#', '');
  const sizeRaw = Number(sizeParam);
  const size = Number.isFinite(sizeRaw) ? Math.min(600, Math.max(80, Math.floor(sizeRaw))) : 240;

  if (!data) {
    return new Response('Missing data', { status: 400 });
  }

  const colorParams = [
    fg ? `color=${encodeURIComponent(fg)}` : '',
    bg ? `bgcolor=${encodeURIComponent(bg)}` : '',
  ].filter(Boolean).join('&');
  const upstream = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}${colorParams ? `&${colorParams}` : ''}`;
  const res = await fetch(upstream);

  if (!res.ok) {
    return new Response('Upstream error', { status: 502 });
  }

  const body = await res.arrayBuffer();

  return new Response(body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
