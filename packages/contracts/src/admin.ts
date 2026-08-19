import { z } from 'zod';

import {
  expectedVersionSchema,
  identifierSchema,
  localDateSchema,
  slugSchema,
  timeZoneSchema,
  utcDateTimeSchema,
} from './common.js';

export const organizationMembershipSchema = z.object({
  organizationId: identifierSchema,
  slug: slugSchema,
  name: z.string().min(1).max(160),
  timezone: timeZoneSchema,
  permissions: z.array(z.string()),
  leagues: z.array(
    z.object({
      leagueId: identifierSchema,
      slug: slugSchema,
      name: z.string().min(1).max(160),
    }),
  ),
});

export const organizationMembershipListSchema = z.object({
  items: z.array(organizationMembershipSchema),
});

export type OrganizationMembershipDto = z.infer<typeof organizationMembershipSchema>;
export type OrganizationMembershipListDto = z.infer<typeof organizationMembershipListSchema>;

export const createSeasonSchema = z
  .object({
    leagueId: identifierSchema,
    name: z.string().trim().min(1).max(120),
    slug: slugSchema,
    startDate: localDateSchema,
    endDate: localDateSchema,
    timezone: timeZoneSchema,
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: 'End date must be on or after start date.',
    path: ['endDate'],
  });

export const updateSeasonSchema = expectedVersionSchema
  .extend({
    name: z.string().trim().min(1).max(120).optional(),
    startDate: localDateSchema.optional(),
    endDate: localDateSchema.optional(),
    timezone: timeZoneSchema.optional(),
  })
  .refine(
    (value) =>
      value.startDate === undefined ||
      value.endDate === undefined ||
      value.endDate >= value.startDate,
    { message: 'End date must be on or after start date.', path: ['endDate'] },
  );

export const seasonAdminSchema = z.object({
  organizationId: identifierSchema,
  seasonId: identifierSchema,
  leagueId: identifierSchema,
  name: z.string(),
  slug: slugSchema,
  startDate: localDateSchema,
  endDate: localDateSchema,
  timezone: timeZoneSchema,
  version: z.number().int().positive(),
  published: z.boolean(),
});

export const seasonAdminListSchema = z.object({ items: z.array(seasonAdminSchema) });

export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;
export type UpdateSeasonInput = z.infer<typeof updateSeasonSchema>;
export type SeasonAdminDto = z.infer<typeof seasonAdminSchema>;
export type SeasonAdminListDto = z.infer<typeof seasonAdminListSchema>;

export const createTeamSchema = z.object({
  name: z.string().trim().min(1).max(120),
  publicName: z.string().trim().min(1).max(120),
  slug: slugSchema,
});

export const updateTeamSchema = expectedVersionSchema.extend({
  name: z.string().trim().min(1).max(120).optional(),
  publicName: z.string().trim().min(1).max(120).optional(),
  slug: slugSchema.optional(),
});

export const teamAdminSchema = z.object({
  organizationId: identifierSchema,
  teamSeasonId: identifierSchema,
  teamId: identifierSchema,
  seasonId: identifierSchema,
  name: z.string(),
  publicName: z.string(),
  slug: slugSchema,
  version: z.number().int().positive(),
  published: z.boolean(),
});

export const teamAdminListSchema = z.object({ items: z.array(teamAdminSchema) });

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type TeamAdminDto = z.infer<typeof teamAdminSchema>;
export type TeamAdminListDto = z.infer<typeof teamAdminListSchema>;

export const auditEventSchema = z.object({
  auditEventId: identifierSchema,
  organizationId: identifierSchema,
  actorUserId: identifierSchema.nullable(),
  action: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  reason: z.string().nullable(),
  occurredAt: utcDateTimeSchema,
  requestId: z.string(),
  source: z.enum(['WEB', 'MOBILE', 'API', 'WORKER', 'SYSTEM']),
});

export const auditEventListSchema = z.object({ items: z.array(auditEventSchema) });
export type AuditEventDto = z.infer<typeof auditEventSchema>;
export type AuditEventListDto = z.infer<typeof auditEventListSchema>;

export const createRoleAssignmentSchema = z
  .object({
    membershipId: identifierSchema,
    roleId: identifierSchema,
    validFrom: utcDateTimeSchema,
    expiresAt: utcDateTimeSchema.nullable().optional(),
    reason: z.string().trim().min(1).max(500),
  })
  .refine(
    (value) =>
      value.expiresAt === undefined ||
      value.expiresAt === null ||
      value.expiresAt > value.validFrom,
    { message: 'Expiration must be after the effective time.', path: ['expiresAt'] },
  );

export const revokeRoleAssignmentSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500),
});

export type CreateRoleAssignmentInput = z.infer<typeof createRoleAssignmentSchema>;
export type RevokeRoleAssignmentInput = z.infer<typeof revokeRoleAssignmentSchema>;

export const roleAssignmentSchema = z.object({
  roleAssignmentId: identifierSchema,
  membershipId: identifierSchema,
  roleId: identifierSchema,
  validFrom: utcDateTimeSchema,
  expiresAt: utcDateTimeSchema.nullable(),
  revokedAt: utcDateTimeSchema.nullable(),
  version: z.number().int().positive(),
});

export type RoleAssignmentDto = z.infer<typeof roleAssignmentSchema>;
