import { describe, expect, it, vi } from 'vitest';

import { TenantDatabase, type PrismaClient } from '../src/index.js';

describe('TenantDatabase', () => {
  it('sets transaction-local context before invoking repository work', async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    const transaction = { $executeRaw: executeRaw };
    const client = {
      $transaction: vi.fn(async (callback: (value: unknown) => Promise<unknown>) =>
        callback(transaction),
      ),
    } as unknown as PrismaClient;
    const database = new TenantDatabase(client);
    const operation = vi.fn().mockResolvedValue('ok');

    await expect(
      database.withTenant(
        {
          organizationId: '00000000-0000-4000-8000-000000000001',
          userId: '00000000-0000-4000-8000-000000000010',
          requestId: 'request-1',
          source: 'API',
        },
        operation,
      ),
    ).resolves.toBe('ok');

    expect(executeRaw).toHaveBeenCalledOnce();
    expect(operation).toHaveBeenCalledWith(transaction);
    expect(executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      operation.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('discovers only bounded due-organization identifiers', async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValue([
        { organization_id: '00000000-0000-4000-8000-000000000001' },
        { organization_id: '00000000-0000-4000-8000-000000000002' },
      ]);
    const client = { $queryRaw: queryRaw } as unknown as PrismaClient;
    const database = new TenantDatabase(client);

    await expect(database.listDueOutboxOrganizationIds(25)).resolves.toEqual([
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
    ]);
    expect(queryRaw).toHaveBeenCalledOnce();
    await expect(database.listDueOutboxOrganizationIds(0)).rejects.toBeInstanceOf(RangeError);
    await expect(database.listDueOutboxOrganizationIds(501)).rejects.toBeInstanceOf(RangeError);
  });

  it('keeps pending membership and platform discovery behind current-user context', async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ organization_id: '00000000-0000-4000-8000-000000000001' }])
      .mockResolvedValueOnce([{ allowed: true }])
      .mockResolvedValueOnce([
        {
          organization_id: '00000000-0000-4000-8000-000000000001',
          organization_slug: 'synthetic-organization',
          organization_name: 'Synthetic Organization',
          organization_timezone: 'America/New_York',
          league_id: '00000000-0000-4000-8000-000000000101',
          league_slug: 'synthetic-league',
          league_name: 'Synthetic League',
          invitation_id: '00000000-0000-4000-8000-000000000201',
          administrator_email: 'invitee@example.invalid',
          invitation_expires_at: new Date('2026-08-25T00:00:00.000Z'),
          invitation_accepted_at: null,
          invitation_revoked_at: null,
          invitation_activated_at: null,
          invitation_version: 1,
          invitation_created_at: new Date('2026-08-24T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([{ organization_id: '00000000-0000-4000-8000-000000000001' }]);
    const transaction = { $executeRaw: executeRaw, $queryRaw: queryRaw };
    const client = {
      $transaction: vi.fn(async (callback: (value: unknown) => Promise<unknown>) =>
        callback(transaction),
      ),
    } as unknown as PrismaClient;
    const database = new TenantDatabase(client);
    const userId = '00000000-0000-4000-8000-000000000010';

    await expect(database.listPendingMembershipOrganizationIds(userId)).resolves.toEqual([
      '00000000-0000-4000-8000-000000000001',
    ]);
    await expect(database.hasPlatformPermission(userId, 'TENANT_PROVISION')).resolves.toBe(true);
    await expect(database.listPlatformOnboarding(userId)).resolves.toEqual([
      expect.objectContaining({
        organizationId: '00000000-0000-4000-8000-000000000001',
        invitationId: '00000000-0000-4000-8000-000000000201',
        administratorEmail: 'invitee@example.invalid',
      }),
    ]);
    await expect(
      database.resolvePlatformInvitationOrganization(
        userId,
        '00000000-0000-4000-8000-000000000201',
      ),
    ).resolves.toBe('00000000-0000-4000-8000-000000000001');

    expect(executeRaw).toHaveBeenCalledTimes(4);
    expect(queryRaw).toHaveBeenCalledTimes(4);
  });

  it('resolves an invitation digest to only its tenant identifier', async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValue([{ organization_id: '00000000-0000-4000-8000-000000000001' }]);
    const client = { $queryRaw: queryRaw } as unknown as PrismaClient;
    const database = new TenantDatabase(client);

    await expect(database.resolveAdministratorInvitationOrganization('a'.repeat(64))).resolves.toBe(
      '00000000-0000-4000-8000-000000000001',
    );
    expect(queryRaw).toHaveBeenCalledOnce();
  });

  it('normalizes aggregate outbox health without exposing tenant event data', async () => {
    const queryRaw = vi.fn().mockResolvedValue([
      {
        pending_count: 2n,
        processing_count: '1',
        failed_count: 0,
        oldest_due_seconds: '3.5',
      },
    ]);
    const client = { $queryRaw: queryRaw } as unknown as PrismaClient;
    const database = new TenantDatabase(client);

    await expect(database.outboxRelayHealth()).resolves.toEqual({
      failed: 0,
      oldestDueSeconds: 3.5,
      pending: 2,
      processing: 1,
    });
  });
});
