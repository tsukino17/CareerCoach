import type { SupabaseClient, User } from '@supabase/supabase-js';

export type AvatarPalette = {
  id: string;
  background: string;
  accent: string;
  shadow: string;
};

const PREFIXES = [
  '月', '星', '云', '春', '安', '暖', '小', '听', '晨', '森', '桃', '灯', '轻', '禾',
];

const SUFFIXES = [
  '芽', '雾', '桥', '栖', '宁', '羽', '风', '桃', '棠', '星', '语', '铃', '夏', '糯',
];

export const AVATAR_PALETTES: AvatarPalette[] = [
  {
    id: 'mint-sky',
    background: 'linear-gradient(135deg, #A7F3D0 0%, #93C5FD 100%)',
    accent: '#0f766e',
    shadow: '0 12px 30px rgba(125, 211, 252, 0.28)',
  },
  {
    id: 'peach-bloom',
    background: 'linear-gradient(135deg, #FBCFE8 0%, #FDBA74 100%)',
    accent: '#9a3412',
    shadow: '0 12px 30px rgba(251, 191, 36, 0.22)',
  },
  {
    id: 'lavender-breeze',
    background: 'linear-gradient(135deg, #C4B5FD 0%, #93C5FD 100%)',
    accent: '#5b21b6',
    shadow: '0 12px 30px rgba(167, 139, 250, 0.24)',
  },
];

function hashString(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function createWarmNickname(seed: string) {
  const hash = hashString(seed);
  const first = PREFIXES[hash % PREFIXES.length];
  const second = SUFFIXES[Math.floor(hash / PREFIXES.length) % SUFFIXES.length];
  const thirdChance = hash % 5;

  if (thirdChance === 0) {
    const extra = SUFFIXES[Math.floor(hash / 7) % SUFFIXES.length];
    return `${first}${second}${extra}`;
  }

  return `${first}${second}`;
}

export function pickAvatarPalette(seed: string) {
  const hash = hashString(seed);
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
}

export async function ensureUserProfile(
  supabase: SupabaseClient,
  user: User | null,
  options?: {
    termsAccepted?: boolean;
    trainingConsent?: boolean;
    policyVersion?: string;
  }
) {
  if (!user) return null;

  const { data: existing, error: fetchError } = await supabase
    .from('user_profiles')
    .select('user_id, display_name, avatar_url, terms_accepted, terms_accepted_at, privacy_commitment_version, data_training_consent, data_training_consent_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existing?.display_name && existing?.avatar_url && existing?.terms_accepted !== undefined && existing?.data_training_consent !== undefined) {
    return existing;
  }

  const palette = pickAvatarPalette(user.id);
  const nowIso = new Date().toISOString();
  const termsAccepted = existing?.terms_accepted ?? options?.termsAccepted ?? false;
  const trainingConsent = existing?.data_training_consent ?? options?.trainingConsent ?? false;
  const profile = {
    user_id: user.id,
    display_name: existing?.display_name || createWarmNickname(user.id),
    avatar_url: existing?.avatar_url || `gradient:${palette.id}`,
    terms_accepted: termsAccepted,
    terms_accepted_at: existing?.terms_accepted_at || (termsAccepted ? nowIso : null),
    privacy_commitment_version: existing?.privacy_commitment_version || options?.policyVersion || 'v2026-05',
    data_training_consent: trainingConsent,
    data_training_consent_at: existing?.data_training_consent_at || (trainingConsent ? nowIso : null),
  };

  const { data: upserted, error: upsertError } = await supabase
    .from('user_profiles')
    .upsert(profile, { onConflict: 'user_id' })
    .select('user_id, display_name, avatar_url')
    .single();

  if (upsertError) throw upsertError;
  return upserted;
}
