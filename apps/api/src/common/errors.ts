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
