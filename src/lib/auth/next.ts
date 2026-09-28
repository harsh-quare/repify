/** Only same-origin relative paths. OAuth `next` is user-controlled. */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  return raw;
}

export function friendlyAuthError(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes('create an account first') ||
    lower.includes('reject_google') ||
    lower.includes('existing accounts')
  ) {
    return 'No Repify account for this Google login. Use Create account (Google or email) first.';
  }
  if (raw === 'Failed to fetch') {
    return 'Can’t reach the server. Check your connection and try again.';
  }
  return raw;
}

