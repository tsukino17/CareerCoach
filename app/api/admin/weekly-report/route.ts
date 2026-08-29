import { NextResponse } from 'next/server';
import { getSupabaseAdminClient, isLocalAdminRequest, requireAdmin } from '@/lib/admin-auth';
import { isAllowedOrigin } from '@/lib/request-security';
import { buildWeeklyReport, renderWeeklyReportHtml, renderWeeklyReportText } from '@/lib/weekly-report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`);
}

function canAccessReport(req: Request) {
  return isCron(req) || isLocalAdminRequest(req);
}

export async function sendReport(report: Awaited<ReturnType<typeof buildWeeklyReport>>, title = '网站周报') {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ANALYTICS_REPORT_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;
  const to = process.env.ANALYTICS_REPORT_TO_EMAIL || process.env.ADMIN_EMAILS?.split(',')[0]?.trim();
  if (!apiKey || !from || !to) throw new Error('weekly_report_email_not_configured');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject: `EchoTalent ${title} ${report.period.start} 至 ${report.period.end}`, html: renderWeeklyReportHtml(report, title), text: renderWeeklyReportText(report, title) }),
  });
  if (!response.ok) throw new Error(`weekly_report_email_failed_${response.status}`);
}

export async function GET(req: Request) {
  try {
    const cronRequest = isCron(req);
    if (!canAccessReport(req)) return NextResponse.json({ error: 'Local admin access required' }, { status: 403 });
    if (!cronRequest && !isAllowedOrigin(req)) return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    if (!cronRequest) await requireAdmin(req);
    const report = await buildWeeklyReport(getSupabaseAdminClient());
    if (cronRequest) {
      await sendReport(report);
      return NextResponse.json({ ok: true, sent: true, period: report.period });
    }
    return NextResponse.json({ ok: true, report, text: renderWeeklyReportText(report) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'weekly_report_failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!canAccessReport(req)) return NextResponse.json({ error: 'Local admin access required' }, { status: 403 });
    if (!isCron(req)) {
      if (!isAllowedOrigin(req)) return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
      await requireAdmin(req);
    }
    const report = await buildWeeklyReport(getSupabaseAdminClient());
    await sendReport(report);
    return NextResponse.json({ ok: true, period: report.period });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'weekly_report_send_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
