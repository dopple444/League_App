const FRAGMENT_KEYS = ['token', 'invitation'] as const;

const browserLocationWithoutFragment = (): string =>
  `${window.location.pathname}${window.location.search}`;

/**
 * Reads an invitation bearer from the URL fragment and removes the fragment before returning.
 * Fragments never reach the gateway, while immediate replacement keeps the bearer out of later
 * browser navigation and screenshots. Callers must keep the returned value in component memory.
 */
export function consumeInvitationBearer(): string | null {
  if (typeof window === 'undefined') return null;

  const fragment = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  window.history.replaceState(window.history.state, '', browserLocationWithoutFragment());
  if (!fragment) return null;

  const parameters = new URLSearchParams(fragment);
  const bearer = FRAGMENT_KEYS.map((key) => parameters.get(key)).find(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0,
  );
  return bearer?.trim() || null;
}

export function invitationFragmentHref(path: string, bearer: string): string {
  return `${path}#token=${encodeURIComponent(bearer)}`;
}
