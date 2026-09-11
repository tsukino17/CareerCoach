import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminPage = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminApi = pathname.startsWith('/api/admin/');
  const hostname = req.nextUrl.hostname.toLowerCase();
  const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(hostname);
  const isCronReport = (pathname === '/api/admin/weekly-report' || pathname === '/api/admin/monthly-report')
    && Boolean(process.env.CRON_SECRET)
    && req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  if ((isAdminPage || isAdminApi) && !isLocalhost && !isCronReport) {
    return new NextResponse('Not Found', { status: 404 });
  }
  if (pathname === '/user' || pathname === '/user/') {
    const url = req.nextUrl.clone();
    url.pathname = '/user-center';
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/user', '/user/', '/admin/:path*', '/api/admin/:path*'],
};
