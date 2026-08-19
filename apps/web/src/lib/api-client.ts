import {
  ApiError as GeneratedApiError,
  LeagueApiClient as GeneratedLeagueApiClient,
} from '@league/sdk';
import type {
  AuditEventDto,
  CreateSeasonInput,
  CreateTeamInput,
  ErrorEnvelope,
  OrganizationMembershipDto,
  PublicGameDto,
  PublicLeagueHomeDto,
  PublicSeasonDto,
  PublicTeamDto,
  SeasonAdminDto,
  TeamAdminDto,
  UpdateSeasonInput,
  UpdateTeamInput,
} from '@league/sdk';

export type FieldErrors = Readonly<Record<string, readonly string[]>>;
export type LeagueSummary = OrganizationMembershipDto['leagues'][number];
export type OrganizationSummary = OrganizationMembershipDto;
export type SeasonAdmin = SeasonAdminDto;
export type TeamAdmin = TeamAdminDto;
export type AuditEventSummary = AuditEventDto;
export type PublicSeason = PublicSeasonDto;
export type PublicLeague = PublicLeagueHomeDto;
export type PublicTeam = PublicTeamDto;
export type PublicScheduleGame = PublicGameDto;
export type { CreateSeasonInput, CreateTeamInput, UpdateSeasonInput, UpdateTeamInput };

export interface PublicCollection<T> {
  readonly organization: PublicLeagueHomeDto['organization'];
  readonly league: PublicLeagueHomeDto['league'];
  readonly season: PublicSeasonDto;
  readonly items: readonly T[];
}

export class ApiError extends Error {
  readonly code: string;
  readonly requestId?: string;
  readonly fieldErrors?: FieldErrors;

  constructor(
    readonly status: number,
    body: Partial<ErrorEnvelope>,
  ) {
    super(typeof body.message === 'string' ? body.message : 'The request could not be completed.');
    this.name = 'ApiError';
    this.code = typeof body.code === 'string' ? body.code : 'REQUEST_FAILED';
    this.requestId = typeof body.requestId === 'string' ? body.requestId : undefined;
    this.fieldErrors = body.fieldErrors;
  }
}

const toApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error;
  if (error instanceof GeneratedApiError) return new ApiError(error.status, error.body);
  return new ApiError(0, {
    code: 'NETWORK_UNAVAILABLE',
    message: 'The league service is unavailable. Check your connection and try again.',
  });
};

export const createIdempotencyKey = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

type BaseUrl = string | (() => string);

export class LeagueApiClient {
  private readonly fetcher: typeof fetch;

  constructor(
    private readonly baseUrl: BaseUrl,
    fetcher: typeof fetch = (...args) => globalThis.fetch(...args),
  ) {
    this.fetcher = (input, init = {}) => {
      const headers = new Headers(init.headers);
      headers.set('X-Client-Source', 'WEB');
      return fetcher.call(globalThis, input, { ...init, headers });
    };
  }

  private generated(): GeneratedLeagueApiClient {
    return new GeneratedLeagueApiClient({
      baseUrl: typeof this.baseUrl === 'function' ? this.baseUrl() : this.baseUrl,
      fetch: this.fetcher,
    });
  }

  private async call<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw toApiError(error);
    }
  }

  private async authRequest(path: string, body: unknown): Promise<unknown> {
    const resolvedBaseUrl = typeof this.baseUrl === 'function' ? this.baseUrl() : this.baseUrl;
    let response: Response;
    try {
      response = await this.fetcher(new URL(path, resolvedBaseUrl), {
        body: JSON.stringify(body),
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        method: 'POST',
      });
    } catch (error) {
      throw toApiError(error);
    }
    const responseBody = (await response.json().catch(() => ({}))) as Partial<ErrorEnvelope>;
    if (!response.ok) throw new ApiError(response.status, responseBody);
    return responseBody;
  }

  signIn(email: string, password: string): Promise<unknown> {
    return this.authRequest('/api/auth/sign-in/email', { email, password });
  }

  signOut(): Promise<unknown> {
    return this.authRequest('/api/auth/sign-out', {});
  }

  async getOrganizations(): Promise<readonly OrganizationSummary[]> {
    return (await this.call(() => this.generated().listMyOrganizations())).items;
  }

  async getSeasons(organizationId: string): Promise<readonly SeasonAdmin[]> {
    return (await this.call(() => this.generated().listSeasons(organizationId))).items;
  }

  createSeason(organizationId: string, input: CreateSeasonInput): Promise<SeasonAdmin> {
    return this.call(() =>
      this.generated().createSeason(organizationId, input, {
        idempotencyKey: createIdempotencyKey(),
      }),
    );
  }

  updateSeason(
    organizationId: string,
    seasonId: string,
    input: UpdateSeasonInput,
  ): Promise<SeasonAdmin> {
    return this.call(() =>
      this.generated().updateSeason(organizationId, seasonId, input, {
        idempotencyKey: createIdempotencyKey(),
      }),
    );
  }

  async setSeasonPublication(
    organizationId: string,
    seasonId: string,
    expectedVersion: number,
    published: boolean,
  ): Promise<SeasonAdmin> {
    await this.call(() =>
      published
        ? this.generated().publishSeason(organizationId, seasonId, expectedVersion, {
            idempotencyKey: createIdempotencyKey(),
          })
        : this.generated().withdrawSeason(organizationId, seasonId, expectedVersion, {
            idempotencyKey: createIdempotencyKey(),
          }),
    );
    const season = (await this.getSeasons(organizationId)).find(
      (item) => item.seasonId === seasonId,
    );
    if (!season)
      throw new ApiError(404, { code: 'NOT_FOUND', message: 'The season no longer exists.' });
    return season;
  }

  async getTeams(organizationId: string, seasonId: string): Promise<readonly TeamAdmin[]> {
    return (await this.call(() => this.generated().listTeams(organizationId, seasonId))).items;
  }

  createTeam(organizationId: string, seasonId: string, input: CreateTeamInput): Promise<TeamAdmin> {
    return this.call(() =>
      this.generated().createTeam(organizationId, seasonId, input, {
        idempotencyKey: createIdempotencyKey(),
      }),
    );
  }

  updateTeam(
    organizationId: string,
    seasonId: string,
    teamSeasonId: string,
    input: UpdateTeamInput,
  ): Promise<TeamAdmin> {
    return this.call(() =>
      this.generated().updateTeam(organizationId, seasonId, teamSeasonId, input, {
        idempotencyKey: createIdempotencyKey(),
      }),
    );
  }

  async setTeamPublication(
    organizationId: string,
    seasonId: string,
    teamSeasonId: string,
    expectedVersion: number,
    published: boolean,
  ): Promise<TeamAdmin> {
    await this.call(() =>
      published
        ? this.generated().publishTeam(organizationId, seasonId, teamSeasonId, expectedVersion, {
            idempotencyKey: createIdempotencyKey(),
          })
        : this.generated().withdrawTeam(organizationId, seasonId, teamSeasonId, expectedVersion, {
            idempotencyKey: createIdempotencyKey(),
          }),
    );
    const team = (await this.getTeams(organizationId, seasonId)).find(
      (item) => item.teamSeasonId === teamSeasonId,
    );
    if (!team)
      throw new ApiError(404, { code: 'NOT_FOUND', message: 'The team no longer exists.' });
    return team;
  }

  async getAuditEvents(organizationId: string): Promise<readonly AuditEventSummary[]> {
    return (await this.call(() => this.generated().listAuditEvents(organizationId))).items;
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
  ): Promise<PublicCollection<PublicScheduleGame>> {
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

export const resolveBrowserApiBaseUrl = (): string => {
  const configuredBaseUrl =
    typeof process === 'undefined' ? undefined : process.env?.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (configuredBaseUrl) return configuredBaseUrl;
  return typeof window === 'undefined' ? 'http://localhost:8080' : window.location.origin;
};

export const browserApi = new LeagueApiClient(resolveBrowserApiBaseUrl);

export const createServerApi = (): LeagueApiClient =>
  new LeagueApiClient(
    process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001',
    (input, init) => fetch(input, { ...init, cache: 'no-store' }),
  );

export const getApiErrorMessage = (error: unknown): string =>
  error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
