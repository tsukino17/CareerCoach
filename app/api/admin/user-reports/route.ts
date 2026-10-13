import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { isAllowedOrigin } from '@/lib/request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DraftRow = {
  draft_token: string;
  source: string;
  conversation_json: unknown;
  report_json: unknown;
  report_summary_json: unknown;
  preview_json: unknown;
  created_at: string;
};

type MessageInDraft = { role?: string; content?: string };

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : '';
  return code === '42P01' || /could not find the table|does not exist|schema cache/i.test(message);
}

function extractFirstUserMessage(conversationJson: unknown): string {
  if (!Array.isArray(conversationJson)) return '';
  for (const msg of conversationJson as MessageInDraft[]) {
    if (msg?.role === 'user' && typeof msg.content === 'string' && msg.content.trim()) {
      return msg.content.trim().slice(0, 200);
    }
  }
  return '';
}

export async function GET(req: Request) {
  try {
    if (!isAllowedOrigin(req)) {
      return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    }
    const { supabaseAdmin } = await requireAdmin(req);
    const url = new URL(req.url);
    const userId = url.searchParams.get('user_id')?.trim();

    // 查询所有 career drafts
    const { data: draftsData, error: draftError } = await supabaseAdmin
      .from('anonymous_career_drafts')
      .select('draft_token, source, conversation_json, report_json, report_summary_json, preview_json, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (draftError && !isMissingTableError(draftError)) throw draftError;
    const drafts = (draftError ? [] : draftsData || []) as DraftRow[];

    // 收集每个 draft 的首条用户消息作为指纹
    const draftFingerprints = drafts.map((d) => ({
      draft: d,
      fingerprint: extractFirstUserMessage(d.conversation_json),
    }));

    // 如果指定了 user_id，尝试通过消息内容匹配
    let matchedDrafts: DraftRow[] = [];
    if (userId && draftFingerprints.length > 0) {
      // 查询该用户的消息
      const { data: userConvos, error: convError } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('user_id', userId);

      if (!convError && userConvos && userConvos.length > 0) {
        const convIds = userConvos.map((c) => c.id);
        const { data: userMessages, error: msgError } = await supabaseAdmin
          .from('messages')
          .select('content, role')
          .in('conversation_id', convIds)
          .eq('role', 'user')
          .order('created_at', { ascending: true })
          .limit(50);

        if (!msgError && userMessages) {
          const userMsgContents = (userMessages as { content: string }[]).map((m) => m.content?.trim().slice(0, 200));
          // 匹配：draft 的首条用户消息和该用户的任一消息内容匹配
          matchedDrafts = draftFingerprints
            .filter((df) => df.fingerprint && userMsgContents.some((umc) => umc && (umc === df.fingerprint || umc.includes(df.fingerprint) || df.fingerprint.includes(umc))))
            .map((df) => df.draft);
        }
      }
    }

    // 如果未指定 user_id，返回所有 drafts 的摘要
    const result = (matchedDrafts.length > 0 ? matchedDrafts : drafts).map((d) => ({
      draft_token: d.draft_token,
      source: d.source,
      created_at: d.created_at,
      report: d.report_json,
      summary: d.report_summary_json,
      preview: d.preview_json,
      first_user_message: extractFirstUserMessage(d.conversation_json),
    }));

    return NextResponse.json({
      ok: true,
      reports: result,
      matched: userId ? matchedDrafts.length > 0 : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load user reports';
    const status = /forbidden|authorization|token/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
