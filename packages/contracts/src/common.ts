import { z } from 'zod';

export const identifierSchema = z.uuid();
export const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const localDateSchema = z.iso.date();
export const utcDateTimeSchema = z.iso.datetime({ offset: true });
export const timeZoneSchema = z.string().min(1).max(64);

export const errorEnvelopeSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

export const expectedVersionSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const publicationSchema = z.object({
  resourceKind: z.enum(['SEASON', 'TEAM_SEASON', 'SCHEDULE']),
  resourceId: identifierSchema,
  revision: z.number().int().positive(),
  publishedAt: utcDateTimeSchema,
  active: z.boolean(),
  resourceVersion: z.number().int().positive(),
});

export type PublicationDto = z.infer<typeof publicationSchema>;
