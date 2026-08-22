import { describe, expect, it, vi } from 'vitest';

import { waitForDatabaseReadiness } from '../scripts/wait-for-database.js';

function codedError(code: string): Error & { readonly code: string } {
  return Object.assign(new Error(`Synthetic database error ${code}`), { code });
}

describe('database readiness', () => {
  it('retries transient connection failures and stops after the first successful probe', async () => {
    const failures = [codedError('ECONNREFUSED'), codedError('57P03')];
    const probe = vi.fn(async () => {
      const failure = failures.shift();
      if (failure !== undefined) throw failure;
    });
    const sleep = vi.fn(async () => undefined);

    await expect(
      waitForDatabaseReadiness(probe, { maxAttempts: 5, retryDelayMs: 250, sleep }),
    ).resolves.toBeUndefined();

    expect(probe).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 250);
    expect(sleep).toHaveBeenNthCalledWith(2, 250);
  });

  it('fails with the final transient error as its cause after exhausting the bound', async () => {
    const finalFailure = codedError('08006');
    const probe = vi.fn(async () => {
      throw finalFailure;
    });
    const sleep = vi.fn(async () => undefined);

    await expect(
      waitForDatabaseReadiness(probe, { maxAttempts: 3, retryDelayMs: 100, sleep }),
    ).rejects.toMatchObject({
      cause: finalFailure,
      message: 'Database did not become ready after 3 transient connection attempts.',
    });

    expect(probe).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it.each(['28P01', '42601'])(
    'fails fast for the non-transient authentication or SQL error %s',
    async (code) => {
      const failure = codedError(code);
      const probe = vi.fn(async () => {
        throw failure;
      });
      const sleep = vi.fn(async () => undefined);

      await expect(
        waitForDatabaseReadiness(probe, { maxAttempts: 5, retryDelayMs: 100, sleep }),
      ).rejects.toBe(failure);

      expect(probe).toHaveBeenCalledOnce();
      expect(sleep).not.toHaveBeenCalled();
    },
  );
});
