import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';

import {
  ActionButton,
  Card,
  Heading,
  InlineError,
  LoadingState,
  Screen,
  StatusPill,
  uiStyles,
} from '../../src/components/ui';
import {
  MobileApiError,
  mobileApi,
  type PublicGame,
  type PublicLeague,
  type PublicTeam,
} from '../../src/lib/api-client';
import { selectActiveLeagues } from '../../src/lib/league-selection';
import { useLeagueSession } from '../../src/providers/session-provider';

interface Overview {
  readonly league: PublicLeague;
  readonly teams: readonly PublicTeam[];
  readonly games: readonly PublicGame[];
}

interface OverviewState {
  readonly contextKey: string | null;
  readonly status: 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';
  readonly overview: Overview | null;
  readonly error: string | null;
}

const formatGameTime = (value: string, timezone: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time to be announced';
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
      date,
    );
  }
};

export default function HomeScreen() {
  const router = useRouter();
  const { selectedOrganization } = useLeagueSession();
  const activeLeagues = useMemo(
    () => selectActiveLeagues(selectedOrganization?.leagues ?? []),
    [selectedOrganization?.leagues],
  );
  const organizationSlug = selectedOrganization?.slug ?? null;
  const contextKey = selectedOrganization
    ? `${selectedOrganization.organizationId}:${selectedOrganization.slug}:${activeLeagues
        .map((league) => `${league.leagueId}:${league.slug}`)
        .join(',')}`
    : null;
  const requestSequence = useRef(0);
  const [state, setState] = useState<OverviewState>({
    contextKey: null,
    status: 'idle',
    overview: null,
    error: null,
  });
  const [refreshingContext, setRefreshingContext] = useState<string | null>(null);
  const load = useCallback(
    async (showLoading: boolean) => {
      if (!organizationSlug || !contextKey || activeLeagues.length === 0) return;
      const requestId = ++requestSequence.current;
      if (showLoading) {
        setState({ contextKey, status: 'loading', overview: null, error: null });
      } else {
        setState((current) => ({
          contextKey,
          status: current.contextKey === contextKey && current.overview ? 'ready' : 'loading',
          overview: current.contextKey === contextKey ? current.overview : null,
          error: null,
        }));
      }
      try {
        let publicLeague: PublicLeague | null = null;
        let publishedLeagueSlug: string | null = null;
        for (const league of activeLeagues) {
          try {
            publicLeague = await mobileApi.getPublicLeague(organizationSlug, league.slug);
            publishedLeagueSlug = league.slug;
            break;
          } catch (loadError) {
            if (loadError instanceof MobileApiError && loadError.status === 404) continue;
            throw loadError;
          }
        }
        if (requestSequence.current !== requestId) return;
        if (!publicLeague || !publishedLeagueSlug) {
          setState({ contextKey, status: 'unavailable', overview: null, error: null });
          return;
        }
        const season = publicLeague.currentSeason;
        if (!season) {
          setState({
            contextKey,
            status: 'ready',
            overview: { league: publicLeague, teams: [], games: [] },
            error: null,
          });
          return;
        }
        const [teams, schedule] = await Promise.all([
          mobileApi.getPublicTeams(organizationSlug, publishedLeagueSlug, season.slug),
          mobileApi.getPublicSchedule(organizationSlug, publishedLeagueSlug, season.slug),
        ]);
        if (requestSequence.current !== requestId) return;
        setState({
          contextKey,
          status: 'ready',
          overview: {
            league: publicLeague,
            teams: teams.items,
            games: [...schedule.items].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
          },
          error: null,
        });
      } catch {
        if (requestSequence.current !== requestId) return;
        setState((current) => ({
          contextKey,
          status: 'error',
          overview: current.contextKey === contextKey ? current.overview : null,
          error: 'We could not load league information. Please try again.',
        }));
      }
    },
    [activeLeagues, contextKey, organizationSlug],
  );
  useEffect(() => {
    if (!contextKey || activeLeagues.length === 0) {
      requestSequence.current += 1;
      return;
    }
    void load(true);
    return () => {
      requestSequence.current += 1;
    };
  }, [activeLeagues.length, contextKey, load]);

  if (!selectedOrganization)
    return (
      <Screen>
        <Heading title="Choose an organization" />
        <ActionButton
          label="Choose organization"
          onPress={() => router.replace('/(app)/organizations')}
        />
      </Screen>
    );
  if (activeLeagues.length === 0)
    return (
      <Screen>
        <Heading
          eyebrow={selectedOrganization.name}
          title="League unavailable"
          description="This organization does not currently have an active league."
        />
        <Card>
          <Text style={uiStyles.sectionTitle}>No active league available</Text>
          <Text style={uiStyles.muted}>
            Ask a league administrator to activate a league, or switch organizations.
          </Text>
        </Card>
        <View>
          <ActionButton
            label="Switch organization"
            onPress={() => router.push('/(app)/organizations')}
            variant="secondary"
          />
        </View>
      </Screen>
    );
  const currentState = state.contextKey === contextKey ? state : null;
  const overview = currentState?.overview ?? null;
  const error = currentState?.error ?? null;
  if (!currentState || currentState.status === 'loading') {
    return <LoadingState label="Loading published league information…" />;
  }
  if (currentState.status === 'unavailable')
    return (
      <Screen>
        <Heading
          eyebrow={selectedOrganization.name}
          title="League unavailable"
          description="This organization does not currently have a published active league."
        />
        <Card>
          <Text style={uiStyles.sectionTitle}>No published active league available</Text>
          <Text style={uiStyles.muted}>
            Check back after league staff publish an active league, or switch organizations.
          </Text>
        </Card>
        <View>
          <ActionButton
            label="Switch organization"
            onPress={() => router.push('/(app)/organizations')}
            variant="secondary"
          />
        </View>
      </Screen>
    );
  const season = overview?.league.currentSeason;
  return (
    <Screen
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            setRefreshingContext(contextKey);
            void load(false).finally(() => {
              setRefreshingContext((current) => (current === contextKey ? null : current));
            });
          }}
          refreshing={refreshingContext === contextKey}
        />
      }
    >
      <Heading
        eyebrow={selectedOrganization.name}
        title={overview?.league.league.name ?? 'League overview'}
        description={
          season ? `${season.name} · ${season.timezone}` : 'Published league information'
        }
      />
      {error ? (
        <InlineError
          action={
            <ActionButton
              label="Retry"
              onPress={() => {
                void load(true);
              }}
              variant="secondary"
            />
          }
        >
          {error}
        </InlineError>
      ) : null}
      {overview && !season ? (
        <Card>
          <Text style={uiStyles.sectionTitle}>No published season</Text>
          <Text style={uiStyles.muted}>
            Check back after league staff publish the active season.
          </Text>
        </Card>
      ) : null}
      {season ? (
        <>
          <Card>
            <Text style={uiStyles.sectionTitle}>Teams</Text>
            <Text style={uiStyles.paragraph}>{overview?.teams.length ?? 0} published teams</Text>
            {overview?.teams.slice(0, 4).map((team) => (
              <Text key={team.teamSeasonId} style={uiStyles.muted}>
                • {team.publicName}
              </Text>
            ))}
          </Card>
          <Text accessibilityRole="header" style={uiStyles.sectionTitle}>
            Next games
          </Text>
          {!overview?.games.length ? (
            <Card>
              <Text style={uiStyles.muted}>No games are published yet.</Text>
            </Card>
          ) : (
            overview.games.slice(0, 5).map((game) => (
              <Card key={game.gameId}>
                <StatusPill value={game.status} />
                <Text style={uiStyles.paragraph}>
                  {game.awayTeam.publicName} at {game.homeTeam.publicName}
                </Text>
                <Text style={uiStyles.muted}>{formatGameTime(game.startsAt, season.timezone)}</Text>
                <Text style={uiStyles.muted}>{game.field.name}</Text>
              </Card>
            ))
          )}
        </>
      ) : null}
      <View>
        <ActionButton
          label="Switch organization"
          onPress={() => router.push('/(app)/organizations')}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}
