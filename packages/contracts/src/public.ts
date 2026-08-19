import { z } from 'zod';

import {
  identifierSchema,
  localDateSchema,
  slugSchema,
  timeZoneSchema,
  utcDateTimeSchema,
} from './common.js';

export const publicOrganizationSchema = z.object({
  slug: slugSchema,
  name: z.string(),
});

export const publicLeagueSchema = z.object({
  slug: slugSchema,
  name: z.string(),
});

export const publicSeasonSchema = z.object({
  seasonId: identifierSchema,
  slug: slugSchema,
  name: z.string(),
  startDate: localDateSchema,
  endDate: localDateSchema,
  timezone: timeZoneSchema,
});

export const publicLeagueHomeSchema = z.object({
  organization: publicOrganizationSchema,
  league: publicLeagueSchema,
  currentSeason: publicSeasonSchema.nullable(),
});

export const publicTeamSchema = z.object({
  teamSeasonId: identifierSchema,
  slug: slugSchema,
  publicName: z.string(),
});

export const publicTeamListSchema = z.object({
  season: publicSeasonSchema,
  items: z.array(publicTeamSchema),
});

export const publicFieldSchema = z.object({
  name: z.string(),
  directions: z.string().nullable(),
});

export const publicGameSchema = z.object({
  gameId: identifierSchema,
  startsAt: utcDateTimeSchema,
  status: z.enum(['SCHEDULED', 'POSTPONED', 'CANCELED', 'FINAL']),
  homeTeam: publicTeamSchema,
  awayTeam: publicTeamSchema,
  field: publicFieldSchema,
});

export const publicScheduleSchema = z.object({
  season: publicSeasonSchema,
  items: z.array(publicGameSchema),
});

export const seasonPublicationPayloadSchema = publicLeagueHomeSchema;
export const teamPublicationPayloadSchema = z.object({
  seasonId: identifierSchema,
  team: publicTeamSchema,
});
export const schedulePublicationPayloadSchema = publicScheduleSchema;

export type PublicLeagueHomeDto = z.infer<typeof publicLeagueHomeSchema>;
export type PublicSeasonDto = z.infer<typeof publicSeasonSchema>;
export type PublicTeamDto = z.infer<typeof publicTeamSchema>;
export type PublicTeamListDto = z.infer<typeof publicTeamListSchema>;
export type PublicGameDto = z.infer<typeof publicGameSchema>;
export type PublicScheduleDto = z.infer<typeof publicScheduleSchema>;
