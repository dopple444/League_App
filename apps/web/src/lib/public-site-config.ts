const publicSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export const featuredPublicOrganizationSlugSetting = 'FEATURED_PUBLIC_ORGANIZATION_SLUG' as const;
export const featuredPublicLeagueSlugSetting = 'FEATURED_PUBLIC_LEAGUE_SLUG' as const;

export interface FeaturedPublicLeagueConfig {
  readonly organizationSlug: string;
  readonly leagueSlug: string;
}

export type FeaturedPublicLeagueConfigState =
  | { readonly status: 'configured'; readonly value: FeaturedPublicLeagueConfig }
  | { readonly status: 'invalid' }
  | { readonly status: 'unconfigured' };

type ServerEnvironment = Readonly<Record<string, string | undefined>>;

const isValidPublicSlug = (value: string): boolean =>
  value.length >= 2 && value.length <= 80 && publicSlugPattern.test(value);

/**
 * Reads server runtime configuration without exposing environment variable names or raw invalid
 * values to rendered UI. Callers may render only the validated slugs in canonical public links.
 */
export function readFeaturedPublicLeagueConfig(
  environment: ServerEnvironment = process.env,
): FeaturedPublicLeagueConfigState {
  const organizationSlug = environment[featuredPublicOrganizationSlugSetting]?.trim() ?? '';
  const leagueSlug = environment[featuredPublicLeagueSlugSetting]?.trim() ?? '';

  if (!organizationSlug && !leagueSlug) return { status: 'unconfigured' };
  if (!isValidPublicSlug(organizationSlug) || !isValidPublicSlug(leagueSlug)) {
    return { status: 'invalid' };
  }

  return {
    status: 'configured',
    value: { organizationSlug, leagueSlug },
  };
}

export const publicLeaguePath = ({
  organizationSlug,
  leagueSlug,
}: FeaturedPublicLeagueConfig): string => `/leagues/${organizationSlug}/${leagueSlug}`;
