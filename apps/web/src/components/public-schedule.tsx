'use client';

import { useId, useMemo, useState } from 'react';

import type { PublicScheduleGame } from '../lib/api-client';
import styles from './public-schedule.module.css';
import { StatusBadge } from './site-shell';

interface ZonedGameDate {
  readonly dateKey: string;
  readonly dateLabel: string;
  readonly timeLabel: string;
  readonly timestamp: number | null;
}

interface PreparedGame {
  readonly game: PublicScheduleGame;
  readonly zonedDate: ZonedGameDate;
}

interface FilterOption {
  readonly label: string;
  readonly value: string;
}

const UNDATED_KEY = 'undated';

const resolveTimeZone = (timezone: string): string => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(0);
    return timezone;
  } catch {
    return 'UTC';
  }
};

const zonedDateParts = (
  date: Date,
  timezone: string,
): Readonly<{ day: string; month: string; year: string }> => {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(date);
  const valueByType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    day: valueByType.day ?? '01',
    month: valueByType.month ?? '01',
    year: valueByType.year ?? '1970',
  };
};

export const getZonedGameDate = (startsAt: string, timezone: string): ZonedGameDate => {
  const parsed = new Date(startsAt);
  if (Number.isNaN(parsed.getTime())) {
    return {
      dateKey: UNDATED_KEY,
      dateLabel: 'Date to be announced',
      timeLabel: 'Time to be announced',
      timestamp: null,
    };
  }

  const safeTimeZone = resolveTimeZone(timezone);
  const { day, month, year } = zonedDateParts(parsed, safeTimeZone);

  return {
    dateKey: `${year}-${month}-${day}`,
    dateLabel: new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'long',
      timeZone: safeTimeZone,
      weekday: 'long',
      year: 'numeric',
    }).format(parsed),
    timeLabel: new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: safeTimeZone,
    }).format(parsed),
    timestamp: parsed.getTime(),
  };
};

export const safeDirectionsUrl = (value: string): string | null => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
};

const statusLabel = (status: string): string => {
  const normalized = status.trim().toUpperCase();
  if (normalized === 'FINAL' || normalized === 'OFFICIAL_FINAL') return 'Official Final';
  return normalized
    .toLocaleLowerCase('en-US')
    .replaceAll(/[_-]+/g, ' ')
    .replace(/^./u, (character) => character.toLocaleUpperCase('en-US'));
};

const sortedOptions = (options: ReadonlyMap<string, string>): readonly FilterOption[] =>
  [...options.entries()]
    .map(([value, label]) => ({ label, value }))
    .sort((left, right) => left.label.localeCompare(right.label, 'en-US'));

const optionsInInsertionOrder = (options: ReadonlyMap<string, string>): readonly FilterOption[] =>
  [...options.entries()].map(([value, label]) => ({ label, value }));

const prepareGames = (
  games: readonly PublicScheduleGame[],
  timezone: string,
): readonly PreparedGame[] =>
  games
    .map((game) => ({ game, zonedDate: getZonedGameDate(game.startsAt, timezone) }))
    .sort((left, right) => {
      if (left.zonedDate.timestamp === null) return right.zonedDate.timestamp === null ? 0 : 1;
      if (right.zonedDate.timestamp === null) return -1;
      return left.zonedDate.timestamp - right.zonedDate.timestamp;
    });

function Directions({ game }: { readonly game: PublicScheduleGame }) {
  if (!game.field.directions) return null;
  const href = safeDirectionsUrl(game.field.directions);

  return href ? (
    <a className={styles.directionsLink} href={href}>
      Directions
    </a>
  ) : (
    <span className={styles.directionsText}>{game.field.directions}</span>
  );
}

function GameListItem({ prepared }: { readonly prepared: PreparedGame }) {
  const { game, zonedDate } = prepared;

  return (
    <li className={styles.gameItem}>
      <article className={styles.gameRow}>
        <div className={styles.gameCell}>
          <span className={styles.mobileLabel}>Time</span>
          {zonedDate.timestamp === null ? (
            <span>{zonedDate.timeLabel}</span>
          ) : (
            <time dateTime={game.startsAt}>{zonedDate.timeLabel}</time>
          )}
        </div>
        <div className={styles.gameCell}>
          <span className={styles.mobileLabel}>Matchup</span>
          <span>
            <strong>{game.awayTeam.publicName}</strong> at{' '}
            <strong>{game.homeTeam.publicName}</strong>
          </span>
        </div>
        <div className={styles.gameCell}>
          <span className={styles.mobileLabel}>Field</span>
          <span>{game.field.name}</span>
          <Directions game={game} />
        </div>
        <div className={styles.gameCell}>
          <span className={styles.mobileLabel}>Status</span>
          <StatusBadge value={game.status} />
        </div>
      </article>
    </li>
  );
}

export function PublicSchedule({
  games,
  timezone,
  showFilters = true,
  dateHeadingLevel = 2,
}: {
  readonly games: readonly PublicScheduleGame[];
  readonly timezone: string;
  readonly showFilters?: boolean;
  readonly dateHeadingLevel?: 2 | 3;
}) {
  const id = useId();
  const [dateFilter, setDateFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [fieldFilter, setFieldFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const preparedGames = useMemo(() => prepareGames(games, timezone), [games, timezone]);
  const options = useMemo(() => {
    const dates = new Map<string, string>();
    const teams = new Map<string, string>();
    const fields = new Map<string, string>();
    const statuses = new Map<string, string>();

    for (const { game, zonedDate } of preparedGames) {
      dates.set(zonedDate.dateKey, zonedDate.dateLabel);
      teams.set(game.awayTeam.teamSeasonId, game.awayTeam.publicName);
      teams.set(game.homeTeam.teamSeasonId, game.homeTeam.publicName);
      fields.set(game.field.name, game.field.name);
      statuses.set(game.status, statusLabel(game.status));
    }

    return {
      dates: optionsInInsertionOrder(dates),
      fields: sortedOptions(fields),
      statuses: sortedOptions(statuses),
      teams: sortedOptions(teams),
    };
  }, [preparedGames]);

  const filteredGames = useMemo(
    () =>
      preparedGames.filter(({ game, zonedDate }) => {
        const matchesDate = !dateFilter || zonedDate.dateKey === dateFilter;
        const matchesTeam =
          !teamFilter ||
          game.awayTeam.teamSeasonId === teamFilter ||
          game.homeTeam.teamSeasonId === teamFilter;
        const matchesField = !fieldFilter || game.field.name === fieldFilter;
        const matchesStatus = !statusFilter || game.status === statusFilter;
        return matchesDate && matchesTeam && matchesField && matchesStatus;
      }),
    [dateFilter, fieldFilter, preparedGames, statusFilter, teamFilter],
  );

  const groupedGames = useMemo(() => {
    const groups = new Map<string, { readonly label: string; readonly items: PreparedGame[] }>();
    for (const prepared of filteredGames) {
      const group = groups.get(prepared.zonedDate.dateKey);
      if (group) group.items.push(prepared);
      else {
        groups.set(prepared.zonedDate.dateKey, {
          items: [prepared],
          label: prepared.zonedDate.dateLabel,
        });
      }
    }
    return [...groups.entries()];
  }, [filteredGames]);

  const hasActiveFilters = Boolean(dateFilter || teamFilter || fieldFilter || statusFilter);
  const resetFilters = () => {
    setDateFilter('');
    setTeamFilter('');
    setFieldFilter('');
    setStatusFilter('');
  };
  const resultLabel = `${filteredGames.length} ${filteredGames.length === 1 ? 'game' : 'games'} shown`;
  const displayedTimeZone = resolveTimeZone(timezone);
  const DateHeading = dateHeadingLevel === 3 ? 'h3' : 'h2';

  return (
    <section aria-label="Published game schedule" className={styles.schedule}>
      {showFilters ? (
        <form
          aria-label="Filter published schedule"
          className={styles.filterPanel}
          onSubmit={(event) => event.preventDefault()}
        >
          <div className={styles.filterGrid}>
            <div className={styles.field}>
              <label htmlFor={`${id}-date`}>Date</label>
              <select
                id={`${id}-date`}
                onChange={(event) => setDateFilter(event.target.value)}
                value={dateFilter}
              >
                <option value="">All dates</option>
                {options.dates.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor={`${id}-team`}>Team</label>
              <select
                id={`${id}-team`}
                onChange={(event) => setTeamFilter(event.target.value)}
                value={teamFilter}
              >
                <option value="">All teams</option>
                {options.teams.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor={`${id}-field`}>Field</label>
              <select
                id={`${id}-field`}
                onChange={(event) => setFieldFilter(event.target.value)}
                value={fieldFilter}
              >
                <option value="">All fields</option>
                {options.fields.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor={`${id}-status`}>Status</label>
              <select
                id={`${id}-status`}
                onChange={(event) => setStatusFilter(event.target.value)}
                value={statusFilter}
              >
                <option value="">All statuses</option>
                {options.statuses.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.resetControl}>
              <button
                className={styles.resetButton}
                disabled={!hasActiveFilters}
                onClick={resetFilters}
                type="button"
              >
                Reset filters
              </button>
            </div>
          </div>
        </form>
      ) : null}

      <div className={styles.resultsSummary}>
        <p aria-atomic="true" aria-live="polite" className={styles.resultCount}>
          {resultLabel}
        </p>
        <p className={styles.timeZoneNote}>Times shown in {displayedTimeZone}.</p>
      </div>

      {filteredGames.length === 0 ? (
        <section className={styles.emptyState}>
          <h2>{hasActiveFilters ? 'No games match these filters' : 'No games published'}</h2>
          <p>
            {hasActiveFilters
              ? 'Try changing a filter or reset them to see the complete published schedule.'
              : 'There are no published games to display.'}
          </p>
          {hasActiveFilters ? (
            <button className={styles.resetButton} onClick={resetFilters} type="button">
              Reset filters
            </button>
          ) : null}
        </section>
      ) : (
        <div className={styles.results}>
          {groupedGames.map(([dateKey, group]) => {
            const headingId = `${id}-${dateKey}`;
            return (
              <section aria-labelledby={headingId} className={styles.dateGroup} key={dateKey}>
                <DateHeading className={styles.dateHeading} id={headingId}>
                  {group.label}
                </DateHeading>
                <div aria-hidden="true" className={styles.columnLabels}>
                  <span>Time</span>
                  <span>Matchup</span>
                  <span>Field</span>
                  <span>Status</span>
                </div>
                <ul className={styles.gameList}>
                  {group.items.map((prepared) => (
                    <GameListItem key={prepared.game.gameId} prepared={prepared} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
