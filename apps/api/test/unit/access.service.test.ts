import type { AuthenticatedUser } from '@league/auth';
import type { TenantDatabase } from '@league/database';
import { describe, expect, it, vi } from 'vitest';

import { AccessService } from '../../src/services/access.service.js';

describe('AccessService organization summaries', () => {
  it('maps active and inactive league lifecycle state into the membership response', async () => {
    const organizationId = '00000000-0000-4000-8000-000000000001';
    const user: AuthenticatedUser = {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'League Administrator',
      email: 'admin@example.invalid',
    };
    const transaction = {
      organization: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          slug: 'meade-county-demo',
          name: 'Meade County Demo',
          timezone: 'America/New_York',
          leagues: [
            {
              id: '00000000-0000-4000-8000-000000000101',
              slug: 'active-league',
              name: 'Active League',
              active: true,
            },
            {
              id: '00000000-0000-4000-8000-000000000102',
              slug: 'inactive-league',
              name: 'Inactive League',
              active: false,
            },
          ],
        }),
      },
      organizationMembership: {
        findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', roleAssignments: [] }),
      },
    };
    const database = {
      listOrganizationIdsForUser: vi.fn().mockResolvedValue([organizationId]),
      withTenant: vi.fn(
        async (_context: unknown, operation: (value: typeof transaction) => Promise<unknown>) =>
          operation(transaction),
      ),
    } as unknown as TenantDatabase;

    const result = await new AccessService(database).listOrganizations(user, {
      requestId: 'request-access-summary',
      source: 'WEB',
    });

    expect(result.items[0]?.leagues).toEqual([
      {
        leagueId: '00000000-0000-4000-8000-000000000101',
        slug: 'active-league',
        name: 'Active League',
        active: true,
      },
      {
        leagueId: '00000000-0000-4000-8000-000000000102',
        slug: 'inactive-league',
        name: 'Inactive League',
        active: false,
      },
    ]);
  });
});
