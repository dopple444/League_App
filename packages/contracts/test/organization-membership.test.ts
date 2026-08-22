import { describe, expect, it } from 'vitest';

import { openApiDocument, organizationMembershipSchema } from '../src/index.js';

const membership = {
  organizationId: '00000000-0000-4000-8000-000000000001',
  slug: 'meade-county-demo',
  name: 'Meade County Demo',
  timezone: 'America/New_York',
  permissions: ['season:create'],
  leagues: [
    {
      leagueId: '00000000-0000-4000-8000-000000000101',
      slug: 'church-softball',
      name: 'Church Softball',
      active: false,
    },
  ],
};

describe('organization membership league references', () => {
  it('requires the active lifecycle state for every league summary', () => {
    expect(organizationMembershipSchema.parse(membership)).toEqual(membership);
    expect(
      organizationMembershipSchema.safeParse({
        ...membership,
        leagues: membership.leagues.map(({ leagueId, name, slug }) => ({ leagueId, name, slug })),
      }).success,
    ).toBe(false);
  });

  it('publishes active as required in the OpenAPI league reference', () => {
    const schemas = (openApiDocument.components as { schemas: Record<string, unknown> }).schemas;
    expect(schemas.LeagueReference).toMatchObject({
      required: expect.arrayContaining(['active']),
      properties: { active: { type: 'boolean' } },
    });
  });
});
