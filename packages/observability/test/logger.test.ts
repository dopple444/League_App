import { describe, expect, it } from 'vitest';

import { JsonLogger, withRequestContext } from '../src/index.js';

describe('JsonLogger', () => {
  it('adds correlation and redacts sensitive fields', () => {
    const lines: string[] = [];
    const logger = new JsonLogger((line) => lines.push(line));
    withRequestContext({ requestId: 'req-1' }, () => {
      logger.log('info', 'request', { authorization: 'secret', nested: { token: 'secret' } });
    });

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({
      requestId: 'req-1',
      authorization: '[REDACTED]',
      nested: { token: '[REDACTED]' },
    });
  });
});
