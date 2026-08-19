import {
  ApiError as GeneratedApiError,
  LeagueApiClient as GeneratedLeagueApiClient,
} from '@league/sdk';
import type {
  OrganizationMembershipDto,
  PublicGameDto,
  PublicLeagueHomeDto,
  PublicTeamDto,
} from '@league/sdk';

import { authClient } from './auth-client';
import { apiBaseUrl } from './config';

export type LeagueSummary = OrganizationMembershipDto['leagues'][number];
export type OrganizationSummary = OrganizationMembershipDto;
export type PublicLeague = PublicLeagueHomeDto;
export type PublicTeam = PublicTeamDto;
export type PublicGame = PublicGameDto;

export interface PublicCollection<T> {
  readonly organization: PublicLeagueHomeDto['organization'];
  readonly league: PublicLeagueHomeDto['league'];
  readonly season: NonNullable<PublicLeagueHomeDto['currentSeason']>;
  readonly items: readonly T[];
}

export class MobileApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'MobileApiError';
  }
}

export class MobileApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getCookie: () => string,
    private readonly fetcher: typeof fetch = (...args) => globalThis.fetch(...args),
  ) {}

  private generated(): GeneratedLeagueApiClient {
    const authenticatedFetch: typeof fetch = (input, init = {}) => {
      const headers = new Headers(init.headers);
      headers.set('X-Client-Source', 'MOBILE');
      const cookie = this.getCookie();
      if (cookie) headers.set('Cookie', cookie);
      return this.fetcher(input, { ...init, headers });
    };
    return new GeneratedLeagueApiClient({ baseUrl: this.baseUrl, fetch: authenticatedFetch });
  }

  private async call<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof GeneratedApiError) {
        throw new MobileApiError(
          error.status,
          error.body.code,
          error.body.message,
          error.body.requestId,
        );
      }
      throw new MobileApiError(0, 'NETWORK_UNAVAILABLE', 'Check your connection and try again.');
    }
  }

  async getOrganizations(): Promise<readonly OrganizationSummary[]> {
    return (await this.call(() => this.generated().listMyOrganizations())).items;
  }

  getPublicLeague(organizationSlug: string, leagueSlug: string): Promise<PublicLeague> {
    return this.call(() => this.generated().getPublicLeague(organizationSlug, leagueSlug));
  }

  async getPublicTeams(
    organizationSlug: string,
    leagueSlug: string,
    seasonSlug: string,
  ): Promise<PublicCollection<PublicTeam>> {
    const [home, result] = await Promise.all([
      this.getPublicLeague(organizationSlug, leagueSlug),
      this.call(() => this.generated().listPublicTeams(organizationSlug, leagueSlug, seasonSlug)),
    ]);
    return {
      organization: home.organization,
      league: home.league,
      season: result.season,
      items: result.items,
    };
  }

  async getPublicSchedule(
    organizationSlug: string,
    leagueSlug: string,
    seasonSlug: string,
  ): Promise<PublicCollection<PublicGame>> {
    const [home, result] = await Promise.all([
      this.getPublicLeague(organizationSlug, leagueSlug),
      this.call(() => this.generated().getPublicSchedule(organizationSlug, leagueSlug, seasonSlug)),
    ]);
    return {
      organization: home.organization,
      league: home.league,
      season: result.season,
      items: result.items,
    };
  }
}

export const mobileApi = new MobileApiClient(apiBaseUrl, () => authClient.getCookie());
