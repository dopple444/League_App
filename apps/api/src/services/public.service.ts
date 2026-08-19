import {
  publicLeagueHomeSchema,
  publicScheduleSchema,
  publicTeamListSchema,
  schedulePublicationPayloadSchema,
  seasonPublicationPayloadSchema,
  teamPublicationPayloadSchema,
  type PublicLeagueHomeDto,
  type PublicScheduleDto,
  type PublicSeasonDto,
  type PublicTeamListDto,
} from '@league/contracts';
import type { TenantDatabase, TenantTransaction } from '@league/database';
import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundError } from '../common/errors.js';
import { TENANT_DATABASE } from '../common/tokens.js';

@Injectable()
export class PublicService {
  constructor(@Inject(TENANT_DATABASE) private readonly database: TenantDatabase) {}

  async league(
    organizationSlug: string,
    leagueSlug: string,
    requestId: string,
  ): Promise<PublicLeagueHomeDto> {
    const organizationId = await this.resolve(organizationSlug, leagueSlug);
    return this.database.withTenant(
      { organizationId, userId: null, requestId, source: 'API' },
      async (transaction) => {
        const league = await transaction.league.findUnique({
          where: { organizationId_slug: { organizationId, slug: leagueSlug } },
          include: { seasons: { select: { id: true } } },
        });
        if (league === null) {
          throw new ResourceNotFoundError();
        }
        const snapshot = await transaction.publicationSnapshot.findFirst({
          where: {
            resourceKind: 'SEASON',
            resourceId: { in: league.seasons.map((season) => season.id) },
            withdrawnAt: null,
          },
          orderBy: { publishedAt: 'desc' },
        });
        if (snapshot === null) {
          throw new ResourceNotFoundError();
        }
        return publicLeagueHomeSchema.parse(snapshot.payload);
      },
    );
  }

  async teams(
    organizationSlug: string,
    leagueSlug: string,
    seasonSlug: string,
    requestId: string,
  ): Promise<PublicTeamListDto> {
    const organizationId = await this.resolve(organizationSlug, leagueSlug);
    return this.database.withTenant(
      { organizationId, userId: null, requestId, source: 'API' },
      async (transaction) => {
        const season = await this.publishedSeason(
          transaction,
          organizationId,
          leagueSlug,
          seasonSlug,
        );
        const snapshots = await transaction.publicationSnapshot.findMany({
          where: { resourceKind: 'TEAM_SEASON', withdrawnAt: null },
          orderBy: { publishedAt: 'asc' },
        });
        const teams = snapshots
          .map((snapshot) => teamPublicationPayloadSchema.parse(snapshot.payload))
          .filter((payload) => payload.seasonId === season.seasonId)
          .map((payload) => payload.team);
        return publicTeamListSchema.parse({ season, items: teams });
      },
    );
  }

  async schedule(
    organizationSlug: string,
    leagueSlug: string,
    seasonSlug: string,
    requestId: string,
  ): Promise<PublicScheduleDto> {
    const organizationId = await this.resolve(organizationSlug, leagueSlug);
    return this.database.withTenant(
      { organizationId, userId: null, requestId, source: 'API' },
      async (transaction) => {
        const season = await this.publishedSeason(
          transaction,
          organizationId,
          leagueSlug,
          seasonSlug,
        );
        const versions = await transaction.scheduleVersion.findMany({
          where: { seasonId: season.seasonId },
          select: { id: true },
        });
        const snapshot = await transaction.publicationSnapshot.findFirst({
          where: {
            resourceKind: 'SCHEDULE',
            resourceId: { in: versions.map((versionRow) => versionRow.id) },
            withdrawnAt: null,
          },
          orderBy: { publishedAt: 'desc' },
        });
        if (snapshot === null) {
          return publicScheduleSchema.parse({ season, items: [] });
        }
        const publishedSchedule = schedulePublicationPayloadSchema.parse(snapshot.payload);
        if (publishedSchedule.season.seasonId !== season.seasonId) {
          throw new ResourceNotFoundError();
        }
        return publicScheduleSchema.parse(publishedSchedule);
      },
    );
  }

  private async resolve(organizationSlug: string, leagueSlug: string): Promise<string> {
    const organizationId = await this.database.resolvePublicOrganization(
      organizationSlug,
      leagueSlug,
    );
    if (organizationId === null) {
      throw new ResourceNotFoundError();
    }
    return organizationId;
  }

  private async publishedSeason(
    transaction: TenantTransaction,
    organizationId: string,
    leagueSlug: string,
    seasonSlug: string,
  ): Promise<PublicSeasonDto> {
    const league = await transaction.league.findUnique({
      where: { organizationId_slug: { organizationId, slug: leagueSlug } },
    });
    if (league === null) {
      throw new ResourceNotFoundError();
    }
    const season = await transaction.season.findUnique({
      where: {
        organizationId_leagueId_slug: { organizationId, leagueId: league.id, slug: seasonSlug },
      },
    });
    if (season === null) {
      throw new ResourceNotFoundError();
    }
    const snapshot = await transaction.publicationSnapshot.findFirst({
      where: { resourceKind: 'SEASON', resourceId: season.id, withdrawnAt: null },
      orderBy: { revision: 'desc' },
    });
    if (snapshot === null) {
      throw new ResourceNotFoundError();
    }
    const payload = seasonPublicationPayloadSchema.parse(snapshot.payload);
    if (payload.currentSeason === null || payload.currentSeason.seasonId !== season.id) {
      throw new ResourceNotFoundError();
    }
    return payload.currentSeason;
  }
}
