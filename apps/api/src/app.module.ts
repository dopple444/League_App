import {
  BetterAuthSessionResolver,
  SyntheticHeaderSessionResolver,
  createLeagueAuth,
  type LeagueAuth,
  type SessionResolver,
} from '@league/auth';
import { createPrismaClient, TenantDatabase, type PrismaClient } from '@league/database';
import { Module, type OnModuleDestroy } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';

import {
  GovernanceController,
  LeaguesController,
  MeController,
  PublicController,
  SeasonsController,
  SystemController,
  TeamsController,
  VenuesController,
} from './controllers/api.controllers.js';
import { ApiErrorFilter } from './common/error.filter.js';
import { AuthenticationGuard } from './common/auth.guard.js';
import { LEAGUE_AUTH, PRISMA, SESSION_RESOLVER, TENANT_DATABASE } from './common/tokens.js';
import { AccessService } from './services/access.service.js';
import { GovernanceService } from './services/governance.service.js';
import { LeaguesService } from './services/leagues.service.js';
import { MutationService } from './services/mutation.service.js';
import { PublicService } from './services/public.service.js';
import { SeasonsService } from './services/seasons.service.js';
import { TeamsService } from './services/teams.service.js';
import { VenuesService } from './services/venues.service.js';

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

class PrismaLifecycle implements OnModuleDestroy {
  constructor(private readonly prisma: PrismaClient) {}

  onModuleDestroy(): Promise<void> {
    return this.prisma.$disconnect();
  }
}

@Module({
  controllers: [
    MeController,
    LeaguesController,
    SeasonsController,
    TeamsController,
    VenuesController,
    GovernanceController,
    PublicController,
    SystemController,
  ],
  providers: [
    {
      provide: PRISMA,
      useFactory: () =>
        createPrismaClient(process.env.RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL),
    },
    {
      provide: TENANT_DATABASE,
      inject: [PRISMA],
      useFactory: (prisma: PrismaClient) => new TenantDatabase(prisma),
    },
    {
      provide: LEAGUE_AUTH,
      inject: [PRISMA],
      useFactory: (prisma: PrismaClient) =>
        createLeagueAuth({
          prisma,
          secret: required('BETTER_AUTH_SECRET'),
          baseURL: required('BETTER_AUTH_URL'),
          trustedOrigins: (process.env.WEB_ORIGIN ?? 'http://localhost:8080')
            .split(',')
            .concat(process.env.MOBILE_ORIGIN ?? 'league-companion://'),
        }),
    },
    {
      provide: SESSION_RESOLVER,
      inject: [LEAGUE_AUTH],
      useFactory: (auth: LeagueAuth): SessionResolver =>
        process.env.AUTH_MODE === 'synthetic'
          ? new SyntheticHeaderSessionResolver(process.env.NODE_ENV)
          : new BetterAuthSessionResolver(auth),
    },
    {
      provide: PrismaLifecycle,
      inject: [PRISMA],
      useFactory: (prisma: PrismaClient) => new PrismaLifecycle(prisma),
    },
    AccessService,
    MutationService,
    LeaguesService,
    SeasonsService,
    TeamsService,
    VenuesService,
    GovernanceService,
    PublicService,
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_FILTER, useClass: ApiErrorFilter },
  ],
})
// Nest discovers module metadata from this decorated class.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class AppModule {}
