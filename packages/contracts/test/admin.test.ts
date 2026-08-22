import { describe, expect, it } from 'vitest';

import {
  createFieldSchema,
  createLeagueSchema,
  createVenueSchema,
  leagueAdminListSchema,
  leagueAdminSchema,
  updateFieldSchema,
  updateLeagueSchema,
  updateVenueSchema,
  venueAdminSchema,
} from '../src/index.js';

describe('league administration contracts', () => {
  const timestamp = '2026-08-21T12:00:00.000Z';
  const league = {
    organizationId: '00000000-0000-4000-8000-000000000001',
    leagueId: '00000000-0000-4000-8000-000000000101',
    name: 'Church Softball',
    slug: 'church-softball',
    active: true,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  it('accepts strict, normalized create and full optimistic update inputs', () => {
    expect(
      createLeagueSchema.parse({
        name: '  Church Softball  ',
        slug: 'church-softball',
        active: true,
      }),
    ).toEqual({ name: 'Church Softball', slug: 'church-softball', active: true });
    expect(
      updateLeagueSchema.parse({
        name: '  Church Softball League  ',
        slug: 'church-softball-league',
        active: false,
        expectedVersion: 2,
      }),
    ).toEqual({
      name: 'Church Softball League',
      slug: 'church-softball-league',
      active: false,
      expectedVersion: 2,
    });
  });

  it('rejects incomplete or unknown create and update properties', () => {
    expect(createLeagueSchema.safeParse({ name: 'League', slug: 'league' }).success).toBe(false);
    expect(
      createLeagueSchema.safeParse({
        name: 'League',
        slug: 'league',
        active: true,
        unexpected: true,
      }).success,
    ).toBe(false);
    expect(
      updateLeagueSchema.safeParse({
        name: 'League',
        slug: 'league',
        active: true,
      }).success,
    ).toBe(false);
    expect(updateLeagueSchema.safeParse({ expectedVersion: 1, active: false }).success).toBe(false);
  });

  it('validates explicit tenant, lifecycle, version, and timestamp fields', () => {
    expect(leagueAdminSchema.parse(league)).toEqual(league);
  });

  it('bounds administrative league lists at 200 items', () => {
    expect(
      leagueAdminListSchema.safeParse({ items: Array.from({ length: 200 }, () => league) }).success,
    ).toBe(true);
    expect(
      leagueAdminListSchema.safeParse({ items: Array.from({ length: 201 }, () => league) }).success,
    ).toBe(false);
  });
});

describe('venue and field administration contracts', () => {
  it('trims facility text and normalizes blank directions', () => {
    expect(createVenueSchema.parse({ name: '  Riverside Park  ' })).toEqual({
      name: 'Riverside Park',
    });
    expect(
      createFieldSchema.parse({ name: '  Field 2 ', publicDirections: '   ', hasLights: true }),
    ).toEqual({ name: 'Field 2', publicDirections: null, hasLights: true });
  });

  it('accepts only nullable whole fence distances from 100 through 600 feet', () => {
    expect(createFieldSchema.parse({ name: 'Field 1', fenceDistanceFeet: null })).toMatchObject({
      fenceDistanceFeet: null,
    });
    expect(createFieldSchema.parse({ name: 'Field 1', fenceDistanceFeet: 100 })).toMatchObject({
      fenceDistanceFeet: 100,
    });
    expect(createFieldSchema.safeParse({ name: 'Field 1', fenceDistanceFeet: 99 }).success).toBe(
      false,
    );
    expect(createFieldSchema.safeParse({ name: 'Field 1', fenceDistanceFeet: 300.5 }).success).toBe(
      false,
    );
    expect(createFieldSchema.safeParse({ name: 'Field 1', fenceDistanceFeet: 601 }).success).toBe(
      false,
    );
  });

  it('requires optimistic concurrency on field updates', () => {
    expect(updateVenueSchema.safeParse({ expectedVersion: 1 }).success).toBe(false);
    expect(updateVenueSchema.safeParse({ expectedVersion: 1, active: false }).success).toBe(true);
    expect(updateFieldSchema.safeParse({ name: 'Renamed' }).success).toBe(false);
    expect(updateFieldSchema.safeParse({ expectedVersion: 1 }).success).toBe(false);
    expect(updateFieldSchema.safeParse({ expectedVersion: 1, name: 'Renamed' }).success).toBe(true);
  });

  it('rejects unknown facility properties instead of silently applying defaults', () => {
    expect(createVenueSchema.safeParse({ name: 'Riverside Park', actve: false }).success).toBe(
      false,
    );
    expect(createFieldSchema.safeParse({ name: 'Field 1', hasLight: true }).success).toBe(false);
    expect(
      updateVenueSchema.safeParse({ expectedVersion: 1, active: false, unexpected: true }).success,
    ).toBe(false);
    expect(
      updateFieldSchema.safeParse({ expectedVersion: 1, hasLights: true, unexpected: true })
        .success,
    ).toBe(false);
  });

  it('validates nested venue responses with explicit tenant and timestamps', () => {
    const timestamp = '2026-08-21T12:00:00.000Z';
    const organizationId = '00000000-0000-4000-8000-000000000001';
    const venueId = '00000000-0000-4000-8000-000000000501';
    expect(
      venueAdminSchema.parse({
        organizationId,
        venueId,
        name: 'Riverside Park',
        active: true,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        fields: [
          {
            organizationId,
            venueId,
            fieldId: '00000000-0000-4000-8000-000000000502',
            name: 'Field 1',
            publicDirections: null,
            hasLights: false,
            fenceDistanceFeet: 300,
            active: true,
            version: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
      }),
    ).toMatchObject({ name: 'Riverside Park', fields: [{ name: 'Field 1' }] });
  });
});
