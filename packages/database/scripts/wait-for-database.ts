const transientNetworkCodes = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ETIMEDOUT',
]);

interface CodedError {
  readonly code?: unknown;
}

export interface DatabaseReadinessOptions {
  readonly maxAttempts: number;
  readonly retryDelayMs: number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  const code = (error as CodedError).code;
  return typeof code === 'string' ? code : undefined;
}

export function isTransientDatabaseConnectionError(error: unknown): boolean {
  const code = errorCode(error);
  return (
    code !== undefined &&
    (transientNetworkCodes.has(code) || code.startsWith('08') || code === '57P03')
  );
}

export async function waitForDatabaseReadiness(
  probe: () => Promise<void>,
  options: DatabaseReadinessOptions,
): Promise<void> {
  if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1) {
    throw new RangeError('Database readiness maxAttempts must be a positive integer.');
  }
  if (!Number.isFinite(options.retryDelayMs) || options.retryDelayMs < 0) {
    throw new RangeError('Database readiness retryDelayMs must be a non-negative number.');
  }

  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolvePromise) => setTimeout(resolvePromise, milliseconds)));

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      await probe();
      return;
    } catch (error) {
      if (!isTransientDatabaseConnectionError(error)) throw error;
      if (attempt === options.maxAttempts) {
        throw new Error(
          `Database did not become ready after ${options.maxAttempts} transient connection attempts.`,
          { cause: error },
        );
      }
      await sleep(options.retryDelayMs);
    }
  }
}
