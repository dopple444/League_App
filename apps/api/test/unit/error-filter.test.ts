import { VersionConflictError } from '@league/domain';
import type { ArgumentsHost } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ApiErrorFilter } from '../../src/common/error.filter.js';
import {
  DuplicateFacilityNameError,
  DuplicateLeagueSlugError,
  InactiveLeagueError,
  MfaEnrollmentRequiredError,
  PublishedLeagueSlugLockedError,
} from '../../src/common/errors.js';

function host() {
  const reply = {
    status: vi.fn(),
    send: vi.fn(),
  };
  reply.status.mockReturnValue(reply);
  const argumentsHost = {
    switchToHttp: () => ({
      getRequest: () => ({ requestId: 'request-venue-conflict' }),
      getResponse: () => reply,
    }),
  } as unknown as ArgumentsHost;
  return { argumentsHost, reply };
}

describe('administration conflict error envelopes', () => {
  it.each([
    [new DuplicateLeagueSlugError(), 'DUPLICATE_LEAGUE_SLUG'],
    [new PublishedLeagueSlugLockedError(), 'PUBLISHED_LEAGUE_SLUG_LOCKED'],
    [new InactiveLeagueError(), 'INACTIVE_LEAGUE'],
    [new DuplicateFacilityNameError('venue'), 'DUPLICATE_VENUE_NAME'],
    [new DuplicateFacilityNameError('field'), 'DUPLICATE_FIELD_NAME'],
    [new VersionConflictError(1, 2), 'VERSION_CONFLICT'],
  ])('maps %s to a stable non-sensitive HTTP 409', (error, code) => {
    const { argumentsHost, reply } = host();

    new ApiErrorFilter().catch(error, argumentsHost);

    expect(reply.status).toHaveBeenCalledWith(409);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ code, requestId: 'request-venue-conflict' }),
    );
  });
});

describe('privileged MFA error envelope', () => {
  it('maps missing enrollment to a stable non-sensitive HTTP 403', () => {
    const { argumentsHost, reply } = host();

    new ApiErrorFilter().catch(new MfaEnrollmentRequiredError(), argumentsHost);

    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({
      code: 'MFA_ENROLLMENT_REQUIRED',
      message: 'Multi-factor authentication must be enrolled before this administrative change.',
      requestId: 'request-venue-conflict',
    });
  });
});
