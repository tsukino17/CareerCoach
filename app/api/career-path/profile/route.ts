import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  accessToken: z.string().min(10),
});

export async function POST(req: Request) {
  try {
    const body = requestSchema.parse(await req.json());
    const supabaseAdmin = getSupabaseAdminClient();
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(body.accessToken);
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Invalid user token' }, { status: 401 });
    }

    const user = authData.user;
    const { data: contextProfile, error: contextError } = await supabaseAdmin
      .from('user_context_profiles')
      .select('talent_profile_id, current_snapshot, source_draft_token, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (contextError) throw contextError;
    if (!contextProfile) {
      return NextResponse.json({ profile: null });
    }

    let talentProfile = null;
    if (contextProfile.talent_profile_id) {
      const { data: talentData, error: talentError } = await supabaseAdmin
        .from('talent_profiles')
        .select('id, archetype, transferable_skills, recommended_roles, profile_json, created_at')
        .eq('id', contextProfile.talent_profile_id)
        .maybeSingle();
      if (talentError) throw talentError;
      talentProfile = talentData;
    }

    return NextResponse.json({
      profile: {
        context: contextProfile,
        talentProfile,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load career path profile';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
