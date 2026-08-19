import type { SessionResolver } from '@league/auth';
import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthenticationRequiredError } from './errors.js';
import { PUBLIC_ROUTE } from './public.decorator.js';
import type { ApiRequest } from './request.js';
import { SESSION_RESOLVER } from './tokens.js';

function toHeaders(request: ApiRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (value !== undefined) {
      headers.set(key, Array.isArray(value) ? value.join(',') : value);
    }
  }
  return headers;
}

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SESSION_RESOLVER) private readonly sessions: SessionResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<ApiRequest>();
    const user = await this.sessions.resolve(toHeaders(request));
    if (user === null) {
      throw new AuthenticationRequiredError();
    }
    request.user = user;
    return true;
  }
}
