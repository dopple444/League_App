import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SiteHeader, StatusBadge } from './site-shell';

describe('StatusBadge', () => {
  it.each([
    ['CANCELED', 'status-danger'],
    ['PUBLISHED', 'status-success'],
    ['SCHEDULED', 'status-info'],
    ['LIVE', 'status-live'],
    ['FINAL', 'status-official-final'],
    ['OFFLINE', 'status-offline'],
    ['PENDING_SYNC', 'status-pending-sync'],
    ['SYNCHRONIZING', 'status-synchronizing'],
    ['WORKFLOW_PENDING', 'status-workflow-pending'],
    ['DRAFT', 'status-neutral'],
    ['POSTPONED', 'status-warning'],
  ])('maps %s to the finite semantic class %s', (value, expectedClass) => {
    render(<StatusBadge value={value} />);

    expect(screen.getByText(value.toLowerCase().replaceAll('_', ' '))).toHaveClass(
      'status',
      expectedClass,
    );
  });

  it('renders an unknown status visibly with the neutral class only', () => {
    render(<StatusBadge value="RAIN_DELAY" />);

    expect(screen.getByText('rain delay')).toHaveAttribute('class', 'status status-neutral');
  });
});

describe('SiteHeader', () => {
  it('provides a native compact menu with a labeled mobile navigation region', () => {
    const { container } = render(<SiteHeader />);
    const menu = container.querySelector('details.mobile-nav');
    const trigger = menu?.querySelector('summary');
    const navigation = menu?.querySelector('nav');

    expect(menu).toBeInTheDocument();
    expect(trigger).toHaveTextContent('Menu');
    expect(trigger).toHaveAttribute('aria-controls', 'mobile-primary-navigation');
    expect(navigation).toHaveAttribute('id', 'mobile-primary-navigation');
    expect(navigation).toHaveAttribute('aria-label', 'Mobile primary');
    expect(
      within(navigation as HTMLElement).getByRole('link', { name: 'League features' }),
    ).toHaveAttribute('href', '/#league-features');
    expect(
      within(navigation as HTMLElement).getByRole('link', { name: 'Staff sign in' }),
    ).toHaveAttribute('href', '/sign-in');
  });
});
