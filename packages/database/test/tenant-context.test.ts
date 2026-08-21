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
