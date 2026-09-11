export const AUTH_REDIRECT_CONTEXT_KEY = 'echotalent_auth_redirect_context_v1';

export type AuthRedirectContext = {
  nextPath: string;
  draftToken: string | null;
  termsAccepted: boolean;
  trainingConsent: boolean;
  policyVersion: string;
};

export function isSafeAuthNextPath(value: string | null | undefined) {
  return Boolean(value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\'));
}

export function readAuthRedirectContext(): AuthRedirectContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(AUTH_REDIRECT_CONTEXT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<AuthRedirectContext>;
    const nextPath = value.nextPath;
    if (!isSafeAuthNextPath(nextPath)) return null;
    return {
      nextPath,
      draftToken: typeof value.draftToken === 'string' ? value.draftToken : null,
      termsAccepted: value.termsAccepted === true,
      trainingConsent: value.trainingConsent === true,
      policyVersion: typeof value.policyVersion === 'string' ? value.policyVersion : 'v2026-05',
    };
  } catch {
    return null;
  }
}

export function clearAuthRedirectContext() {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(AUTH_REDIRECT_CONTEXT_KEY);
}
