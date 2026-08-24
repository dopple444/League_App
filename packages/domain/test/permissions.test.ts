import { describe, expect, it } from 'vitest';

import {
  hasPermission,
  leagueAdministratorPermissions,
  permissions,
  platformPermissions,
  requestFingerprint,
  type AuthorizationContext,
} from '../src/index.js';

const evaluatedAt = new Date('2026-08-16T12:00:00.000Z');

function context(overrides: Partial<AuthorizationContext> = {}): AuthorizationContext {
  return {
    organizationId: 'org-a',
    userId: 'user-a',
    evaluatedAt,
    roles: [],
    ...overrides,
  };
}

describe('permission policy', () => {
  it('keeps administrator and platform permission templates explicit', () => {
    expect(new Set(leagueAdministratorPermissions)).toEqual(new Set(Object.values(permissions)));
    expect(platformPermissions).toEqual({
      tenantProvision: 'TENANT_PROVISION',
      invitationRevoke: 'INVITATION_REVOKE',
    });
  });

  it('keeps board authority separate from officer permissions', () => {
    const boardOnly = context({
      roles: [
        {
          roleId: 'board',
          authorityKind: 'BOARD',
          permissions: [permissions.auditRead],
          validFrom: new Date('2026-01-01T00:00:00.000Z'),
          expiresAt: null,
          revokedAt: null,
        },
      ],
    });

    expect(hasPermission(boardOnly, permissions.auditRead)).toBe(true);
    expect(hasPermission(boardOnly, permissions.seasonCreate)).toBe(false);
    expect(hasPermission(boardOnly, permissions.venueRead)).toBe(false);
  });

  it('ignores revoked and expired roles', () => {
    const inactive = context({
      roles: [
        {
          roleId: 'revoked',
          authorityKind: 'OFFICER',
          permissions: [permissions.seasonCreate],
          validFrom: new Date('2026-01-01T00:00:00.000Z'),
          expiresAt: null,
          revokedAt: new Date('2026-08-15T00:00:00.000Z'),
        },
        {
          roleId: 'expired',
          authorityKind: 'OFFICER',
          permissions: [permissions.seasonCreate],
          validFrom: new Date('2025-01-01T00:00:00.000Z'),
          expiresAt: new Date('2026-08-16T12:00:00.000Z'),
          revokedAt: null,
        },
      ],
    });

    expect(hasPermission(inactive, permissions.seasonCreate)).toBe(false);
  });

  it('keeps facility permissions independently assignable', () => {
    const facilityReader = context({
      roles: [
        {
          roleId: 'facility-reader',
          authorityKind: 'OPERATIONS',
          permissions: [permissions.venueRead],
          validFrom: new Date('2026-01-01T00:00:00.000Z'),
          expiresAt: null,
          revokedAt: null,
        },
      ],
    });

    expect(hasPermission(facilityReader, permissions.venueRead)).toBe(true);
    expect(hasPermission(facilityReader, permissions.venueCreate)).toBe(false);
    expect(hasPermission(facilityReader, permissions.fieldCreate)).toBe(false);
  });

  it('keeps league read and mutation permissions independently assignable', () => {
    const leagueReader = context({
      roles: [
        {
          roleId: 'league-reader',
          authorityKind: 'OPERATIONS',
          permissions: [permissions.leagueRead],
          validFrom: new Date('2026-01-01T00:00:00.000Z'),
          expiresAt: null,
          revokedAt: null,
        },
      ],
    });

    expect(hasPermission(leagueReader, permissions.leagueRead)).toBe(true);
    expect(hasPermission(leagueReader, permissions.leagueCreate)).toBe(false);
    expect(hasPermission(leagueReader, permissions.leagueUpdate)).toBe(false);
  });
});

describe('request fingerprint', () => {
  it('is stable across object-key ordering', () => {
    expect(requestFingerprint({ b: 2, a: { d: 4, c: 3 } })).toBe(
      requestFingerprint({ a: { c: 3, d: 4 }, b: 2 }),
    );
  });
});
