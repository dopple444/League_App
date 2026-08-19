import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { GovernanceService } from '../../src/services/governance.service.js';
import { MutationService } from '../../src/services/mutation.service.js';
import { SeasonsService } from '../../src/services/seasons.service.js';
import { TeamsService } from '../../src/services/teams.service.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('AppModule dependency graph', () => {
  it('bootstraps mutation providers and their consumers without erased DI tokens', async () => {
    const databaseUrl = 'postgresql://test:test@127.0.0.1:1/league_test';
    vi.stubEnv('DATABASE_URL', databaseUrl);
    vi.stubEnv('RUNTIME_DATABASE_URL', databaseUrl);
    vi.stubEnv('BETTER_AUTH_SECRET', 'test-only-better-auth-secret-000000000000');
    vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3001');
    vi.stubEnv('WEB_ORIGIN', 'http://localhost:8080');
    vi.stubEnv('MOBILE_ORIGIN', 'league-companion://');
    vi.stubEnv('AUTH_MODE', 'synthetic');
    vi.stubEnv('NODE_ENV', 'test');

    const application = await NestFactory.createApplicationContext(AppModule, { logger: false });
    try {
      expect(application.get(MutationService)).toBeInstanceOf(MutationService);
      expect(application.get(SeasonsService)).toBeInstanceOf(SeasonsService);
      expect(application.get(TeamsService)).toBeInstanceOf(TeamsService);
      expect(application.get(GovernanceService)).toBeInstanceOf(GovernanceService);
    } finally {
      await application.close();
    }
  });
});
