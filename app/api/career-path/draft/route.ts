import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/admin-auth';
import { buildPathMapPreview, createDraftSummary } from '@/lib/career-path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const draftSchema = z.object({
  draftToken: z.string().min(8).max(200),
  report: z.object({
    archetype: z.string(),
    skills: z.array(z.string()).default([]),
    rpg_stats: z.array(z.object({ name: z.string(), value: z.number() })).optional(),
    superpowers: z.array(
      z.union([
        z.string(),
        z.object({
          name: z.string(),
          description: z.string(),
          potential_roles: z.array(z.string()).optional(),
        }),
      ])
    ),
    summary: z.string(),
    target_roles: z.array(z.string()).optional(),
  }),
  messages: z
    .array(
      z.object({
        id: z.string().optional(),
        role: z.string(),
        content: z.string(),
      })
    )
    .default([]),
});

export async function POST(req: Request) {
  try {
    const body = draftSchema.parse(await req.json());
    const supabaseAdmin = getSupabaseAdminClient();
    const preview = buildPathMapPreview(body.report);
    const summary = createDraftSummary(body.report, preview);

    const { error } = await supabaseAdmin.from('anonymous_career_drafts').upsert(
      {
        draft_token: body.draftToken,
        source: 'chat_report',
        conversation_json: body.messages,
        report_json: body.report,
        report_summary_json: summary,
        preview_json: preview,
      },
      { onConflict: 'draft_token' }
    );

    if (error) throw error;
    return NextResponse.json({ ok: true, preview, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save draft';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
