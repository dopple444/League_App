import type { AuthenticatedUser } from '@league/auth';
import {
  createLeagueSchema,
  leagueAdminListSchema,
  leagueAdminSchema,
  updateLeagueSchema,
  type CreateLeagueInput,
  type LeagueAdminDto,
  type LeagueAdminListDto,
  type UpdateLeagueInput,
} from '@league/contracts';
import type { Prisma, TenantDatabase, TenantTransaction } from '@league/database';
import { VersionConflictError, assertExpectedVersion, permissions } from '@league/domain';
import { Inject, Injectable } from '@nestjs/common';

import {
  DuplicateLeagueSlugError,
  PublishedLeagueSlugLockedError,
  ResourceNotFoundError,
} from '../common/errors.js';
import type { RequestMetadata } from '../common/request.js';
import { TENANT_DATABASE } from '../common/tokens.js';
import { AccessService } from './access.service.js';
import { MutationService, type MutationContext } from './mutation.service.js';

const LEAGUE_LIST_LIMIT = 200;

interface LeagueRow {
  readonly organizationId: string;
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly active: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function toLeagueDto(league: LeagueRow): LeagueAdminDto {
  return leagueAdminSchema.parse({
    organizationId: league.organizationId,
    leagueId: league.id,
    slug: league.slug,
    name: league.name,
    active: league.active,
    version: league.version,
    createdAt: league.createdAt.toISOString(),
    updatedAt: league.updatedAt.toISOString(),
  });
}

function json(value: unknown): Prisma.InputJsonValue {
  return structuredClone(value) as Prisma.InputJsonValue;
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

@Injectable()
export class LeaguesService {
  constructor(
    @Inject(TENANT_DATABASE) private readonly database: TenantDatabase,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(MutationService) private readonly mutations: MutationService,
  ) {}

  async list(
    organizationId: string,
    user: AuthenticatedUser,
    metadata: RequestMetadata,
  ): Promise<LeagueAdminListDto> {
    return this.database.withTenant(
      { organizationId, userId: user.id, requestId: metadata.requestId, source: metadata.source },
      async (transaction) => {
        await this.access.assertPermission(
          transaction,
          organizationId,
          user.id,
          permissions.leagueRead,
        );
        const leagues = await transaction.league.findMany({
          where: { organizationId },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          take: LEAGUE_LIST_LIMIT,
        });
        return leagueAdminListSchema.parse({ items: leagues.map(toLeagueDto) });
      },
    );
  }

  async create(context: MutationContext, rawInput: CreateLeagueInput): Promise<LeagueAdminDto> {
    const input = createLeagueSchema.parse(rawInput);
    return this.mutations.execute({
      context,
      permission: permissions.leagueCreate,
      fingerprintPayload: { operation: 'league.create', input },
      responseSchema: leagueAdminSchema,
      responseStatus: 201,
      operation: async (transaction) => {
        let league: LeagueRow;
        try {
          league = await transaction.league.create({
            data: {
              organizationId: context.organizationId,
              slug: input.slug,
              name: input.name,
              active: input.active,
            },
          });
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            throw new DuplicateLeagueSlugError();
          }
          throw error;
        }
        const result = toLeagueDto(league);
        await this.mutations.record(transaction, context, {
          action: 'league.created',
          targetType: 'League',
          targetId: league.id,
          after: json(result),
        });
        return result;
      },
    });
  }

  async update(
    context: MutationContext,
    leagueId: string,
    rawInput: UpdateLeagueInput,
  ): Promise<LeagueAdminDto> {
    const input = updateLeagueSchema.parse(rawInput);
    return this.mutations.execute({
      context,
      permission: permissions.leagueUpdate,
      fingerprintPayload: { operation: 'league.update', leagueId, input },
      responseSchema: leagueAdminSchema,
      operation: async (transaction) => {
        const current = await this.findLeague(transaction, context.organizationId, leagueId);
        assertExpectedVersion(input.expectedVersion, current.version);
        if (input.slug !== current.slug) {
          await this.assertSlugCanChange(transaction, context.organizationId, leagueId);
        }
        let count: number;
        try {
          ({ count } = await transaction.league.updateMany({
            where: {
              organizationId: context.organizationId,
              id: leagueId,
              version: input.expectedVersion,
            },
            data: {
              slug: input.slug,
              name: input.name,
              active: input.active,
              version: { increment: 1 },
            },
          }));
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            throw new DuplicateLeagueSlugError();
          }
          throw error;
        }
        if (count !== 1) {
          await this.throwVersionConflict(
            transaction,
            context.organizationId,
            leagueId,
            input.expectedVersion,
          );
        }
        const updated = await this.findLeague(transaction, context.organizationId, leagueId);
        const before = toLeagueDto(current);
        const result = toLeagueDto(updated);
        await this.mutations.record(transaction, context, {
          action: 'league.updated',
          targetType: 'League',
          targetId: leagueId,
          before: json(before),
          after: json(result),
        });
        return result;
      },
    });
  }

  private async findLeague(
    transaction: TenantTransaction,
    organizationId: string,
    leagueId: string,
  ): Promise<LeagueRow> {
    const league = await transaction.league.findUnique({
      where: { organizationId_id: { organizationId, id: leagueId } },
    });
    if (league === null) {
      throw new ResourceNotFoundError();
    }
    return league;
  }

  private async assertSlugCanChange(
    transaction: TenantTransaction,
    organizationId: string,
    leagueId: string,
  ): Promise<void> {
    const seasons = await transaction.season.findMany({
      where: { organizationId, leagueId },
      select: { id: true },
    });
    if (seasons.length === 0) return;

    const publication = await transaction.publicationSnapshot.findFirst({
      where: {
        organizationId,
        resourceKind: 'SEASON',
        resourceId: { in: seasons.map((season) => season.id) },
        withdrawnAt: null,
      },
      select: { id: true },
    });
    if (publication !== null) {
      throw new PublishedLeagueSlugLockedError();
    }
  }

  private async throwVersionConflict(
    transaction: TenantTransaction,
    organizationId: string,
    leagueId: string,
    expectedVersion: number,
  ): Promise<never> {
    const latest = await transaction.league.findUnique({
      where: { organizationId_id: { organizationId, id: leagueId } },
      select: { version: true },
    });
    if (latest === null) {
      throw new ResourceNotFoundError();
    }
    throw new VersionConflictError(expectedVersion, latest.version);
  }
}
