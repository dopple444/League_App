import type { PublicScheduleGame } from '../lib/api-client';
import { StatusBadge } from './site-shell';

const formatGameTime = (startsAt: string, timezone: string): string => {
  const parsed = new Date(startsAt);
  if (Number.isNaN(parsed.getTime())) {
    return 'Time to be announced';
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone,
    }).format(parsed);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(parsed);
  }
};

const safeDirectionsUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
};

export function PublicSchedule({
  games,
  timezone,
}: {
  readonly games: readonly PublicScheduleGame[];
  readonly timezone: string;
}) {
  return (
    <div aria-label="Published game schedule" className="table-card" role="region" tabIndex={0}>
      <table>
        <caption>Published game schedule — times shown in {timezone}</caption>
        <thead>
          <tr>
            <th scope="col">Date and time</th>
            <th scope="col">Matchup</th>
            <th scope="col">Field</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <tr key={game.gameId}>
              <td>{formatGameTime(game.startsAt, timezone)}</td>
              <td>
                <strong>{game.awayTeam.publicName}</strong> at{' '}
                <strong>{game.homeTeam.publicName}</strong>
              </td>
              <td>
                {game.field.name}
                {game.field.directions ? (
                  <>
                    <br />
                    {safeDirectionsUrl(game.field.directions) ? (
                      <a href={safeDirectionsUrl(game.field.directions) ?? undefined}>Directions</a>
                    ) : (
                      <span>{game.field.directions}</span>
                    )}
                  </>
                ) : null}
              </td>
              <td>
                <StatusBadge value={game.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
