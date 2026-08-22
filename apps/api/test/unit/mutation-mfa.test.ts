import type { TenantDatabase } from '@league/database';
import { z } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MfaEnrollmentRequiredError } from '../../src/common/errors.js';
import type { AccessService } from '../../src/services/access.service.js';
import { MutationService } from '../../src/services/mutation.service.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('MutationService privileged MFA gate', () => {
  it('fails before tenant discovery or authorization when required MFA is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('PRIVILEGED_MFA_REQUIRED', 'true');
    const database = { withTenant: vi.fn() } as unknown as TenantDatabase;
    const access = {} as AccessService;
    const service = new MutationService(database, access);

    await expect(
      service.execute({
        context: {
          organizationId: '00000000-0000-4000-8000-000000000001',
          user: {
            id: '00000000-0000-4000-8000-000000000002',
            email: 'admin@example.invalid',
            name: 'Unenrolled administrator',
            twoFactorEnabled: false,
          },
          metadata: { requestId: 'request-mfa-denial', source: 'WEB' },
          idempotencyKey: 'mfa-denial',
        },
        permission: 'season:create',
        fingerprintPayload: { name: 'Denied' },
        responseSchema: z.object({ ok: z.boolean() }),
        operation: vi.fn(),
      }),
    ).rejects.toBeInstanceOf(MfaEnrollmentRequiredError);
    expect(database.withTenant).not.toHaveBeenCalled();
  });
});
