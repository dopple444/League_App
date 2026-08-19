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
});
