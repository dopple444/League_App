import { afterEach, describe, expect, it } from 'vitest';

import { consumeInvitationBearer, invitationFragmentHref } from './invitation-bearer';

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('invitation bearer handoff', () => {
  it('consumes a fragment bearer and removes it from browser history', () => {
    window.history.replaceState(null, '', '/auth/accept-invite#token=synthetic%2Ebearer');

    expect(consumeInvitationBearer()).toBe('synthetic.bearer');
    expect(window.location.pathname).toBe('/auth/accept-invite');
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('');
  });

  it('never places the bearer in a path or query', () => {
    const href = invitationFragmentHref('/sign-in', 'synthetic/bearer?secret=yes');

    expect(href).toBe('/sign-in#token=synthetic%2Fbearer%3Fsecret%3Dyes');
    expect(new URL(href, 'https://league.example').pathname).toBe('/sign-in');
    expect(new URL(href, 'https://league.example').search).toBe('');
  });
});
