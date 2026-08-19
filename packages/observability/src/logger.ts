import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  readonly requestId: string;
  readonly organizationId?: string;
  readonly userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

const sensitiveKey =
  /authorization|cookie|token|secret|password|signature|waiver|email|phone|dateOfBirth|dob/i;

function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => redact(entry, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      sensitiveKey.test(key) ? '[REDACTED]' : redact(entry, seen),
    ]),
  );
}

export function withRequestContext<TResult>(
  context: RequestContext,
  operation: () => TResult,
): TResult {
  return storage.run(context, operation);
}

export function currentRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogSink = (line: string) => void;

export class JsonLogger {
  constructor(private readonly sink: LogSink = console.log) {}

  log(level: LogLevel, message: string, attributes: Readonly<Record<string, unknown>> = {}): void {
    const safeAttributes = redact(attributes) as Record<string, unknown>;
    this.sink(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        ...currentRequestContext(),
        ...safeAttributes,
      }),
    );
  }
}
