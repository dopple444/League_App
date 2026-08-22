import type { AuthenticatedUser } from '@league/auth';
import {
  createTeamSchema,
  expectedVersionSchema,
  publicationSchema,
  teamAdminListSchema,
  teamAdminSchema,
  teamPublicationPayloadSchema,
  updateTeamSchema,
  type CreateTeamInput,
  type PublicationDto,
  type TeamAdminDto,
  type TeamAdminListDto,
  type UpdateTeamInput,
} from '@league/contracts';
import type { Prisma, TenantDatabase, TenantTransaction } from '@league/database';
import { assertExpectedVersion, nextPublicationRevision, permissions } from '@league/domain';
import { Inject, Injectable } from '@nestjs/common';

import { InactiveLeagueError, ResourceNotFoundError } from '../common/errors.js';
import type { RequestMetadata } from '../common/request.js';
import { TENANT_DATABASE } from '../common/tokens.js';
import { AccessService } from './access.service.js';
import { MutationService, type MutationContext } from './mutation.service.js';

interface TeamRow {
  readonly organizationId: string;
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string;
  readonly slug: string;
  readonly publicName: string;
  readonly version: number;
  readonly team: { readonly name: string };
}

function toAdminDto(team: TeamRow, published: boolean): TeamAdminDto {
  return teamAdminSchema.parse({
    organizationId: team.organizationId,
    teamSeasonId: team.id,
    teamId: team.teamId,
    seasonId: team.seasonId,
    name: team.team.name,
    publicName: team.publicName,
    slug: team.slug,
    version: team.version,
    published,
  });
}

function json(value: unknown): Prisma.InputJsonValue {
  return structuredClone(value) as Prisma.InputJsonValue;
}

@Injectable()
export class TeamsService {
  constructor(
    @Inject(TENANT_DATABASE) private readonly database: TenantDatabase,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(MutationService) private readonly mutations: MutationService,
  ) {}

  async list(
    organizationId: string,
    seasonId: string,
    user: AuthenticatedUser,
    metadata: RequestMetadata,
  ): Promise<TeamAdminListDto> {
    return this.database.withTenant(
      { organizationId, userId: user.id, requestId: metadata.requestId, source: metadata.source },
      async (transaction) => {
        await this.access.assertPermission(
          transaction,
          organizationId,
          user.id,
          permissions.teamRead,
        );
        await this.requireSeason(transaction, organizationId, seasonId);
        const teams = await transaction.teamSeason.findMany({
          where: { seasonId },
          include: { team: true },
          orderBy: { publicName: 'asc' },
        });
        const published = await transaction.publicationSnapshot.findMany({
          where: { resourceKind: 'TEAM_SEASON', withdrawnAt: null },
          select: { resourceId: true },
        });
        const publishedIds = new Set(published.map((entry) => entry.resourceId));
        return teamAdminListSchema.parse({
          items: teams.map((team) => toAdminDto(team, publishedIds.has(team.id))),
        });
      },
    );
  }

  async create(
    context: MutationContext,
    seasonId: string,
    rawInput: CreateTeamInput,
  ): Promise<TeamAdminDto> {
    const input = createTeamSchema.parse(rawInput);
    return this.mutations.execute({
      context,
      permission: permissions.teamCreate,
      fingerprintPayload: { operation: 'team.create', seasonId, input },
      responseSchema: teamAdminSchema,
      responseStatus: 201,
      operation: async (transaction) => {
        await this.requireActiveLeague(transaction, context.organizationId, seasonId);
        const team = await transaction.team.create({
          data: { organizationId: context.organizationId, name: input.name },
        });
        const teamSeason = await transaction.teamSeason.create({
          data: {
            organizationId: context.organizationId,
            seasonId,
            teamId: team.id,
            slug: input.slug,
            publicName: input.publicName,
          },
          include: { team: true },
        });
        const result = toAdminDto(teamSeason, false);
        await this.mutations.record(transaction, context, {
          action: 'team.created',
          targetType: 'TeamSeason',
          targetId: teamSeason.id,
          after: json(result),
        });
        return result;
      },
    });
  }

  async update(
    context: MutationContext,
    seasonId: string,
    teamSeasonId: string,
    rawInput: UpdateTeamInput,
  ): Promise<TeamAdminDto> {
    const input = updateTeamSchema.parse(rawInput);
    return this.mutations.execute({
      context,
      permission: permissions.teamUpdate,
      fingerprintPayload: { operation: 'team.update', seasonId, teamSeasonId, input },
      responseSchema: teamAdminSchema,
      operation: async (transaction) => {
        const current = await this.findTeam(
          transaction,
          context.organizationId,
          seasonId,
          teamSeasonId,
        );
        assertExpectedVersion(input.expectedVersion, current.version);
        if (input.name !== undefined) {
          await transaction.team.update({
            where: {
              organizationId_id: { organizationId: context.organizationId, id: current.teamId },
            },
            data: { name: input.name },
          });
        }
        const updated = await transaction.teamSeason.update({
          where: {
            organizationId_id: { organizationId: context.organizationId, id: teamSeasonId },
          },
          data: {
            ...(input.publicName === undefined ? {} : { publicName: input.publicName }),
            ...(input.slug === undefined ? {} : { slug: input.slug }),
            version: { increment: 1 },
          },
          include: { team: true },
        });
        const published = await this.isPublished(transaction, teamSeasonId);
        const before = toAdminDto(current, published);
        const result = toAdminDto(updated, published);
        await this.mutations.record(transaction, context, {
          action: 'team.updated',
          targetType: 'TeamSeason',
          targetId: teamSeasonId,
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
    teamSeasonId: string,
    rawInput: { expectedVersion: number },
  ): Promise<PublicationDto> {
    const input = expectedVersionSchema.parse(rawInput);
    return this.changePublication(context, seasonId, teamSeasonId, input.expectedVersion, true);
  }

  withdraw(
    context: MutationContext,
    seasonId: string,
    teamSeasonId: string,
    rawInput: { expectedVersion: number },
  ): Promise<PublicationDto> {
    const input = expectedVersionSchema.parse(rawInput);
    return this.changePublication(context, seasonId, teamSeasonId, input.expectedVersion, false);
  }

  private async changePublication(
    context: MutationContext,
    seasonId: string,
    teamSeasonId: string,
    expectedVersion: number,
    active: boolean,
  ): Promise<PublicationDto> {
    return this.mutations.execute({
      context,
      permission: permissions.teamPublish,
      fingerprintPayload: {
        operation: active ? 'team.publish' : 'team.withdraw',
        seasonId,
        teamSeasonId,
        expectedVersion,
      },
      responseSchema: publicationSchema,
      operation: async (transaction) => {
        const team = await this.findTeam(
          transaction,
          context.organizationId,
          seasonId,
          teamSeasonId,
        );
        assertExpectedVersion(expectedVersion, team.version);
        const latest = await transaction.publicationSnapshot.findFirst({
          where: { resourceKind: 'TEAM_SEASON', resourceId: teamSeasonId },
          orderBy: { revision: 'desc' },
        });
        const beforePublication =
          latest === null
            ? undefined
            : publicationSchema.parse({
                resourceKind: 'TEAM_SEASON',
                resourceId: teamSeasonId,
                revision: latest.revision,
                publishedAt: latest.publishedAt.toISOString(),
                active: latest.withdrawnAt === null,
                resourceVersion: team.version,
              });
        let snapshot;
        if (active) {
          await this.requireActiveLeague(transaction, context.organizationId, seasonId);
          await transaction.publicationSnapshot.updateMany({
            where: { resourceKind: 'TEAM_SEASON', resourceId: teamSeasonId, withdrawnAt: null },
            data: { withdrawnAt: new Date() },
          });
          const payload = teamPublicationPayloadSchema.parse({
            seasonId,
            team: {
              teamSeasonId,
              slug: team.slug,
              publicName: team.publicName,
            },
          });
          snapshot = await transaction.publicationSnapshot.create({
            data: {
              organizationId: context.organizationId,
              resourceKind: 'TEAM_SEASON',
              resourceId: teamSeasonId,
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
        const updated = await transaction.teamSeason.update({
          where: {
            organizationId_id: { organizationId: context.organizationId, id: teamSeasonId },
          },
          data: { version: { increment: 1 } },
        });
        const result = publicationSchema.parse({
          resourceKind: 'TEAM_SEASON',
          resourceId: teamSeasonId,
          revision: snapshot.revision,
          publishedAt: snapshot.publishedAt.toISOString(),
          active,
          resourceVersion: updated.version,
        });
        await this.mutations.record(transaction, context, {
          action: active ? 'team.published' : 'team.withdrawn',
          targetType: 'TeamSeason',
          targetId: teamSeasonId,
          ...(beforePublication === undefined ? {} : { before: json(beforePublication) }),
          after: json(result),
        });
        return result;
      },
    });
  }

  private async requireSeason(
    transaction: TenantTransaction,
    organizationId: string,
    seasonId: string,
  ): Promise<void> {
    const season = await transaction.season.findUnique({
      where: { organizationId_id: { organizationId, id: seasonId } },
      select: { id: true },
    });
    if (season === null) {
      throw new ResourceNotFoundError();
    }
  }

  private async requireActiveLeague(
    transaction: TenantTransaction,
    organizationId: string,
    seasonId: string,
  ): Promise<void> {
    const season = await transaction.season.findUnique({
      where: { organizationId_id: { organizationId, id: seasonId } },
      select: { league: { select: { active: true } } },
    });
    if (season === null) {
      throw new ResourceNotFoundError();
    }
    if (!season.league.active) {
      throw new InactiveLeagueError();
    }
  }

  private async findTeam(
    transaction: TenantTransaction,
    organizationId: string,
    seasonId: string,
    teamSeasonId: string,
  ): Promise<TeamRow> {
    const team = await transaction.teamSeason.findFirst({
      where: { id: teamSeasonId, seasonId },
      include: { team: true },
    });
    if (team === null || team.organizationId !== organizationId) {
      throw new ResourceNotFoundError();
    }
    return team;
  }

  private async isPublished(
    transaction: TenantTransaction,
    teamSeasonId: string,
  ): Promise<boolean> {
    return (
      (await transaction.publicationSnapshot.count({
        where: { resourceKind: 'TEAM_SEASON', resourceId: teamSeasonId, withdrawnAt: null },
      })) > 0
    );
  }
}
