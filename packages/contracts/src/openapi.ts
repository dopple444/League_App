type JsonObject = Readonly<Record<string, unknown>>;

const ref = (name: string): JsonObject => ({ $ref: `#/components/schemas/${name}` });
const content = (schema: JsonObject) => ({ 'application/json': { schema } });
const response = (schema: JsonObject, description = 'Successful response') => ({
  description,
  content: content(schema),
});
const body = (schema: JsonObject) => ({ required: true, content: content(schema) });
const id = { type: 'string', format: 'uuid' } as const;
const slug = {
  type: 'string',
  pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  minLength: 2,
  maxLength: 80,
} as const;
const version = { type: 'integer', minimum: 1 } as const;
const path = (name: string) => ({
  name,
  in: 'path',
  required: true,
  schema: name.endsWith('Id') ? id : slug,
});
const idempotency = {
  name: 'Idempotency-Key',
  in: 'header',
  required: true,
  schema: { type: 'string', minLength: 1, maxLength: 200 },
} as const;
const errors = {
  '400': { description: 'Invalid request', content: content(ref('ErrorEnvelope')) },
  '401': { description: 'Authentication required', content: content(ref('ErrorEnvelope')) },
  '403': { description: 'Permission denied', content: content(ref('ErrorEnvelope')) },
  '404': { description: 'Resource not found', content: content(ref('ErrorEnvelope')) },
  '409': { description: 'Version or idempotency conflict', content: content(ref('ErrorEnvelope')) },
};
const secure = [{ sessionCookie: [] }];
const expectedVersionBody = body({
  type: 'object',
  additionalProperties: false,
  required: ['expectedVersion'],
  properties: { expectedVersion: version },
});

export const openApiDocument: Readonly<Record<string, unknown>> = {
  openapi: '3.1.0',
  info: {
    title: 'Softball League Platform API',
    version: '1.0.0',
    description: 'Tenant-scoped authoritative commands and allowlisted public snapshots.',
  },
  tags: [
    { name: 'Identity' },
    { name: 'Seasons' },
    { name: 'Teams' },
    { name: 'Governance' },
    { name: 'Public' },
  ],
  paths: {
    '/api/v1/me/organizations': {
      get: {
        operationId: 'listMyOrganizations',
        tags: ['Identity'],
        security: secure,
        responses: { '200': response(ref('OrganizationMembershipList')), ...errors },
      },
    },
    '/api/v1/organizations/{organizationId}/seasons': {
      parameters: [path('organizationId')],
      get: {
        operationId: 'listSeasons',
        tags: ['Seasons'],
        security: secure,
        responses: { '200': response(ref('SeasonAdminList')), ...errors },
      },
      post: {
        operationId: 'createSeason',
        tags: ['Seasons'],
        security: secure,
        parameters: [idempotency],
        requestBody: body(ref('CreateSeasonInput')),
        responses: { '201': response(ref('SeasonAdmin'), 'Season created'), ...errors },
      },
    },
    '/api/v1/organizations/{organizationId}/seasons/{seasonId}': {
      parameters: [path('organizationId'), path('seasonId')],
      patch: {
        operationId: 'updateSeason',
        tags: ['Seasons'],
        security: secure,
        parameters: [idempotency],
        requestBody: body(ref('UpdateSeasonInput')),
        responses: { '200': response(ref('SeasonAdmin')), ...errors },
      },
    },
    '/api/v1/organizations/{organizationId}/seasons/{seasonId}/publication': {
      parameters: [path('organizationId'), path('seasonId')],
      post: {
        operationId: 'publishSeason',
        tags: ['Seasons'],
        security: secure,
        parameters: [idempotency],
        requestBody: expectedVersionBody,
        responses: { '200': response(ref('Publication')), ...errors },
      },
      delete: {
        operationId: 'withdrawSeason',
        tags: ['Seasons'],
        security: secure,
        parameters: [idempotency],
        requestBody: expectedVersionBody,
        responses: { '200': response(ref('Publication')), ...errors },
      },
    },
    '/api/v1/organizations/{organizationId}/seasons/{seasonId}/teams': {
      parameters: [path('organizationId'), path('seasonId')],
      get: {
        operationId: 'listTeams',
        tags: ['Teams'],
        security: secure,
        responses: { '200': response(ref('TeamAdminList')), ...errors },
      },
      post: {
        operationId: 'createTeam',
        tags: ['Teams'],
        security: secure,
        parameters: [idempotency],
        requestBody: body(ref('CreateTeamInput')),
        responses: { '201': response(ref('TeamAdmin'), 'Team created'), ...errors },
      },
    },
    '/api/v1/organizations/{organizationId}/seasons/{seasonId}/teams/{teamSeasonId}': {
      parameters: [path('organizationId'), path('seasonId'), path('teamSeasonId')],
      patch: {
        operationId: 'updateTeam',
        tags: ['Teams'],
        security: secure,
        parameters: [idempotency],
        requestBody: body(ref('UpdateTeamInput')),
        responses: { '200': response(ref('TeamAdmin')), ...errors },
      },
    },
    '/api/v1/organizations/{organizationId}/seasons/{seasonId}/teams/{teamSeasonId}/publication': {
      parameters: [path('organizationId'), path('seasonId'), path('teamSeasonId')],
      post: {
        operationId: 'publishTeam',
        tags: ['Teams'],
        security: secure,
        parameters: [idempotency],
        requestBody: expectedVersionBody,
        responses: { '200': response(ref('Publication')), ...errors },
      },
      delete: {
        operationId: 'withdrawTeam',
        tags: ['Teams'],
        security: secure,
        parameters: [idempotency],
        requestBody: expectedVersionBody,
        responses: { '200': response(ref('Publication')), ...errors },
      },
    },
    '/api/v1/organizations/{organizationId}/audit-events': {
      parameters: [path('organizationId')],
      get: {
        operationId: 'listAuditEvents',
        tags: ['Governance'],
        security: secure,
        responses: { '200': response(ref('AuditEventList')), ...errors },
      },
    },
    '/api/v1/organizations/{organizationId}/role-assignments': {
      parameters: [path('organizationId')],
      post: {
        operationId: 'createRoleAssignment',
        tags: ['Governance'],
        security: secure,
        parameters: [idempotency],
        requestBody: body(ref('CreateRoleAssignmentInput')),
        responses: { '201': response(ref('RoleAssignment'), 'Role assignment created'), ...errors },
      },
    },
    '/api/v1/organizations/{organizationId}/role-assignments/{roleAssignmentId}': {
      parameters: [path('organizationId'), path('roleAssignmentId')],
      delete: {
        operationId: 'revokeRoleAssignment',
        tags: ['Governance'],
        security: secure,
        parameters: [idempotency],
        requestBody: body(ref('RevokeRoleAssignmentInput')),
        responses: { '200': response(ref('RoleAssignment')), ...errors },
      },
    },
    '/api/v1/public/{organizationSlug}/{leagueSlug}': {
      parameters: [path('organizationSlug'), path('leagueSlug')],
      get: {
        operationId: 'getPublicLeague',
        tags: ['Public'],
        security: [],
        responses: { '200': response(ref('PublicLeagueHome')), '404': errors['404'] },
      },
    },
    '/api/v1/public/{organizationSlug}/{leagueSlug}/seasons/{seasonSlug}/teams': {
      parameters: [path('organizationSlug'), path('leagueSlug'), path('seasonSlug')],
      get: {
        operationId: 'listPublicTeams',
        tags: ['Public'],
        security: [],
        responses: { '200': response(ref('PublicTeamList')), '404': errors['404'] },
      },
    },
    '/api/v1/public/{organizationSlug}/{leagueSlug}/seasons/{seasonSlug}/schedule': {
      parameters: [path('organizationSlug'), path('leagueSlug'), path('seasonSlug')],
      get: {
        operationId: 'getPublicSchedule',
        tags: ['Public'],
        security: [],
        responses: { '200': response(ref('PublicSchedule')), '404': errors['404'] },
      },
    },
  },
  components: {
    securitySchemes: {
      sessionCookie: { type: 'apiKey', in: 'cookie', name: 'better-auth.session_token' },
    },
    schemas: {
      ErrorEnvelope: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'message', 'requestId'],
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          requestId: { type: 'string' },
          fieldErrors: {
            type: 'object',
            additionalProperties: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      LeagueReference: {
        type: 'object',
        additionalProperties: false,
        required: ['leagueId', 'slug', 'name'],
        properties: { leagueId: id, slug, name: { type: 'string' } },
      },
      OrganizationMembership: {
        type: 'object',
        additionalProperties: false,
        required: ['organizationId', 'slug', 'name', 'timezone', 'permissions', 'leagues'],
        properties: {
          organizationId: id,
          slug,
          name: { type: 'string' },
          timezone: { type: 'string' },
          permissions: { type: 'array', items: { type: 'string' } },
          leagues: { type: 'array', items: ref('LeagueReference') },
        },
      },
      OrganizationMembershipList: {
        type: 'object',
        required: ['items'],
        properties: { items: { type: 'array', items: ref('OrganizationMembership') } },
      },
      CreateSeasonInput: {
        type: 'object',
        additionalProperties: false,
        required: ['leagueId', 'name', 'slug', 'startDate', 'endDate', 'timezone'],
        properties: {
          leagueId: id,
          name: { type: 'string', minLength: 1, maxLength: 120 },
          slug,
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          timezone: { type: 'string' },
        },
      },
      UpdateSeasonInput: {
        type: 'object',
        additionalProperties: false,
        required: ['expectedVersion'],
        properties: {
          expectedVersion: version,
          name: { type: 'string', minLength: 1, maxLength: 120 },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          timezone: { type: 'string' },
        },
      },
      SeasonAdmin: {
        type: 'object',
        additionalProperties: false,
        required: [
          'organizationId',
          'seasonId',
          'leagueId',
          'name',
          'slug',
          'startDate',
          'endDate',
          'timezone',
          'version',
          'published',
        ],
        properties: {
          organizationId: id,
          seasonId: id,
          leagueId: id,
          name: { type: 'string' },
          slug,
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          timezone: { type: 'string' },
          version,
          published: { type: 'boolean' },
        },
      },
      SeasonAdminList: {
        type: 'object',
        required: ['items'],
        properties: { items: { type: 'array', items: ref('SeasonAdmin') } },
      },
      CreateTeamInput: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'publicName', 'slug'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 120 },
          publicName: { type: 'string', minLength: 1, maxLength: 120 },
          slug,
        },
      },
      UpdateTeamInput: {
        type: 'object',
        additionalProperties: false,
        required: ['expectedVersion'],
        properties: {
          expectedVersion: version,
          name: { type: 'string', minLength: 1, maxLength: 120 },
          publicName: { type: 'string', minLength: 1, maxLength: 120 },
          slug,
        },
      },
      TeamAdmin: {
        type: 'object',
        additionalProperties: false,
        required: [
          'organizationId',
          'teamSeasonId',
          'teamId',
          'seasonId',
          'name',
          'publicName',
          'slug',
          'version',
          'published',
        ],
        properties: {
          organizationId: id,
          teamSeasonId: id,
          teamId: id,
          seasonId: id,
          name: { type: 'string' },
          publicName: { type: 'string' },
          slug,
          version,
          published: { type: 'boolean' },
        },
      },
      TeamAdminList: {
        type: 'object',
        required: ['items'],
        properties: { items: { type: 'array', items: ref('TeamAdmin') } },
      },
      Publication: {
        type: 'object',
        additionalProperties: false,
        required: [
          'resourceKind',
          'resourceId',
          'revision',
          'publishedAt',
          'active',
          'resourceVersion',
        ],
        properties: {
          resourceKind: { type: 'string', enum: ['SEASON', 'TEAM_SEASON', 'SCHEDULE'] },
          resourceId: id,
          revision: version,
          publishedAt: { type: 'string', format: 'date-time' },
          active: { type: 'boolean' },
          resourceVersion: version,
        },
      },
      AuditEvent: {
        type: 'object',
        additionalProperties: false,
        required: [
          'auditEventId',
          'organizationId',
          'actorUserId',
          'action',
          'targetType',
          'targetId',
          'before',
          'after',
          'reason',
          'occurredAt',
          'requestId',
          'source',
        ],
        properties: {
          auditEventId: id,
          organizationId: id,
          actorUserId: { anyOf: [id, { type: 'null' }] },
          action: { type: 'string' },
          targetType: { type: 'string' },
          targetId: { type: 'string' },
          before: {},
          after: {},
          reason: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          occurredAt: { type: 'string', format: 'date-time' },
          requestId: { type: 'string' },
          source: { type: 'string', enum: ['WEB', 'MOBILE', 'API', 'WORKER', 'SYSTEM'] },
        },
      },
      AuditEventList: {
        type: 'object',
        required: ['items'],
        properties: { items: { type: 'array', items: ref('AuditEvent') } },
      },
      CreateRoleAssignmentInput: {
        type: 'object',
        additionalProperties: false,
        required: ['membershipId', 'roleId', 'validFrom', 'reason'],
        properties: {
          membershipId: id,
          roleId: id,
          validFrom: { type: 'string', format: 'date-time' },
          expiresAt: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
          reason: { type: 'string', minLength: 1, maxLength: 500 },
        },
      },
      RevokeRoleAssignmentInput: {
        type: 'object',
        additionalProperties: false,
        required: ['expectedVersion', 'reason'],
        properties: {
          expectedVersion: version,
          reason: { type: 'string', minLength: 1, maxLength: 500 },
        },
      },
      RoleAssignment: {
        type: 'object',
        additionalProperties: false,
        required: [
          'roleAssignmentId',
          'membershipId',
          'roleId',
          'validFrom',
          'expiresAt',
          'revokedAt',
          'version',
        ],
        properties: {
          roleAssignmentId: id,
          membershipId: id,
          roleId: id,
          validFrom: { type: 'string', format: 'date-time' },
          expiresAt: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
          revokedAt: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
          version,
        },
      },
      PublicOrganization: {
        type: 'object',
        additionalProperties: false,
        required: ['slug', 'name'],
        properties: { slug, name: { type: 'string' } },
      },
      PublicLeague: {
        type: 'object',
        additionalProperties: false,
        required: ['slug', 'name'],
        properties: { slug, name: { type: 'string' } },
      },
      PublicSeason: {
        type: 'object',
        additionalProperties: false,
        required: ['seasonId', 'slug', 'name', 'startDate', 'endDate', 'timezone'],
        properties: {
          seasonId: id,
          slug,
          name: { type: 'string' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          timezone: { type: 'string' },
        },
      },
      PublicLeagueHome: {
        type: 'object',
        additionalProperties: false,
        required: ['organization', 'league', 'currentSeason'],
        properties: {
          organization: ref('PublicOrganization'),
          league: ref('PublicLeague'),
          currentSeason: { anyOf: [ref('PublicSeason'), { type: 'null' }] },
        },
      },
      PublicTeam: {
        type: 'object',
        additionalProperties: false,
        required: ['teamSeasonId', 'slug', 'publicName'],
        properties: { teamSeasonId: id, slug, publicName: { type: 'string' } },
      },
      PublicTeamList: {
        type: 'object',
        additionalProperties: false,
        required: ['season', 'items'],
        properties: {
          season: ref('PublicSeason'),
          items: { type: 'array', items: ref('PublicTeam') },
        },
      },
      PublicField: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'directions'],
        properties: {
          name: { type: 'string' },
          directions: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        },
      },
      PublicGame: {
        type: 'object',
        additionalProperties: false,
        required: ['gameId', 'startsAt', 'status', 'homeTeam', 'awayTeam', 'field'],
        properties: {
          gameId: id,
          startsAt: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['SCHEDULED', 'POSTPONED', 'CANCELED', 'FINAL'] },
          homeTeam: ref('PublicTeam'),
          awayTeam: ref('PublicTeam'),
          field: ref('PublicField'),
        },
      },
      PublicSchedule: {
        type: 'object',
        additionalProperties: false,
        required: ['season', 'items'],
        properties: {
          season: ref('PublicSeason'),
          items: { type: 'array', items: ref('PublicGame') },
        },
      },
    },
  },
};
