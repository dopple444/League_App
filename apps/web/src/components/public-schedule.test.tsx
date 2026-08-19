import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { PublicScheduleGame } from '../lib/api-client';
import { PublicSchedule } from './public-schedule';

const game: PublicScheduleGame = {
  gameId: '38d2d12a-38a6-4d80-bcf1-9dcc5adcdad6',
  startsAt: '2027-05-04T22:00:00.000Z',
  status: 'SCHEDULED',
  awayTeam: {
    teamSeasonId: '45b24eab-4fe8-44c8-a5ef-10343547ff58',
    slug: 'grace',
    publicName: 'Grace Community',
  },
  homeTeam: {
    teamSeasonId: '64816d75-83d9-46e0-bd93-0ad9941457c5',
    slug: 'hope',
    publicName: 'Hope Church',
  },
  field: { name: 'Field One', directions: 'https://example.invalid/field-one' },
};

describe('PublicSchedule', () => {
  it('renders the approved schedule fields with a textual status', () => {
    render(<PublicSchedule games={[game]} timezone="America/New_York" />);
    expect(screen.getByText('Grace Community')).toBeInTheDocument();
    expect(screen.getByText('Hope Church')).toBeInTheDocument();
    expect(screen.getByText('scheduled')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Directions' })).toHaveAttribute(
      'href',
      game.field.directions,
    );
    expect(screen.getByText(/times shown in America\/New_York/i)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Published game schedule' })).toHaveAttribute(
      'tabindex',
      '0',
    );
  });

  it('uses an explicit fallback for invalid timestamps', () => {
    render(
      <PublicSchedule games={[{ ...game, startsAt: 'invalid' }]} timezone="America/New_York" />,
    );
    expect(screen.getByText('Time to be announced')).toBeInTheDocument();
  });

  it('renders non-URL directions as text instead of an unsafe link', () => {
    render(
      <PublicSchedule
        games={[{ ...game, field: { name: 'Field One', directions: 'Use the signed entrance.' } }]}
        timezone="America/New_York"
      />,
    );
    expect(screen.getByText('Use the signed entrance.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Directions' })).not.toBeInTheDocument();
  });
});
