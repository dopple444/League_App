import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
  mobileApi,
  type PublicGame,
  type PublicLeague,
  type PublicTeam,
} from '../../src/lib/api-client';
import { useLeagueSession } from '../../src/providers/session-provider';

interface Overview {
  readonly league: PublicLeague;
  readonly teams: readonly PublicTeam[];
  readonly games: readonly PublicGame[];
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
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    if (!selectedOrganization) return;
    const league = selectedOrganization.leagues[0];
    if (!league) {
      setError('This organization has no league available.');
      return;
    }
    setError(null);
    try {
      const publicLeague = await mobileApi.getPublicLeague(selectedOrganization.slug, league.slug);
      const season = publicLeague.currentSeason;
      if (!season) {
        setOverview({ league: publicLeague, teams: [], games: [] });
        return;
      }
      const [teams, schedule] = await Promise.all([
        mobileApi.getPublicTeams(selectedOrganization.slug, league.slug, season.slug),
        mobileApi.getPublicSchedule(selectedOrganization.slug, league.slug, season.slug),
      ]);
      setOverview({
        league: publicLeague,
        teams: teams.items,
        games: [...schedule.items].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      });
    } catch {
      setError('We could not refresh the published league overview.');
    }
  }, [selectedOrganization]);
  useEffect(() => {
    void load();
  }, [load]);

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
  if (!overview && !error) return <LoadingState label="Loading published league information…" />;
  const season = overview?.league.currentSeason;
  return (
    <Screen
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            setRefreshing(true);
            void load().finally(() => setRefreshing(false));
          }}
          refreshing={refreshing}
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
                void load();
              }}
              variant="secondary"
            />
          }
        >
          {error}
        </InlineError>
      ) : null}
      {!season ? (
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
