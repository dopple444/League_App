export class ResourceNotFoundError extends Error {
  readonly code = 'NOT_FOUND';

  constructor() {
    super('The requested resource was not found.');
    this.name = 'ResourceNotFoundError';
  }
}

export class AuthenticationRequiredError extends Error {
  readonly code = 'AUTHENTICATION_REQUIRED';

  constructor() {
    super('Authentication is required.');
    this.name = 'AuthenticationRequiredError';
  }
}

export class MfaEnrollmentRequiredError extends Error {
  readonly code = 'MFA_ENROLLMENT_REQUIRED';

  constructor() {
    super('Multi-factor authentication must be enrolled before this administrative change.');
    this.name = 'MfaEnrollmentRequiredError';
  }
}

export class PlatformAccessDeniedError extends Error {
  readonly code = 'PLATFORM_ACCESS_DENIED';

  constructor() {
    super('You do not have permission to use controlled-beta platform operations.');
    this.name = 'PlatformAccessDeniedError';
  }
}

export class InvitationUnavailableError extends Error {
  readonly code = 'INVITATION_UNAVAILABLE';

  constructor() {
    super('This invitation is unavailable. Ask the issuing operator for help.');
    this.name = 'InvitationUnavailableError';
  }
}

export class InvitationNotRevocableError extends Error {
  readonly code = 'INVITATION_NOT_REVOCABLE';

  constructor() {
    super('This invitation can no longer be revoked.');
    this.name = 'InvitationNotRevocableError';
  }
}

export class DuplicateOrganizationSlugError extends Error {
  readonly code = 'DUPLICATE_ORGANIZATION_SLUG';

  constructor() {
    super('An organization with that slug already exists.');
    this.name = 'DuplicateOrganizationSlugError';
  }
}

export class InvalidIdempotencyKeyError extends Error {
  readonly code = 'INVALID_IDEMPOTENCY_KEY';

  constructor() {
    super('A valid Idempotency-Key header is required.');
    this.name = 'InvalidIdempotencyKeyError';
  }
}

export class DuplicateLeagueSlugError extends Error {
  readonly code = 'DUPLICATE_LEAGUE_SLUG';

  constructor() {
    super('A league with that slug already exists.');
    this.name = 'DuplicateLeagueSlugError';
  }
}

export class PublishedLeagueSlugLockedError extends Error {
  readonly code = 'PUBLISHED_LEAGUE_SLUG_LOCKED';

  constructor() {
    super('The public URL name cannot be changed while the league has a published season.');
    this.name = 'PublishedLeagueSlugLockedError';
  }
}

export class InactiveLeagueError extends Error {
  readonly code = 'INACTIVE_LEAGUE';

  constructor() {
    super('The league must be active for this operation.');
    this.name = 'InactiveLeagueError';
  }
}

export class DuplicateFacilityNameError extends Error {
  readonly code: 'DUPLICATE_VENUE_NAME' | 'DUPLICATE_FIELD_NAME';

  constructor(kind: 'venue' | 'field') {
    super(
      kind === 'venue'
        ? 'A venue with that name already exists.'
        : 'A field with that name already exists at this venue.',
    );
    this.name = 'DuplicateFacilityNameError';
    this.code = kind === 'venue' ? 'DUPLICATE_VENUE_NAME' : 'DUPLICATE_FIELD_NAME';
  }
}
