import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const claimSchema = z.object({
  accessToken: z.string().min(10),
  draftToken: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  try {
    const body = claimSchema.parse(await req.json());
    const supabaseAdmin = getSupabaseAdminClient();
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(body.accessToken);
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Invalid user token' }, { status: 401 });
    }

    const user = authData.user;
    const { data, error } = await supabaseAdmin.rpc('claim_anonymous_career_draft', {
      p_user_id: user.id,
      p_draft_token: body.draftToken,
    });

    if (error) {
      if (error.message.includes('draft_not_found')) {
        return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
      }
      if (error.message.includes('draft_already_claimed')) {
        return NextResponse.json({ error: 'Draft already claimed' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(data || { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to claim draft';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
