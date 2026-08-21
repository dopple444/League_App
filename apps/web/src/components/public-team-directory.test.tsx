import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { PublicTeam } from '../lib/api-client';
import { PublicTeamDirectory } from './public-team-directory';

const teams: readonly PublicTeam[] = [
  {
    publicName: 'Hope Church',
    slug: 'hope',
    teamSeasonId: '64816d75-83d9-46e0-bd93-0ad9941457c5',
  },
  {
    publicName: 'Grace Community',
    slug: 'private-slug-term',
    teamSeasonId: '45b24eab-4fe8-44c8-a5ef-10343547ff58',
  },
  {
    publicName: 'Faith Fellowship',
    slug: 'faith',
    teamSeasonId: '49da7149-0450-4faf-9d04-b4b8a8b7224d',
  },
];

const baseTeamUrl = '/leagues/demo/softball/seasons/spring/teams/';

describe('PublicTeamDirectory', () => {
  it('renders sorted, large linked cards using the supplied base team URL', () => {
    render(<PublicTeamDirectory baseTeamUrl={baseTeamUrl} teams={teams} />);

    expect(screen.getByRole('region', { name: 'Published team directory' })).toBeInTheDocument();
    expect(screen.getByText('3 teams shown')).toHaveAttribute('aria-live', 'polite');
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringContaining('Faith Fellowship'),
      expect.stringContaining('Grace Community'),
      expect.stringContaining('Hope Church'),
    ]);
    expect(screen.getByRole('link', { name: /Grace Community/u })).toHaveAttribute(
      'href',
      '/leagues/demo/softball/seasons/spring/teams/private-slug-term',
    );
  });

  it('searches only the approved public name and resets the directory', async () => {
    const user = userEvent.setup();
    render(<PublicTeamDirectory baseTeamUrl={baseTeamUrl} teams={teams} />);

    const search = screen.getByLabelText('Search teams');
    expect(search).toHaveAttribute('maxlength', '120');
    await user.type(search, 'gRaCe');

    expect(screen.getByText('1 team shown')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Grace Community/u })).toBeInTheDocument();
    expect(screen.queryByText('Hope Church')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'private-slug-term');
    expect(screen.getByText('0 teams shown')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'No teams match this search' }),
    ).toBeInTheDocument();

    const resetButtons = screen.getAllByRole('button', { name: 'Reset search' });
    await user.click(resetButtons.at(-1) as HTMLButtonElement);

    expect(screen.getByText('3 teams shown')).toBeInTheDocument();
    expect(search).toHaveValue('');
  });

  it('shows an honest empty state when no teams are published', () => {
    render(<PublicTeamDirectory baseTeamUrl={baseTeamUrl} teams={[]} />);

    expect(screen.getByText('0 teams shown')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'No teams published' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset search' })).toBeDisabled();
  });
});
