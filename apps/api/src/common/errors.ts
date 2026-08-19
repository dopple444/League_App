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
