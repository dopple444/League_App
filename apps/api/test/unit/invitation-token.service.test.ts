import { describe, expect, it } from 'vitest';

import { InvitationTokenService } from '../../src/services/invitation-token.service.js';

describe('InvitationTokenService', () => {
  it('derives stable opaque invitation bearers and stores only their digest', () => {
    const tokens = new InvitationTokenService('test-only-invitation-key-material-000000000000');
    const invitationA = '00000000-0000-4000-8000-000000000901';
    const invitationB = '00000000-0000-4000-8000-000000000902';

    const token = tokens.tokenFor(invitationA);
    expect(token).toHaveLength(43);
    expect(token).not.toContain(invitationA);
    expect(tokens.tokenFor(invitationA)).toBe(token);
    expect(tokens.tokenFor(invitationB)).not.toBe(token);
    expect(tokens.digest(token)).toMatch(/^[a-f0-9]{64}$/u);
    expect(tokens.digest(token)).not.toBe(token);
  });

  it('rejects weak key material', () => {
    expect(() => new InvitationTokenService('too-short')).toThrow(/at least 32/u);
  });
});
