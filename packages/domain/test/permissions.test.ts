import { describe, expect, it } from 'vitest';

import {
  hasPermission,
  permissions,
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
});

describe('request fingerprint', () => {
  it('is stable across object-key ordering', () => {
    expect(requestFingerprint({ b: 2, a: { d: 4, c: 3 } })).toBe(
      requestFingerprint({ a: { c: 3, d: 4 }, b: 2 }),
    );
  });
});
