import 'reflect-metadata';

import type { AuthenticatedUser } from '@league/auth';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants.js';
import { describe, expect, it, vi } from 'vitest';

import { PUBLIC_ROUTE } from '../../src/common/public.decorator.js';
import type { ApiRequest } from '../../src/common/request.js';
import {
  AuthenticatedOnboardingController,
  PlatformOnboardingController,
  PublicInvitationOnboardingController,
} from '../../src/controllers/api.controllers.js';
import type { OnboardingService } from '../../src/services/onboarding.service.js';

const invitationToken = 'x'.repeat(43);
const signedInUser: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000099',
  name: 'Synthetic Controller User',
  email: 'controller@example.invalid',
  twoFactorEnabled: true,
};

function request(user: AuthenticatedUser | null = signedInUser): ApiRequest {
  return {
    ...(user === null ? {} : { user }),
    requestId: 'controller-request',
    headers: { 'x-client-source': 'WEB' },
  } as unknown as ApiRequest;
}

function anonymousRequest(): ApiRequest {
  return request(null);
}

function onboardingMock() {
  const methods = {
    accept: vi.fn(),
    activate: vi.fn(),
    inspect: vi.fn(),
    listPlatformOnboarding: vi.fn(),
    provision: vi.fn(),
    register: vi.fn(),
    revoke: vi.fn(),
  };
  return { methods, service: methods as unknown as OnboardingService };
}

describe('onboarding controllers', () => {
  it('publishes invitation inspection and registration while keeping mutations authenticated', () => {
    expect(Reflect.getMetadata(PUBLIC_ROUTE, PublicInvitationOnboardingController)).toBe(true);
    expect(Reflect.getMetadata(PUBLIC_ROUTE, PlatformOnboardingController)).toBeUndefined();
    expect(Reflect.getMetadata(PUBLIC_ROUTE, AuthenticatedOnboardingController)).toBeUndefined();
    expect(
      Reflect.getMetadata(HTTP_CODE_METADATA, PlatformOnboardingController.prototype.provision),
    ).toBe(201);
    for (const handler of [
      PlatformOnboardingController.prototype.revoke,
      PublicInvitationOnboardingController.prototype.inspect,
      PublicInvitationOnboardingController.prototype.register,
      AuthenticatedOnboardingController.prototype.accept,
      AuthenticatedOnboardingController.prototype.activate,
    ]) {
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(200);
    }
  });

  it('validates and forwards platform operations with actor metadata and idempotency', async () => {
    const { methods, service } = onboardingMock();
    const controller = new PlatformOnboardingController(service);
    const input = {
      organizationName: '  Controller Organization  ',
      organizationSlug: 'controller-organization',
      timezone: 'America/New_York',
      leagueName: '  Controller League  ',
      leagueSlug: 'controller-league',
      administratorEmail: 'ADMINISTRATOR@EXAMPLE.INVALID',
      invitationExpiresInHours: 24,
      reason: '  Controller delegation verification.  ',
    };
    methods.provision.mockResolvedValue({ created: true });
    methods.listPlatformOnboarding.mockResolvedValue({
      canProvisionTenants: true,
      canRevokeInvitations: false,
      items: [],
    });
    methods.revoke.mockResolvedValue({ status: 'REVOKED' });

    await expect(controller.provision('controller-key', input, request())).resolves.toEqual({
      created: true,
    });
    expect(methods.provision).toHaveBeenCalledWith(
      {
        user: signedInUser,
        idempotencyKey: 'controller-key',
        metadata: { requestId: 'controller-request', source: 'WEB' },
      },
      {
        ...input,
        organizationName: 'Controller Organization',
        leagueName: 'Controller League',
        administratorEmail: 'administrator@example.invalid',
        reason: 'Controller delegation verification.',
      },
    );

    await expect(controller.list(request())).resolves.toEqual({
      canProvisionTenants: true,
      canRevokeInvitations: false,
      items: [],
    });
    expect(methods.listPlatformOnboarding).toHaveBeenCalledWith(signedInUser);
    await expect(
      controller.revoke(
        '00000000-0000-4000-8000-000000000123',
        'revoke-key',
        { expectedVersion: 1, reason: '  Superseded invitation.  ' },
        request(),
      ),
    ).resolves.toEqual({ status: 'REVOKED' });
    expect(methods.revoke).toHaveBeenCalledWith(
      {
        user: signedInUser,
        idempotencyKey: 'revoke-key',
        metadata: { requestId: 'controller-request', source: 'WEB' },
      },
      '00000000-0000-4000-8000-000000000123',
      { expectedVersion: 1, reason: 'Superseded invitation.' },
    );

    expect(() => controller.provision(undefined, input, request())).toThrowError(
      expect.objectContaining({ name: 'InvalidIdempotencyKeyError' }),
    );
    expect(() => controller.list(anonymousRequest())).toThrowError(
      expect.objectContaining({ name: 'AuthenticationRequiredError' }),
    );
  });

  it('locks registration address server-side and exposes identifiers only after activation', async () => {
    const { methods, service } = onboardingMock();
    const publicController = new PublicInvitationOnboardingController(service);
    const authenticatedController = new AuthenticatedOnboardingController(service);
    const acceptance = {
      accepted: true,
      membershipStatus: 'PENDING',
      mfaRequired: true,
      acceptedAt: '2026-08-24T12:00:00.000Z',
    };
    const activation = {
      items: [
        {
          organizationId: '00000000-0000-4000-8000-000000000001',
          membershipId: '00000000-0000-4000-8000-000000000002',
          membershipStatus: 'ACTIVE',
          activatedAt: '2026-08-24T12:05:00.000Z',
        },
      ],
    };
    methods.inspect.mockResolvedValue({ organizationName: 'Controller Organization' });
    methods.register.mockResolvedValue({ continueToSignIn: true });
    methods.accept.mockResolvedValue(acceptance);
    methods.activate.mockResolvedValue(activation);

    await publicController.inspect({ invitationToken }, anonymousRequest());
    expect(methods.inspect).toHaveBeenCalledWith(invitationToken, {
      requestId: 'controller-request',
      source: 'WEB',
    });
    await expect(
      publicController.register(
        {
          invitationToken,
          name: 'Invited Administrator',
          password: 'Invitation-Only-Password',
        },
        anonymousRequest(),
      ),
    ).resolves.toEqual({ continueToSignIn: true });
    expect(methods.register).toHaveBeenCalledWith(
      {
        invitationToken,
        name: 'Invited Administrator',
        password: 'Invitation-Only-Password',
      },
      { requestId: 'controller-request', source: 'WEB' },
    );
    expect(() =>
      publicController.register(
        {
          invitationToken,
          email: 'attacker@example.invalid',
          name: 'Invited Administrator',
          password: 'Invitation-Only-Password',
        },
        anonymousRequest(),
      ),
    ).toThrow();

    await expect(
      authenticatedController.accept('acceptance-key', { invitationToken }, request(signedInUser)),
    ).resolves.toEqual(acceptance);
    expect(methods.accept).toHaveBeenCalledWith(
      signedInUser,
      { requestId: 'controller-request', source: 'WEB' },
      'acceptance-key',
      { invitationToken },
    );
    expect(acceptance).not.toHaveProperty('organizationId');
    expect(acceptance).not.toHaveProperty('membershipId');

    await expect(authenticatedController.activate({}, request(signedInUser))).resolves.toEqual(
      activation,
    );
    expect(methods.activate).toHaveBeenCalledWith(signedInUser, {
      requestId: 'controller-request',
      source: 'WEB',
    });
    expect(activation.items[0]).toHaveProperty('organizationId');
    expect(activation.items[0]).toHaveProperty('membershipId');
    expect(() => authenticatedController.activate({ unexpected: true }, request())).toThrow();
    expect(() =>
      authenticatedController.accept(undefined, { invitationToken }, request()),
    ).toThrowError(expect.objectContaining({ name: 'InvalidIdempotencyKeyError' }));
  });
});
