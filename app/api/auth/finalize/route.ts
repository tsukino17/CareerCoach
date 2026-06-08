import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

type FinalizePayload = {
  termsAccepted?: boolean;
  trainingConsent?: boolean;
  policyVersion?: string;
  draftToken?: string | null;
};

function buildProfileSeed(userId: string) {
  const prefixes = ['月', '星', '云', '春', '安', '暖', '小', '听', '晨', '森', '桃', '灯', '轻', '禾'];
  const suffixes = ['芽', '雾', '桥', '栖', '宁', '羽', '风', '桃', '棠', '星', '语', '铃', '夏', '糯'];
  const palettes = ['mint-sky', 'peach-bloom', 'lavender-breeze'];

  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  hash = Math.abs(hash);

  return {
    displayName: `${prefixes[hash % prefixes.length]}${suffixes[Math.floor(hash / prefixes.length) % suffixes.length]}`,
    avatarUrl: `gradient:${palettes[hash % palettes.length]}`,
  };
}

export async function POST(request: Request) {
  try {
    const authorizationHeader = request.headers.get('authorization');
    const token = authorizationHeader?.replace('Bearer ', '').trim();
    if (!token) {
      return NextResponse.json({ error: 'missing_token' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as FinalizePayload;
    const {
      termsAccepted = false,
      trainingConsent = false,
      policyVersion = 'v2026-05',
      draftToken = null,
    } = body;

    const supabaseAdmin = getSupabaseAdminClient();
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'invalid_user' }, { status: 401 });
    }

    const { displayName, avatarUrl } = buildProfileSeed(user.id);
    const now = new Date().toISOString();

    const { data: existing } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, display_name, avatar_url, terms_accepted, terms_accepted_at, privacy_commitment_version, data_training_consent, data_training_consent_at')
      .eq('user_id', user.id)
      .maybeSingle();

    const finalTermsAccepted = existing?.terms_accepted ?? termsAccepted;
    const finalTrainingConsent = existing?.data_training_consent ?? trainingConsent;

    const { error: upsertError } = await supabaseAdmin
      .from('user_profiles')
      .upsert(
        {
          user_id: user.id,
          display_name: existing?.display_name || displayName,
          avatar_url: existing?.avatar_url || avatarUrl,
          terms_accepted: finalTermsAccepted,
          terms_accepted_at: existing?.terms_accepted_at || (finalTermsAccepted ? now : null),
          privacy_commitment_version: existing?.privacy_commitment_version || policyVersion,
          data_training_consent: finalTrainingConsent,
          data_training_consent_at: existing?.data_training_consent_at || (finalTrainingConsent ? now : null),
        },
        { onConflict: 'user_id' },
      );

    if (upsertError) {
      return NextResponse.json({ error: 'profile_upsert_failed' }, { status: 500 });
    }

    const profileWasCreated = !existing;
    await supabaseAdmin.from('analytics_events').insert({
      user_id: user.id,
      event_name: 'auth_finalize',
      step: 'email_login',
      status: profileWasCreated ? 'registered' : 'logged_in',
      metadata: {
        emailDomain: user.email?.split('@')[1]?.toLowerCase() || null,
        termsAccepted: finalTermsAccepted,
        trainingConsent: finalTrainingConsent,
        draftClaimed: Boolean(draftToken),
      },
      user_agent: request.headers.get('user-agent') || null,
    });

    if (draftToken) {
      const { data: draft } = await supabaseAdmin
        .from('anonymous_career_drafts')
        .select('id, claimed_by_user_id')
        .eq('draft_token', draftToken)
        .maybeSingle();

      if (draft && !draft.claimed_by_user_id) {
        await supabaseAdmin
          .from('anonymous_career_drafts')
          .update({
            claimed_by_user_id: user.id,
            claimed_at: now,
          })
          .eq('id', draft.id);
      }
    }

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (error) {
    console.error('Finalize auth failed', error);
    return NextResponse.json({ error: 'finalize_failed' }, { status: 500 });
  }
}
