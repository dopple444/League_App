import { describe, expect, it } from 'vitest';

import {
  acceptAdministratorInvitationSchema,
  activatePendingMembershipsSchema,
  administratorInvitationAcceptanceSchema,
  administratorInvitationContextSchema,
  administratorInvitationRegistrationSchema,
  inspectAdministratorInvitationSchema,
  onboardingActivationListSchema,
  openApiDocument,
  platformOnboardingListSchema,
  platformOnboardingSchema,
  provisionPlatformOnboardingResultSchema,
  provisionPlatformOnboardingSchema,
  registerAdministratorInvitationSchema,
  revokePlatformInvitationSchema,
  securityPostureSchema,
} from '../src/index.js';

const organizationId = '00000000-0000-4000-8000-000000000001';
const leagueId = '00000000-0000-4000-8000-000000000101';
const invitationId = '00000000-0000-4000-8000-000000000701';
const membershipId = '00000000-0000-4000-8000-000000000801';
const timestamp = '2026-08-24T12:00:00.000Z';
const invitationToken = 'opaque-invitation-bearer-value-1234567890';

const onboarding = {
  organizationId,
  organizationName: 'Meade County Demo',
  organizationSlug: 'meade-county-demo',
  timezone: 'America/New_York',
  leagueId,
  leagueName: 'Church Softball',
  leagueSlug: 'church-softball',
  invitationId,
  administratorEmail: 'administrator@example.invalid',
  status: 'PENDING' as const,
  expiresAt: '2026-08-31T12:00:00.000Z',
  acceptedAt: null,
  revokedAt: null,
  activatedAt: null,
  version: 1,
  createdAt: timestamp,
};

describe('controlled-beta platform onboarding contracts', () => {
  it('normalizes bounded provisioning input and rejects unknown or unsafe fields', () => {
    expect(
      provisionPlatformOnboardingSchema.parse({
        organizationName: '  Meade County Demo  ',
        organizationSlug: 'meade-county-demo',
        timezone: 'America/New_York',
        leagueName: '  Church Softball ',
        leagueSlug: 'church-softball',
        administratorEmail: '  ADMINISTRATOR@EXAMPLE.INVALID ',
        invitationExpiresInHours: 168,
        reason: '  Controlled synthetic beta onboarding  ',
      }),
    ).toEqual({
      organizationName: 'Meade County Demo',
      organizationSlug: 'meade-county-demo',
      timezone: 'America/New_York',
      leagueName: 'Church Softball',
      leagueSlug: 'church-softball',
      administratorEmail: 'administrator@example.invalid',
      invitationExpiresInHours: 168,
      reason: 'Controlled synthetic beta onboarding',
    });
    expect(
      provisionPlatformOnboardingSchema.safeParse({
        organizationName: 'Demo',
        organizationSlug: 'demo',
        timezone: 'America/New_York',
        leagueName: 'League',
        leagueSlug: 'league',
        administratorEmail: 'administrator@example.invalid',
        invitationExpiresInHours: 0,
        reason: 'Test',
      }).success,
    ).toBe(false);
    expect(
      provisionPlatformOnboardingSchema.safeParse({
        organizationName: 'Demo',
        organizationSlug: 'demo',
        timezone: 'America/New_York',
        leagueName: 'League',
        leagueSlug: 'league',
        administratorEmail: 'administrator@example.invalid',
        invitationExpiresInHours: 24,
        reason: 'Test',
        platformGrant: true,
      }).success,
    ).toBe(false);
  });

  it('keeps the copy-once bearer out of list and revoke DTOs', () => {
    expect(platformOnboardingSchema.parse(onboarding)).toEqual(onboarding);
    expect(
      platformOnboardingListSchema.parse({
        canProvisionTenants: true,
        canRevokeInvitations: false,
        items: [onboarding],
      }),
    ).toEqual({
      canProvisionTenants: true,
      canRevokeInvitations: false,
      items: [onboarding],
    });
    expect(
      platformOnboardingListSchema.safeParse({
        canProvisionTenants: true,
        items: [onboarding],
      }).success,
    ).toBe(false);
    expect(
      platformOnboardingListSchema.safeParse({
        canProvisionTenants: true,
        canRevokeInvitations: false,
        items: [onboarding],
        invitationToken,
      }).success,
    ).toBe(false);
    expect(platformOnboardingSchema.safeParse({ ...onboarding, invitationToken }).success).toBe(
      false,
    );
    expect(
      platformOnboardingSchema.safeParse({ ...onboarding, tokenDigest: 'digest' }).success,
    ).toBe(false);
    expect(
      provisionPlatformOnboardingResultSchema.parse({ ...onboarding, invitationToken }),
    ).toEqual({ ...onboarding, invitationToken });
    expect(
      revokePlatformInvitationSchema.parse({ expectedVersion: 1, reason: 'Invitation withdrawn' }),
    ).toEqual({ expectedVersion: 1, reason: 'Invitation withdrawn' });
    expect(
      revokePlatformInvitationSchema.safeParse({
        expectedVersion: 1,
        reason: 'Invitation withdrawn',
        invitationToken,
      }).success,
    ).toBe(false);
  });
});

describe('administrator invitation and MFA activation contracts', () => {
  it('accepts the opaque bearer only in JSON request bodies and returns allowlisted context', () => {
    expect(inspectAdministratorInvitationSchema.parse({ invitationToken })).toEqual({
      invitationToken,
    });
    expect(
      administratorInvitationContextSchema.parse({
        organizationName: onboarding.organizationName,
        leagueName: onboarding.leagueName,
        administratorEmailHint: 'a***@e***.invalid',
        expiresAt: onboarding.expiresAt,
      }),
    ).toEqual({
      organizationName: onboarding.organizationName,
      leagueName: onboarding.leagueName,
      administratorEmailHint: 'a***@e***.invalid',
      expiresAt: onboarding.expiresAt,
    });
    expect(
      administratorInvitationContextSchema.safeParse({
        organizationName: onboarding.organizationName,
        leagueName: onboarding.leagueName,
        administratorEmailHint: 'a***@e***.invalid',
        expiresAt: onboarding.expiresAt,
        organizationId,
      }).success,
    ).toBe(false);
  });

  it('registers without a caller-supplied address and uses one uniform continuation', () => {
    expect(
      registerAdministratorInvitationSchema.parse({
        invitationToken,
        name: '  Demo Administrator ',
        password: 'synthetic-password-only',
      }),
    ).toEqual({
      invitationToken,
      name: 'Demo Administrator',
      password: 'synthetic-password-only',
    });
    expect(
      registerAdministratorInvitationSchema.safeParse({
        invitationToken,
        name: 'Demo Administrator',
        email: 'attacker@example.invalid',
        password: 'synthetic-password-only',
      }).success,
    ).toBe(false);
    expect(administratorInvitationRegistrationSchema.parse({ continueToSignIn: true })).toEqual({
      continueToSignIn: true,
    });
  });

  it('models acceptance as pending and recovery-safe activation as an identity-owned list', () => {
    expect(acceptAdministratorInvitationSchema.parse({ invitationToken })).toEqual({
      invitationToken,
    });
    expect(
      administratorInvitationAcceptanceSchema.parse({
        accepted: true,
        membershipStatus: 'PENDING',
        mfaRequired: true,
        acceptedAt: timestamp,
      }),
    ).toMatchObject({ accepted: true, membershipStatus: 'PENDING', mfaRequired: true });
    expect(
      administratorInvitationAcceptanceSchema.safeParse({
        accepted: true,
        membershipStatus: 'PENDING',
        mfaRequired: true,
        acceptedAt: timestamp,
        organizationId,
      }).success,
    ).toBe(false);
    expect(activatePendingMembershipsSchema.parse({})).toEqual({});
    expect(activatePendingMembershipsSchema.safeParse({ organizationId }).success).toBe(false);
    expect(
      onboardingActivationListSchema.parse({
        items: [
          {
            organizationId,
            membershipId,
            membershipStatus: 'ACTIVE',
            activatedAt: timestamp,
          },
        ],
      }),
    ).toMatchObject({ items: [{ organizationId, membershipStatus: 'ACTIVE' }] });
  });

  it('extends security posture with identity-only platform and pending booleans', () => {
    expect(
      securityPostureSchema.parse({
        mfaEnabled: false,
        mfaRequired: true,
        platformAccess: false,
        pendingActivation: true,
      }),
    ).toEqual({
      mfaEnabled: false,
      mfaRequired: true,
      platformAccess: false,
      pendingActivation: true,
    });
    expect(securityPostureSchema.safeParse({ mfaEnabled: false, mfaRequired: true }).success).toBe(
      false,
    );
  });
});

describe('controlled-beta onboarding OpenAPI boundary', () => {
  it('publishes every onboarding operation without putting a bearer in a path or query', () => {
    const paths = openApiDocument.paths as Record<string, unknown>;
    expect(Object.keys(paths).some((route) => route.toLowerCase().includes('token'))).toBe(false);
    expect(paths['/api/v1/platform/onboarding']).toMatchObject({
      get: { operationId: 'listPlatformOnboarding' },
      post: { operationId: 'provisionPlatformOnboarding' },
    });
    expect(paths['/api/v1/platform/invitations/{invitationId}/revoke']).toMatchObject({
      post: { operationId: 'revokePlatformInvitation' },
    });
    expect(paths['/api/v1/onboarding/invitations/inspect']).toMatchObject({
      post: { operationId: 'inspectAdministratorInvitation', security: [] },
    });
    const activationPath = paths['/api/v1/onboarding/activations'] as {
      post: { operationId: string; parameters?: unknown };
    };
    expect(activationPath.post.operationId).toBe('activatePendingMemberships');
    expect(activationPath.post.parameters).toBeUndefined();
  });

  it('publishes post-MFA platform capabilities independently on the onboarding list', () => {
    const schemas = (openApiDocument.components as { schemas: Record<string, unknown> }).schemas;

    expect(schemas.PlatformOnboardingList).toMatchObject({
      additionalProperties: false,
      required: ['canProvisionTenants', 'canRevokeInvitations', 'items'],
      properties: {
        canProvisionTenants: { type: 'boolean' },
        canRevokeInvitations: { type: 'boolean' },
      },
    });
  });

  it('allows invitationToken in only three request schemas and the copy-once response', () => {
    const schemas = (openApiDocument.components as { schemas: Record<string, unknown> }).schemas;
    const schemasContainingBearer = Object.entries(schemas)
      .filter(([, schema]) => JSON.stringify(schema).includes('invitationToken'))
      .map(([name]) => name)
      .sort();

    expect(schemasContainingBearer).toEqual([
      'AcceptAdministratorInvitationInput',
      'InspectAdministratorInvitationInput',
      'ProvisionPlatformOnboardingResult',
      'RegisterAdministratorInvitationInput',
    ]);
    expect(JSON.stringify(openApiDocument)).not.toContain('tokenDigest');
  });
});
