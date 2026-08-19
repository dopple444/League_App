import type { LeagueAuth } from './auth.js';

export interface AuthenticatedUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export interface SessionResolver {
  resolve(headers: Headers): Promise<AuthenticatedUser | null>;
}

export class BetterAuthSessionResolver implements SessionResolver {
  constructor(private readonly auth: LeagueAuth) {}

  async resolve(headers: Headers): Promise<AuthenticatedUser | null> {
    const session = await this.auth.api.getSession({ headers });
    if (session === null) {
      return null;
    }

    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    };
  }
}

export class SyntheticHeaderSessionResolver implements SessionResolver {
  constructor(private readonly environment: string | undefined) {
    if (environment === 'production') {
      throw new Error('Synthetic authentication cannot run in production.');
    }
  }

  async resolve(headers: Headers): Promise<AuthenticatedUser | null> {
    const id = headers.get('x-synthetic-user-id');
    if (id === null) {
      return null;
    }

    return {
      id,
      name: 'Synthetic Test User',
      email: 'synthetic-user@example.invalid',
    };
  }
}
