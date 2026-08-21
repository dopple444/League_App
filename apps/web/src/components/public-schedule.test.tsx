import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { PublicScheduleGame } from '../lib/api-client';
import { getZonedGameDate, PublicSchedule } from './public-schedule';

const grace = {
  publicName: 'Grace Community',
  slug: 'grace',
  teamSeasonId: '45b24eab-4fe8-44c8-a5ef-10343547ff58',
} as const;
const hope = {
  publicName: 'Hope Church',
  slug: 'hope',
  teamSeasonId: '64816d75-83d9-46e0-bd93-0ad9941457c5',
} as const;
const faith = {
  publicName: 'Faith Fellowship',
  slug: 'faith',
  teamSeasonId: '49da7149-0450-4faf-9d04-b4b8a8b7224d',
} as const;

const game: PublicScheduleGame = {
  awayTeam: grace,
  field: { directions: 'https://example.invalid/field-one', name: 'Field One' },
  gameId: '38d2d12a-38a6-4d80-bcf1-9dcc5adcdad6',
  homeTeam: hope,
  startsAt: '2027-05-04T22:00:00.000Z',
  status: 'SCHEDULED',
};

const games: readonly PublicScheduleGame[] = [
  game,
  {
    awayTeam: faith,
    field: { directions: null, name: 'Field Two' },
    gameId: 'a04c2d5c-ee9a-415c-9c1e-e86cebc588d8',
    homeTeam: grace,
    startsAt: '2027-05-05T23:00:00.000Z',
    status: 'FINAL',
  },
  {
    awayTeam: hope,
    field: { directions: null, name: 'Field One' },
    gameId: '54fa5098-e384-4e30-809a-c6c8e6883f22',
    homeTeam: faith,
    startsAt: '2027-05-06T22:30:00.000Z',
    status: 'POSTPONED',
  },
];

describe('getZonedGameDate', () => {
  it('uses the league timezone when UTC and local calendar dates differ', () => {
    const result = getZonedGameDate('2027-05-05T02:00:00.000Z', 'America/New_York');

    expect(result.dateKey).toBe('2027-05-04');
    expect(result.dateLabel).toBe('Tuesday, May 4, 2027');
    expect(result.timeLabel).toBe('10:00 PM');
  });

  it('formats both sides of the daylight-saving transition without inventing 2 AM', () => {
    const beforeJump = getZonedGameDate('2027-03-14T06:30:00.000Z', 'America/New_York');
    const afterJump = getZonedGameDate('2027-03-14T07:30:00.000Z', 'America/New_York');

    expect(beforeJump.dateKey).toBe('2027-03-14');
    expect(afterJump.dateKey).toBe('2027-03-14');
    expect(beforeJump.timeLabel).toBe('1:30 AM');
    expect(afterJump.timeLabel).toBe('3:30 AM');
  });
});

describe('PublicSchedule', () => {
  it('renders each approved game once in a date-grouped semantic list', () => {
    render(<PublicSchedule games={[game]} timezone="America/New_York" />);

    expect(screen.getByRole('region', { name: 'Published game schedule' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Tuesday, May 4, 2027' }),
    ).toBeInTheDocument();
    const gameArticle = screen.getByRole('article');
    expect(within(gameArticle).getAllByText('Grace Community')).toHaveLength(1);
    expect(within(gameArticle).getAllByText('Hope Church')).toHaveLength(1);
    expect(screen.getByText('scheduled')).toBeInTheDocument();
    expect(screen.getByText('1 game shown')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Times shown in America/New_York.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Directions' })).toHaveAttribute(
      'href',
      game.field.directions,
    );
  });

  it('uses the exact visible Official Final terminology for a final game', () => {
    render(
      <PublicSchedule
        games={[{ ...game, status: 'FINAL' }]}
        showFilters={false}
        timezone="America/New_York"
      />,
    );

    expect(screen.getByText('Official Final')).toBeInTheDocument();
  });

  it('combines Date, Team, Field, and Status filters and resets the complete collection', async () => {
    const user = userEvent.setup();
    render(<PublicSchedule games={games} timezone="America/New_York" />);

    await user.selectOptions(screen.getByLabelText('Date'), '2027-05-04');
    await user.selectOptions(screen.getByLabelText('Team'), grace.teamSeasonId);
    await user.selectOptions(screen.getByLabelText('Field'), 'Field One');
    await user.selectOptions(screen.getByLabelText('Status'), 'SCHEDULED');

    expect(screen.getByText('1 game shown')).toBeInTheDocument();
    const resultArticles = screen.getAllByRole('article');
    expect(resultArticles).toHaveLength(1);
    expect(
      within(resultArticles[0] as HTMLElement).getByText('Grace Community'),
    ).toBeInTheDocument();
    expect(
      within(resultArticles[0] as HTMLElement).queryByText('Faith Fellowship'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset filters' }));

    expect(screen.getByText('3 games shown')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveValue('');
    expect(screen.getByLabelText('Team')).toHaveValue('');
    expect(screen.getByLabelText('Field')).toHaveValue('');
    expect(screen.getByLabelText('Status')).toHaveValue('');
  });

  it('keeps date options chronological and supports a filter-free team-detail mode', () => {
    const { rerender } = render(<PublicSchedule games={games} timezone="America/New_York" />);
    const dateOptions = screen.getByLabelText('Date').querySelectorAll<HTMLOptionElement>('option');

    expect([...dateOptions].map((option) => option.textContent)).toEqual([
      'All dates',
      'Tuesday, May 4, 2027',
      'Wednesday, May 5, 2027',
      'Thursday, May 6, 2027',
    ]);

    rerender(
      <PublicSchedule
        dateHeadingLevel={3}
        games={[game]}
        showFilters={false}
        timezone="America/New_York"
      />,
    );
    expect(
      screen.queryByRole('form', { name: 'Filter published schedule' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('1 game shown')).toBeInTheDocument();
    expect(screen.getByText('Grace Community')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Tuesday, May 4, 2027' }),
    ).toBeInTheDocument();
    const gameArticle = screen.getByRole('article');
    for (const label of ['Time', 'Matchup', 'Field', 'Status']) {
      expect(within(gameArticle).getByText(label)).toBeInTheDocument();
    }
  });

  it('shows a filtered-empty state with a working reset action', async () => {
    const user = userEvent.setup();
    render(<PublicSchedule games={games} timezone="America/New_York" />);

    await user.selectOptions(screen.getByLabelText('Team'), hope.teamSeasonId);
    await user.selectOptions(screen.getByLabelText('Status'), 'FINAL');

    expect(screen.getByText('0 games shown')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'No games match these filters' }),
    ).toBeInTheDocument();

    const resetButtons = screen.getAllByRole('button', { name: 'Reset filters' });
    await user.click(resetButtons.at(-1) as HTMLButtonElement);

    expect(screen.getByText('3 games shown')).toBeInTheDocument();
  });

  it('uses explicit fallbacks for an invalid timestamp and timezone', () => {
    render(<PublicSchedule games={[{ ...game, startsAt: 'invalid' }]} timezone="Not/A_Zone" />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Date to be announced' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Time to be announced')).toBeInTheDocument();
    expect(screen.getByText('Times shown in UTC.')).toBeInTheDocument();
  });

  it('renders non-HTTP directions as text instead of an unsafe link', () => {
    render(
      <PublicSchedule
        games={[
          {
            ...game,
            field: { directions: 'javascript:alert(1)', name: 'Field One' },
          },
        ]}
        timezone="America/New_York"
      />,
    );

    expect(screen.getByText('javascript:alert(1)')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Directions' })).not.toBeInTheDocument();
  });
});
