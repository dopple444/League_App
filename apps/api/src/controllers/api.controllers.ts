import type { AuthenticatedUser } from '@league/auth';
import {
  createRoleAssignmentSchema,
  createSeasonSchema,
  createTeamSchema,
  expectedVersionSchema,
  identifierSchema,
  openApiDocument,
  revokeRoleAssignmentSchema,
  slugSchema,
  updateSeasonSchema,
  updateTeamSchema,
} from '@league/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';

import { AuthenticationRequiredError } from '../common/errors.js';
import { PublicRoute } from '../common/public.decorator.js';
import { type ApiRequest, requestMetadata, requireIdempotencyKey } from '../common/request.js';
import { AccessService } from '../services/access.service.js';
import { GovernanceService } from '../services/governance.service.js';
import type { MutationContext } from '../services/mutation.service.js';
import { PublicService } from '../services/public.service.js';
import { SeasonsService } from '../services/seasons.service.js';
import { TeamsService } from '../services/teams.service.js';

function user(request: ApiRequest): AuthenticatedUser {
  if (request.user === undefined) {
    throw new AuthenticationRequiredError();
  }
  return request.user;
}

function mutationContext(
  request: ApiRequest,
  organizationId: string,
  idempotencyKey: string | undefined,
): MutationContext {
  return {
    organizationId: identifierSchema.parse(organizationId),
    user: user(request),
    metadata: requestMetadata(request),
    idempotencyKey: requireIdempotencyKey(idempotencyKey),
  };
}

@Controller('api/v1/me')
export class MeController {
  constructor(@Inject(AccessService) private readonly access: AccessService) {}

  @Get('organizations')
  organizations(@Req() request: ApiRequest) {
    return this.access.listOrganizations(user(request), requestMetadata(request));
  }
}

@Controller('api/v1/organizations/:organizationId/seasons')
export class SeasonsController {
  constructor(@Inject(SeasonsService) private readonly seasons: SeasonsService) {}

  @Get()
  list(@Param('organizationId') organizationId: string, @Req() request: ApiRequest) {
    return this.seasons.list(
      identifierSchema.parse(organizationId),
      user(request),
      requestMetadata(request),
    );
  }

  @Post()
  create(
    @Param('organizationId') organizationId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() bodyValue: unknown,
    @Req() request: ApiRequest,
  ) {
    return this.seasons.create(
      mutationContext(request, organizationId, idempotencyKey),
      createSeasonSchema.parse(bodyValue),
    );
  }

  @Patch(':seasonId')
  update(
    @Param('organizationId') organizationId: string,
    @Param('seasonId') seasonId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() bodyValue: unknown,
    @Req() request: ApiRequest,
  ) {
    return this.seasons.update(
      mutationContext(request, organizationId, idempotencyKey),
      identifierSchema.parse(seasonId),
      updateSeasonSchema.parse(bodyValue),
    );
  }

  @Post(':seasonId/publication')
  @HttpCode(200)
  publish(
    @Param('organizationId') organizationId: string,
    @Param('seasonId') seasonId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() bodyValue: unknown,
    @Req() request: ApiRequest,
  ) {
    return this.seasons.publish(
      mutationContext(request, organizationId, idempotencyKey),
      identifierSchema.parse(seasonId),
      expectedVersionSchema.parse(bodyValue),
    );
  }

  @Delete(':seasonId/publication')
  withdraw(
    @Param('organizationId') organizationId: string,
    @Param('seasonId') seasonId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() bodyValue: unknown,
    @Req() request: ApiRequest,
  ) {
    return this.seasons.withdraw(
      mutationContext(request, organizationId, idempotencyKey),
      identifierSchema.parse(seasonId),
      expectedVersionSchema.parse(bodyValue),
    );
  }
}

@Controller('api/v1/organizations/:organizationId/seasons/:seasonId/teams')
export class TeamsController {
  constructor(@Inject(TeamsService) private readonly teams: TeamsService) {}

  @Get()
  list(
    @Param('organizationId') organizationId: string,
    @Param('seasonId') seasonId: string,
    @Req() request: ApiRequest,
  ) {
    return this.teams.list(
      identifierSchema.parse(organizationId),
      identifierSchema.parse(seasonId),
      user(request),
      requestMetadata(request),
    );
  }

  @Post()
  create(
    @Param('organizationId') organizationId: string,
    @Param('seasonId') seasonId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() bodyValue: unknown,
    @Req() request: ApiRequest,
  ) {
    return this.teams.create(
      mutationContext(request, organizationId, idempotencyKey),
      identifierSchema.parse(seasonId),
      createTeamSchema.parse(bodyValue),
    );
  }

  @Patch(':teamSeasonId')
  update(
    @Param('organizationId') organizationId: string,
    @Param('seasonId') seasonId: string,
    @Param('teamSeasonId') teamSeasonId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() bodyValue: unknown,
    @Req() request: ApiRequest,
  ) {
    return this.teams.update(
      mutationContext(request, organizationId, idempotencyKey),
      identifierSchema.parse(seasonId),
      identifierSchema.parse(teamSeasonId),
      updateTeamSchema.parse(bodyValue),
    );
  }

  @Post(':teamSeasonId/publication')
  @HttpCode(200)
  publish(
    @Param('organizationId') organizationId: string,
    @Param('seasonId') seasonId: string,
    @Param('teamSeasonId') teamSeasonId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() bodyValue: unknown,
    @Req() request: ApiRequest,
  ) {
    return this.teams.publish(
      mutationContext(request, organizationId, idempotencyKey),
      identifierSchema.parse(seasonId),
      identifierSchema.parse(teamSeasonId),
      expectedVersionSchema.parse(bodyValue),
    );
  }

  @Delete(':teamSeasonId/publication')
  withdraw(
    @Param('organizationId') organizationId: string,
    @Param('seasonId') seasonId: string,
    @Param('teamSeasonId') teamSeasonId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() bodyValue: unknown,
    @Req() request: ApiRequest,
  ) {
    return this.teams.withdraw(
      mutationContext(request, organizationId, idempotencyKey),
      identifierSchema.parse(seasonId),
      identifierSchema.parse(teamSeasonId),
      expectedVersionSchema.parse(bodyValue),
    );
  }
}

@Controller('api/v1/organizations/:organizationId')
export class GovernanceController {
  constructor(@Inject(GovernanceService) private readonly governance: GovernanceService) {}

  @Get('audit-events')
  audit(@Param('organizationId') organizationId: string, @Req() request: ApiRequest) {
    return this.governance.auditEvents(
      identifierSchema.parse(organizationId),
      user(request),
      requestMetadata(request),
    );
  }

  @Post('role-assignments')
  roleAssignment(
    @Param('organizationId') organizationId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() bodyValue: unknown,
    @Req() request: ApiRequest,
  ) {
    return this.governance.createRoleAssignment(
      mutationContext(request, organizationId, idempotencyKey),
      createRoleAssignmentSchema.parse(bodyValue),
    );
  }

  @Delete('role-assignments/:roleAssignmentId')
  revokeRoleAssignment(
    @Param('organizationId') organizationId: string,
    @Param('roleAssignmentId') roleAssignmentId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() bodyValue: unknown,
    @Req() request: ApiRequest,
  ) {
    return this.governance.revokeRoleAssignment(
      mutationContext(request, organizationId, idempotencyKey),
      identifierSchema.parse(roleAssignmentId),
      revokeRoleAssignmentSchema.parse(bodyValue),
    );
  }
}

@PublicRoute()
@Controller('api/v1/public/:organizationSlug/:leagueSlug')
export class PublicController {
  constructor(@Inject(PublicService) private readonly publicService: PublicService) {}

  @Get()
  league(
    @Param('organizationSlug') organizationSlug: string,
    @Param('leagueSlug') leagueSlug: string,
    @Req() request: ApiRequest,
  ) {
    return this.publicService.league(
      slugSchema.parse(organizationSlug),
      slugSchema.parse(leagueSlug),
      request.requestId ?? 'unavailable',
    );
  }

  @Get('seasons/:seasonSlug/teams')
  teams(
    @Param('organizationSlug') organizationSlug: string,
    @Param('leagueSlug') leagueSlug: string,
    @Param('seasonSlug') seasonSlug: string,
    @Req() request: ApiRequest,
  ) {
    return this.publicService.teams(
      slugSchema.parse(organizationSlug),
      slugSchema.parse(leagueSlug),
      slugSchema.parse(seasonSlug),
      request.requestId ?? 'unavailable',
    );
  }

  @Get('seasons/:seasonSlug/schedule')
  schedule(
    @Param('organizationSlug') organizationSlug: string,
    @Param('leagueSlug') leagueSlug: string,
    @Param('seasonSlug') seasonSlug: string,
    @Req() request: ApiRequest,
  ) {
    return this.publicService.schedule(
      slugSchema.parse(organizationSlug),
      slugSchema.parse(leagueSlug),
      slugSchema.parse(seasonSlug),
      request.requestId ?? 'unavailable',
    );
  }
}

@PublicRoute()
@Controller()
export class SystemController {
  @Get(['healthz', 'api/healthz'])
  health() {
    return { status: 'ok' };
  }

  @Get('api/openapi.json')
  openApi() {
    return openApiDocument;
  }
}
