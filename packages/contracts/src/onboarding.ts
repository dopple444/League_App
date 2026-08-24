import { z } from 'zod';

import { identifierSchema, slugSchema, timeZoneSchema, utcDateTimeSchema } from './common.js';

const organizationNameSchema = z.string().trim().min(1).max(160);
const leagueNameSchema = z.string().trim().min(1).max(160);
const administratorNameSchema = z.string().trim().min(1).max(120);
const administratorEmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
const passwordSchema = z.string().min(12).max(128);
const reasonSchema = z.string().trim().min(1).max(500);

// The bearer format is intentionally opaque to clients. It is bounded here only so malformed
// requests cannot turn token processing into an unbounded input path.
export const administratorInvitationTokenSchema = z.string().trim().min(32).max(512);

export const platformInvitationStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED_PENDING_MFA',
  'ACTIVATED',
  'EXPIRED',
  'REVOKED',
]);

export const provisionPlatformOnboardingSchema = z
  .object({
    organizationName: organizationNameSchema,
    organizationSlug: slugSchema,
    timezone: timeZoneSchema,
    leagueName: leagueNameSchema,
    leagueSlug: slugSchema,
    administratorEmail: administratorEmailSchema,
    invitationExpiresInHours: z.number().int().min(1).max(720),
    reason: reasonSchema,
  })
  .strict();

export const platformOnboardingSchema = z
  .object({
    organizationId: identifierSchema,
    organizationName: organizationNameSchema,
    organizationSlug: slugSchema,
    timezone: timeZoneSchema,
    leagueId: identifierSchema,
    leagueName: leagueNameSchema,
    leagueSlug: slugSchema,
    invitationId: identifierSchema,
    administratorEmail: administratorEmailSchema,
    status: platformInvitationStatusSchema,
    expiresAt: utcDateTimeSchema,
    acceptedAt: utcDateTimeSchema.nullable(),
    revokedAt: utcDateTimeSchema.nullable(),
    activatedAt: utcDateTimeSchema.nullable(),
    version: z.number().int().positive(),
    createdAt: utcDateTimeSchema,
  })
  .strict();

export const platformOnboardingListSchema = z
  .object({
    canProvisionTenants: z.boolean(),
    canRevokeInvitations: z.boolean(),
    items: z.array(platformOnboardingSchema).max(200),
  })
  .strict();

export const provisionPlatformOnboardingResultSchema = platformOnboardingSchema
  .extend({
    // This copy-once bearer is the only response field allowed to contain a raw invitation token.
    invitationToken: administratorInvitationTokenSchema,
  })
  .strict();

export const revokePlatformInvitationSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    reason: reasonSchema,
  })
  .strict();

export const inspectAdministratorInvitationSchema = z
  .object({ invitationToken: administratorInvitationTokenSchema })
  .strict();

export const administratorInvitationContextSchema = z
  .object({
    organizationName: organizationNameSchema,
    leagueName: leagueNameSchema,
    administratorEmailHint: z.string().min(3).max(254),
    expiresAt: utcDateTimeSchema,
  })
  .strict();

export const registerAdministratorInvitationSchema = z
  .object({
    invitationToken: administratorInvitationTokenSchema,
    name: administratorNameSchema,
    password: passwordSchema,
  })
  .strict();

export const administratorInvitationRegistrationSchema = z
  .object({ continueToSignIn: z.literal(true) })
  .strict();

export const acceptAdministratorInvitationSchema = z
  .object({ invitationToken: administratorInvitationTokenSchema })
  .strict();

export const administratorInvitationAcceptanceSchema = z
  .object({
    accepted: z.literal(true),
    membershipStatus: z.literal('PENDING'),
    mfaRequired: z.literal(true),
    acceptedAt: utcDateTimeSchema,
  })
  .strict();

export const activatePendingMembershipsSchema = z.object({}).strict();

export const onboardingActivationSchema = z
  .object({
    organizationId: identifierSchema,
    membershipId: identifierSchema,
    membershipStatus: z.literal('ACTIVE'),
    activatedAt: utcDateTimeSchema,
  })
  .strict();

export const onboardingActivationListSchema = z
  .object({ items: z.array(onboardingActivationSchema).max(200) })
  .strict();

export type PlatformInvitationStatus = z.infer<typeof platformInvitationStatusSchema>;
export type ProvisionPlatformOnboardingInput = z.input<typeof provisionPlatformOnboardingSchema>;
export type PlatformOnboardingDto = z.infer<typeof platformOnboardingSchema>;
export type PlatformOnboardingListDto = z.infer<typeof platformOnboardingListSchema>;
export type ProvisionPlatformOnboardingResultDto = z.infer<
  typeof provisionPlatformOnboardingResultSchema
>;
export type RevokePlatformInvitationInput = z.input<typeof revokePlatformInvitationSchema>;
export type InspectAdministratorInvitationInput = z.input<
  typeof inspectAdministratorInvitationSchema
>;
export type AdministratorInvitationContextDto = z.infer<
  typeof administratorInvitationContextSchema
>;
export type RegisterAdministratorInvitationInput = z.input<
  typeof registerAdministratorInvitationSchema
>;
export type AdministratorInvitationRegistrationDto = z.infer<
  typeof administratorInvitationRegistrationSchema
>;
export type AcceptAdministratorInvitationInput = z.input<
  typeof acceptAdministratorInvitationSchema
>;
export type AdministratorInvitationAcceptanceDto = z.infer<
  typeof administratorInvitationAcceptanceSchema
>;
export type ActivatePendingMembershipsInput = z.input<typeof activatePendingMembershipsSchema>;
export type OnboardingActivationDto = z.infer<typeof onboardingActivationSchema>;
export type OnboardingActivationListDto = z.infer<typeof onboardingActivationListSchema>;
