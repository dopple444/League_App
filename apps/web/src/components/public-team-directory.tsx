'use client';

import Link from 'next/link';
import { useId, useMemo, useState } from 'react';

import type { PublicTeam } from '../lib/api-client';
import styles from './public-team-directory.module.css';

const normalizeSearchValue = (value: string): string =>
  value.normalize('NFKC').trim().toLocaleLowerCase('en-US');

const teamHref = (baseTeamUrl: string, slug: string): string =>
  `${baseTeamUrl.replace(/\/+$/u, '')}/${encodeURIComponent(slug)}`;

export function PublicTeamDirectory({
  teams,
  baseTeamUrl,
}: {
  readonly teams: readonly PublicTeam[];
  readonly baseTeamUrl: string;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const normalizedQuery = normalizeSearchValue(query);
  const filteredTeams = useMemo(
    () =>
      teams
        .filter((team) => normalizeSearchValue(team.publicName).includes(normalizedQuery))
        .sort((left, right) => left.publicName.localeCompare(right.publicName, 'en-US')),
    [normalizedQuery, teams],
  );
  const hasSearch = normalizedQuery.length > 0;
  const resultLabel = `${filteredTeams.length} ${filteredTeams.length === 1 ? 'team' : 'teams'} shown`;
  const resetSearch = () => setQuery('');

  return (
    <section aria-label="Published team directory" className={styles.directory}>
      <form
        aria-label="Search published teams"
        className={styles.searchPanel}
        onSubmit={(event) => event.preventDefault()}
      >
        <div className={styles.searchField}>
          <label htmlFor={`${id}-team-search`}>Search teams</label>
          <input
            autoComplete="off"
            id={`${id}-team-search`}
            maxLength={120}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Enter a published team name"
            type="search"
            value={query}
          />
        </div>
        <button
          className={styles.resetButton}
          disabled={!hasSearch}
          onClick={resetSearch}
          type="button"
        >
          Reset search
        </button>
      </form>

      <p aria-atomic="true" aria-live="polite" className={styles.resultCount}>
        {resultLabel}
      </p>

      {filteredTeams.length === 0 ? (
        <section className={styles.emptyState}>
          <h2>{hasSearch ? 'No teams match this search' : 'No teams published'}</h2>
          <p>
            {hasSearch
              ? 'Try another published team name or reset the search.'
              : 'There are no published teams to display.'}
          </p>
          {hasSearch ? (
            <button className={styles.resetButton} onClick={resetSearch} type="button">
              Reset search
            </button>
          ) : null}
        </section>
      ) : (
        <ul className={styles.teamGrid}>
          {filteredTeams.map((team) => (
            <li className={styles.teamItem} key={team.teamSeasonId}>
              <Link className={styles.teamCard} href={teamHref(baseTeamUrl, team.slug)}>
                <span className={styles.cardEyebrow}>Published team</span>
                <h2 className={styles.teamName}>{team.publicName}</h2>
                <span className={styles.cardAction}>View team page</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
