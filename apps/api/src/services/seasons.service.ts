import type { AuthenticatedUser } from '@league/auth';
import {
  createSeasonSchema,
  expectedVersionSchema,
  publicationSchema,
  seasonAdminListSchema,
  seasonAdminSchema,
  seasonPublicationPayloadSchema,
  updateSeasonSchema,
  type CreateSeasonInput,
  type PublicationDto,
  type SeasonAdminDto,
  type SeasonAdminListDto,
  type UpdateSeasonInput,
} from '@league/contracts';
import type { Prisma, TenantDatabase, TenantTransaction } from '@league/database';
import { assertExpectedVersion, nextPublicationRevision, permissions } from '@league/domain';
import { Inject, Injectable } from '@nestjs/common';

import { InactiveLeagueError, ResourceNotFoundError } from '../common/errors.js';
import type { RequestMetadata } from '../common/request.js';
import { TENANT_DATABASE } from '../common/tokens.js';
import { AccessService } from './access.service.js';
import { MutationService, type MutationContext } from './mutation.service.js';

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

interface SeasonRow {
  readonly organizationId: string;
  readonly id: string;
  readonly leagueId: string;
  readonly name: string;
  readonly slug: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly timezone: string;
  readonly version: number;
}

function toAdminDto(season: SeasonRow, published: boolean): SeasonAdminDto {
  return seasonAdminSchema.parse({
    organizationId: season.organizationId,
    seasonId: season.id,
    leagueId: season.leagueId,
    name: season.name,
    slug: season.slug,
    startDate: dateOnly(season.startDate),
    endDate: dateOnly(season.endDate),
    timezone: season.timezone,
    version: season.version,
    published,
  });
}

function json(value: unknown): Prisma.InputJsonValue {
  return structuredClone(value) as Prisma.InputJsonValue;
}

@Injectable()
export class SeasonsService {
  constructor(
    @Inject(TENANT_DATABASE) private readonly database: TenantDatabase,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(MutationService) private readonly mutations: MutationService,
  ) {}

  async list(
    organizationId: string,
    user: AuthenticatedUser,
    metadata: RequestMetadata,
  ): Promise<SeasonAdminListDto> {
    return this.database.withTenant(
      { organizationId, userId: user.id, requestId: metadata.requestId, source: metadata.source },
      async (transaction) => {
        await this.access.assertPermission(
          transaction,
          organizationId,
          user.id,
          permissions.seasonRead,
        );
        const seasons = await transaction.season.findMany({ orderBy: { startDate: 'desc' } });
        const published = await transaction.publicationSnapshot.findMany({
          where: { resourceKind: 'SEASON', withdrawnAt: null },
          select: { resourceId: true },
        });
        const publishedIds = new Set(published.map((entry) => entry.resourceId));
        return seasonAdminListSchema.parse({
          items: seasons.map((season) => toAdminDto(season, publishedIds.has(season.id))),
        });
      },
    );
  }

  async create(context: MutationContext, rawInput: CreateSeasonInput): Promise<SeasonAdminDto> {
    const input = createSeasonSchema.parse(rawInput);
    return this.mutations.execute({
      context,
      permission: permissions.seasonCreate,
      fingerprintPayload: { operation: 'season.create', input },
      responseSchema: seasonAdminSchema,
      responseStatus: 201,
      operation: async (transaction) => {
        const league = await transaction.league.findUnique({
          where: {
            organizationId_id: { organizationId: context.organizationId, id: input.leagueId },
          },
        });
        if (league === null) {
          throw new ResourceNotFoundError();
        }
        if (!league.active) {
          throw new InactiveLeagueError();
        }
        const season = await transaction.season.create({
          data: {
            organizationId: context.organizationId,
            leagueId: input.leagueId,
            name: input.name,
            slug: input.slug,
            startDate: new Date(`${input.startDate}T00:00:00.000Z`),
            endDate: new Date(`${input.endDate}T00:00:00.000Z`),
            timezone: input.timezone,
          },
        });
        await transaction.seasonConfigurationRevision.create({
          data: {
            organizationId: context.organizationId,
            seasonId: season.id,
            revision: 1,
            configuration: {},
          },
        });
        const result = toAdminDto(season, false);
        await this.mutations.record(transaction, context, {
          action: 'season.created',
          targetType: 'Season',
          targetId: season.id,
          after: json(result),
        });
        return result;
      },
    });
  }

  async update(
    context: MutationContext,
    seasonId: string,
    rawInput: UpdateSeasonInput,
  ): Promise<SeasonAdminDto> {
    const input = updateSeasonSchema.parse(rawInput);
    return this.mutations.execute({
      context,
      permission: permissions.seasonUpdate,
      fingerprintPayload: { operation: 'season.update', seasonId, input },
      responseSchema: seasonAdminSchema,
      operation: async (transaction) => {
        const current = await this.findSeason(transaction, context.organizationId, seasonId);
        assertExpectedVersion(input.expectedVersion, current.version);
        const validated = createSeasonSchema.parse({
          leagueId: current.leagueId,
          slug: current.slug,
          name: input.name ?? current.name,
          startDate: input.startDate ?? dateOnly(current.startDate),
          endDate: input.endDate ?? dateOnly(current.endDate),
          timezone: input.timezone ?? current.timezone,
        });
        const updated = await transaction.season.update({
          where: { organizationId_id: { organizationId: context.organizationId, id: seasonId } },
          data: {
            name: validated.name,
            startDate: new Date(`${validated.startDate}T00:00:00.000Z`),
            endDate: new Date(`${validated.endDate}T00:00:00.000Z`),
            timezone: validated.timezone,
            version: { increment: 1 },
          },
        });
        const published = await this.isPublished(transaction, 'SEASON', seasonId);
        const before = toAdminDto(current, published);
        const result = toAdminDto(updated, published);
        await this.mutations.record(transaction, context, {
          action: 'season.updated',
          targetType: 'Season',
          targetId: seasonId,
          before: json(before),
          after: json(result),
        });
        return result;
      },
    });
  }

  publish(
    context: MutationContext,
    seasonId: string,
    rawInput: { expectedVersion: number },
  ): Promise<PublicationDto> {
    const input = expectedVersionSchema.parse(rawInput);
    return this.changePublication(context, seasonId, input.expectedVersion, true);
  }

  withdraw(
    context: MutationContext,
    seasonId: string,
    rawInput: { expectedVersion: number },
  ): Promise<PublicationDto> {
    const input = expectedVersionSchema.parse(rawInput);
    return this.changePublication(context, seasonId, input.expectedVersion, false);
  }

  private async changePublication(
    context: MutationContext,
    seasonId: string,
    expectedVersion: number,
    active: boolean,
  ): Promise<PublicationDto> {
    return this.mutations.execute({
      context,
      permission: permissions.seasonPublish,
      fingerprintPayload: {
        operation: active ? 'season.publish' : 'season.withdraw',
        seasonId,
        expectedVersion,
      },
      responseSchema: publicationSchema,
      operation: async (transaction) => {
        const season = await this.findSeason(transaction, context.organizationId, seasonId);
        assertExpectedVersion(expectedVersion, season.version);
        const latest = await transaction.publicationSnapshot.findFirst({
          where: { resourceKind: 'SEASON', resourceId: seasonId },
          orderBy: { revision: 'desc' },
        });
        const beforePublication =
          latest === null
            ? undefined
            : publicationSchema.parse({
                resourceKind: 'SEASON',
                resourceId: seasonId,
                revision: latest.revision,
                publishedAt: latest.publishedAt.toISOString(),
                active: latest.withdrawnAt === null,
                resourceVersion: season.version,
              });
        let snapshot;
        if (active) {
          const [organization, league] = await Promise.all([
            transaction.organization.findUniqueOrThrow({
              where: { organizationId: context.organizationId },
            }),
            transaction.league.findUniqueOrThrow({
              where: {
                organizationId_id: {
                  organizationId: context.organizationId,
                  id: season.leagueId,
                },
              },
            }),
          ]);
          if (!league.active) {
            throw new InactiveLeagueError();
          }
          await transaction.publicationSnapshot.updateMany({
            where: { resourceKind: 'SEASON', resourceId: seasonId, withdrawnAt: null },
            data: { withdrawnAt: new Date() },
          });
          const payload = seasonPublicationPayloadSchema.parse({
            organization: { slug: organization.slug, name: organization.name },
            league: { slug: league.slug, name: league.name },
            currentSeason: {
              seasonId: season.id,
              slug: season.slug,
              name: season.name,
              startDate: dateOnly(season.startDate),
              endDate: dateOnly(season.endDate),
              timezone: season.timezone,
            },
          });
          snapshot = await transaction.publicationSnapshot.create({
            data: {
              organizationId: context.organizationId,
              resourceKind: 'SEASON',
              resourceId: seasonId,
              revision: nextPublicationRevision(latest),
              payload: json(payload),
            },
          });
        } else {
          if (latest === null || latest.withdrawnAt !== null) {
            throw new ResourceNotFoundError();
          }
          snapshot = await transaction.publicationSnapshot.update({
            where: {
              organizationId_id: { organizationId: context.organizationId, id: latest.id },
            },
            data: { withdrawnAt: new Date() },
          });
        }
        const updated = await transaction.season.update({
          where: { organizationId_id: { organizationId: context.organizationId, id: seasonId } },
          data: { version: { increment: 1 } },
        });
        const result = publicationSchema.parse({
          resourceKind: 'SEASON',
          resourceId: seasonId,
          revision: snapshot.revision,
          publishedAt: snapshot.publishedAt.toISOString(),
          active,
          resourceVersion: updated.version,
        });
        await this.mutations.record(transaction, context, {
          action: active ? 'season.published' : 'season.withdrawn',
          targetType: 'Season',
          targetId: seasonId,
          ...(beforePublication === undefined ? {} : { before: json(beforePublication) }),
          after: json(result),
        });
        return result;
      },
    });
  }

  private async findSeason(
    transaction: TenantTransaction,
    organizationId: string,
    seasonId: string,
  ): Promise<SeasonRow> {
    const season = await transaction.season.findUnique({
      where: { organizationId_id: { organizationId, id: seasonId } },
    });
    if (season === null) {
      throw new ResourceNotFoundError();
    }
    return season;
  }

  private async isPublished(
    transaction: TenantTransaction,
    resourceKind: 'SEASON' | 'TEAM_SEASON',
    resourceId: string,
  ): Promise<boolean> {
    return (
      (await transaction.publicationSnapshot.count({
        where: { resourceKind, resourceId, withdrawnAt: null },
      })) > 0
    );
  }
}
