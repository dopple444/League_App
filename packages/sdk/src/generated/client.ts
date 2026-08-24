/* This file is generated from packages/contracts/src/openapi.ts. */
import type {
  AcceptAdministratorInvitationInput,
  AdministratorInvitationAcceptanceDto,
  AdministratorInvitationContextDto,
  AdministratorInvitationRegistrationDto,
  AuditEventListDto,
  CreateFieldInput,
  CreateLeagueInput,
  CreateRoleAssignmentInput,
  CreateSeasonInput,
  CreateTeamInput,
  CreateVenueInput,
  ErrorEnvelope,
  FieldAdminDto,
  InspectAdministratorInvitationInput,
  LeagueAdminDto,
  LeagueAdminListDto,
  OnboardingActivationListDto,
  OrganizationMembershipListDto,
  PlatformOnboardingDto,
  PlatformOnboardingListDto,
  PublicationDto,
  PublicLeagueHomeDto,
  PublicScheduleDto,
  PublicTeamListDto,
  ProvisionPlatformOnboardingInput,
  ProvisionPlatformOnboardingResultDto,
  RegisterAdministratorInvitationInput,
  RevokePlatformInvitationInput,
  RevokeRoleAssignmentInput,
  RoleAssignmentDto,
  SecurityPostureDto,
  SeasonAdminDto,
  SeasonAdminListDto,
  TeamAdminDto,
  TeamAdminListDto,
  UpdateFieldInput,
  UpdateLeagueInput,
  UpdateSeasonInput,
  UpdateTeamInput,
  UpdateVenueInput,
  VenueAdminDto,
  VenueAdminListDto,
} from '@league/contracts';

export type * from '@league/contracts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ErrorEnvelope,
  ) {
    super(body.message);
    this.name = 'ApiError';
  }
}

export interface LeagueApiClientOptions {
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
}

interface MutationOptions {
  readonly idempotencyKey: string;
}

function segment(value: string): string {
  return encodeURIComponent(value);
}

export class LeagueApiClient {
  private readonly fetcher: typeof globalThis.fetch;

  constructor(private readonly options: LeagueApiClientOptions) {
    this.fetcher = options.fetch ?? ((...args) => globalThis.fetch(...args));
  }

  private async request<TResult>(path: string, init: RequestInit = {}): Promise<TResult> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');

    let response: Response;
    try {
      response = await this.fetcher(new URL(path, this.options.baseUrl), {
        ...init,
        credentials: 'include',
        headers,
      });
    } catch {
      throw new ApiError(0, {
        code: 'NETWORK_ERROR',
        message: 'The service could not be reached.',
        requestId: 'unavailable',
      });
    }

    if (response.status === 204) {
      return undefined as TResult;
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ApiError(response.status, {
        code: 'INVALID_RESPONSE',
        message: 'The service returned an unreadable response.',
        requestId: response.headers.get('x-request-id') ?? 'unavailable',
      });
    }

    if (!response.ok) {
      const candidate = body as Partial<ErrorEnvelope>;
      throw new ApiError(response.status, {
        code: typeof candidate.code === 'string' ? candidate.code : 'REQUEST_FAILED',
        message:
          typeof candidate.message === 'string'
            ? candidate.message
            : 'The request could not be completed.',
        requestId:
          typeof candidate.requestId === 'string'
            ? candidate.requestId
            : (response.headers.get('x-request-id') ?? 'unavailable'),
        ...(candidate.fieldErrors === undefined ? {} : { fieldErrors: candidate.fieldErrors }),
      });
    }
    return body as TResult;
  }

  private mutation<TResult>(
    path: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    body: unknown,
    options: MutationOptions,
  ): Promise<TResult> {
    return this.request<TResult>(path, {
      method,
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': options.idempotencyKey },
      body: JSON.stringify(body),
    });
  }

  private post<TResult>(path: string, body: unknown): Promise<TResult> {
    return this.request<TResult>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  listMyOrganizations(): Promise<OrganizationMembershipListDto> {
    return this.request('/api/v1/me/organizations');
  }

  getMySecurityPosture(): Promise<SecurityPostureDto> {
    return this.request('/api/v1/me/security');
  }

  listPlatformOnboarding(): Promise<PlatformOnboardingListDto> {
    return this.request('/api/v1/platform/onboarding');
  }

  provisionPlatformOnboarding(
    input: ProvisionPlatformOnboardingInput,
    options: MutationOptions,
  ): Promise<ProvisionPlatformOnboardingResultDto> {
    return this.mutation('/api/v1/platform/onboarding', 'POST', input, options);
  }

  revokePlatformInvitation(
    invitationId: string,
    input: RevokePlatformInvitationInput,
    options: MutationOptions,
  ): Promise<PlatformOnboardingDto> {
    return this.mutation(
      `/api/v1/platform/invitations/${segment(invitationId)}/revoke`,
      'POST',
      input,
      options,
    );
  }

  inspectAdministratorInvitation(
    input: InspectAdministratorInvitationInput,
  ): Promise<AdministratorInvitationContextDto> {
    return this.post('/api/v1/onboarding/invitations/inspect', input);
  }

  registerAdministratorInvitation(
    input: RegisterAdministratorInvitationInput,
  ): Promise<AdministratorInvitationRegistrationDto> {
    return this.post('/api/v1/onboarding/invitations/register', input);
  }

  acceptAdministratorInvitation(
    input: AcceptAdministratorInvitationInput,
    options: MutationOptions,
  ): Promise<AdministratorInvitationAcceptanceDto> {
    return this.mutation('/api/v1/onboarding/invitations/accept', 'POST', input, options);
  }

  activatePendingMemberships(): Promise<OnboardingActivationListDto> {
    return this.post('/api/v1/onboarding/activations', {});
  }

  listLeagues(organizationId: string): Promise<LeagueAdminListDto> {
    return this.request(`/api/v1/organizations/${segment(organizationId)}/leagues`);
  }

  createLeague(
    organizationId: string,
    input: CreateLeagueInput,
    options: MutationOptions,
  ): Promise<LeagueAdminDto> {
    return this.mutation(
      `/api/v1/organizations/${segment(organizationId)}/leagues`,
      'POST',
      input,
      options,
    );
  }

  updateLeague(
    organizationId: string,
    leagueId: string,
    input: UpdateLeagueInput,
    options: MutationOptions,
  ): Promise<LeagueAdminDto> {
    return this.mutation(
      `/api/v1/organizations/${segment(organizationId)}/leagues/${segment(leagueId)}`,
      'PATCH',
      input,
      options,
    );
  }

  listSeasons(organizationId: string): Promise<SeasonAdminListDto> {
    return this.request(`/api/v1/organizations/${segment(organizationId)}/seasons`);
  }

  createSeason(
    organizationId: string,
    input: CreateSeasonInput,
    options: MutationOptions,
  ): Promise<SeasonAdminDto> {
    return this.mutation(
      `/api/v1/organizations/${segment(organizationId)}/seasons`,
      'POST',
      input,
      options,
    );
  }

  updateSeason(
    organizationId: string,
    seasonId: string,
    input: UpdateSeasonInput,
    options: MutationOptions,
  ): Promise<SeasonAdminDto> {
    return this.mutation(
      `/api/v1/organizations/${segment(organizationId)}/seasons/${segment(seasonId)}`,
      'PATCH',
      input,
      options,
    );
  }

  publishSeason(
    organizationId: string,
    seasonId: string,
    expectedVersion: number,
    options: MutationOptions,
  ): Promise<PublicationDto> {
    return this.mutation(
      `/api/v1/organizations/${segment(organizationId)}/seasons/${segment(seasonId)}/publication`,
      'POST',
      { expectedVersion },
      options,
    );
  }

  withdrawSeason(
    organizationId: string,
    seasonId: string,
    expectedVersion: number,
    options: MutationOptions,
  ): Promise<PublicationDto> {
    return this.mutation(
      `/api/v1/organizations/${segment(organizationId)}/seasons/${segment(seasonId)}/publication`,
      'DELETE',
      { expectedVersion },
      options,
    );
  }

  listTeams(organizationId: string, seasonId: string): Promise<TeamAdminListDto> {
    return this.request(
      `/api/v1/organizations/${segment(organizationId)}/seasons/${segment(seasonId)}/teams`,
    );
  }

  createTeam(
    organizationId: string,
    seasonId: string,
    input: CreateTeamInput,
    options: MutationOptions,
  ): Promise<TeamAdminDto> {
    return this.mutation(
      `/api/v1/organizations/${segment(organizationId)}/seasons/${segment(seasonId)}/teams`,
      'POST',
      input,
      options,
    );
  }

  updateTeam(
    organizationId: string,
    seasonId: string,
    teamSeasonId: string,
    input: UpdateTeamInput,
    options: MutationOptions,
  ): Promise<TeamAdminDto> {
    return this.mutation(
      `/api/v1/organizations/${segment(organizationId)}/seasons/${segment(seasonId)}/teams/${segment(teamSeasonId)}`,
      'PATCH',
      input,
      options,
    );
  }

  publishTeam(
    organizationId: string,
    seasonId: string,
    teamSeasonId: string,
    expectedVersion: number,
    options: MutationOptions,
  ): Promise<PublicationDto> {
    return this.mutation(
      `/api/v1/organizations/${segment(organizationId)}/seasons/${segment(seasonId)}/teams/${segment(teamSeasonId)}/publication`,
      'POST',
      { expectedVersion },
      options,
    );
  }

  withdrawTeam(
    organizationId: string,
    seasonId: string,
    teamSeasonId: string,
    expectedVersion: number,
    options: MutationOptions,
  ): Promise<PublicationDto> {
    return this.mutation(
      `/api/v1/organizations/${segment(organizationId)}/seasons/${segment(seasonId)}/teams/${segment(teamSeasonId)}/publication`,
      'DELETE',
      { expectedVersion },
      options,
    );
  }

  listVenues(organizationId: string): Promise<VenueAdminListDto> {
    return this.request(`/api/v1/organizations/${segment(organizationId)}/venues`);
  }

  createVenue(
    organizationId: string,
    input: CreateVenueInput,
    options: MutationOptions,
  ): Promise<VenueAdminDto> {
    return this.mutation(
      `/api/v1/organizations/${segment(organizationId)}/venues`,
      'POST',
      input,
      options,
    );
  }

  updateVenue(
    organizationId: string,
    venueId: string,
    input: UpdateVenueInput,
    options: MutationOptions,
  ): Promise<VenueAdminDto> {
    return this.mutation(
      `/api/v1/organizations/${segment(organizationId)}/venues/${segment(venueId)}`,
      'PATCH',
      input,
      options,
    );
  }

  createField(
    organizationId: string,
    venueId: string,
    input: CreateFieldInput,
    options: MutationOptions,
  ): Promise<FieldAdminDto> {
    return this.mutation(
      `/api/v1/organizations/${segment(organizationId)}/venues/${segment(venueId)}/fields`,
      'POST',
      input,
      options,
    );
  }

  updateField(
    organizationId: string,
    venueId: string,
    fieldId: string,
    input: UpdateFieldInput,
    options: MutationOptions,
  ): Promise<FieldAdminDto> {
    return this.mutation(
      `/api/v1/organizations/${segment(organizationId)}/venues/${segment(venueId)}/fields/${segment(fieldId)}`,
      'PATCH',
      input,
      options,
    );
  }

  listAuditEvents(organizationId: string): Promise<AuditEventListDto> {
    return this.request(`/api/v1/organizations/${segment(organizationId)}/audit-events`);
  }

  createRoleAssignment(
    organizationId: string,
    input: CreateRoleAssignmentInput,
    options: MutationOptions,
  ): Promise<RoleAssignmentDto> {
    return this.mutation(
      `/api/v1/organizations/${segment(organizationId)}/role-assignments`,
      'POST',
      input,
      options,
    );
  }

  revokeRoleAssignment(
    organizationId: string,
    roleAssignmentId: string,
    input: RevokeRoleAssignmentInput,
    options: MutationOptions,
  ): Promise<RoleAssignmentDto> {
    return this.mutation(
      `/api/v1/organizations/${segment(organizationId)}/role-assignments/${segment(roleAssignmentId)}`,
      'DELETE',
      input,
      options,
    );
  }

  getPublicLeague(organizationSlug: string, leagueSlug: string): Promise<PublicLeagueHomeDto> {
    return this.request(`/api/v1/public/${segment(organizationSlug)}/${segment(leagueSlug)}`);
  }

  listPublicTeams(
    organizationSlug: string,
    leagueSlug: string,
    seasonSlug: string,
  ): Promise<PublicTeamListDto> {
    return this.request(
      `/api/v1/public/${segment(organizationSlug)}/${segment(leagueSlug)}/seasons/${segment(seasonSlug)}/teams`,
    );
  }

  getPublicSchedule(
    organizationSlug: string,
    leagueSlug: string,
    seasonSlug: string,
  ): Promise<PublicScheduleDto> {
    return this.request(
      `/api/v1/public/${segment(organizationSlug)}/${segment(leagueSlug)}/seasons/${segment(seasonSlug)}/schedule`,
    );
  }
}
