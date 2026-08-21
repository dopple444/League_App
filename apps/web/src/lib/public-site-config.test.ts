import { describe, expect, it } from 'vitest';

import { publicLeaguePath, readFeaturedPublicLeagueConfig } from './public-site-config';

describe('featured public league configuration', () => {
  it('returns a canonical route only for a validated organization and league pair', () => {
    const result = readFeaturedPublicLeagueConfig({
      FEATURED_PUBLIC_ORGANIZATION_SLUG: 'meade-county-demo',
      FEATURED_PUBLIC_LEAGUE_SLUG: 'church-softball',
    });

    expect(result).toEqual({
      status: 'configured',
      value: {
        organizationSlug: 'meade-county-demo',
        leagueSlug: 'church-softball',
      },
    });
    if (result.status === 'configured') {
      expect(publicLeaguePath(result.value)).toBe('/leagues/meade-county-demo/church-softball');
    }
  });

  it('keeps an absent pair unconfigured instead of choosing a tenant', () => {
    expect(readFeaturedPublicLeagueConfig({})).toEqual({ status: 'unconfigured' });
  });

  it.each([
    {
      FEATURED_PUBLIC_ORGANIZATION_SLUG: 'meade-county-demo',
    },
    {
      FEATURED_PUBLIC_LEAGUE_SLUG: 'church-softball',
    },
    {
      FEATURED_PUBLIC_ORGANIZATION_SLUG: 'Meade County',
      FEATURED_PUBLIC_LEAGUE_SLUG: 'church-softball',
    },
    {
      FEATURED_PUBLIC_ORGANIZATION_SLUG: 'meade-county-demo',
      FEATURED_PUBLIC_LEAGUE_SLUG: '../private',
    },
  ])('rejects partial or unsafe settings without reflecting them', (environment) => {
    expect(readFeaturedPublicLeagueConfig(environment)).toEqual({ status: 'invalid' });
  });
});
