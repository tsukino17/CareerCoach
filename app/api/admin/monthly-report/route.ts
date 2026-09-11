import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, isLocalAdminRequest, requireAdmin } from '@/lib/admin-auth';
import { isAllowedOrigin } from '@/lib/request-security';
import { buildMonthlyReport } from '@/lib/weekly-report';
import { sendReport } from '@/app/api/admin/weekly-report/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`);
}

async function handle(req: Request) {
  const cronRequest = isCron(req);
  if (!cronRequest && !isLocalAdminRequest(req)) return NextResponse.json({ error: 'Local admin access required' }, { status: 403 });
  if (!cronRequest && !isAllowedOrigin(req)) return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
  if (!cronRequest) await requireAdmin(req);
  const report = await buildMonthlyReport(getSupabaseAdminClient());
  await sendReport(report, '网站月报');
  return NextResponse.json({ ok: true, sent: true, period: report.period });
}

export async function GET(req: Request) {
  try { return await handle(req); } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'monthly_report_failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
