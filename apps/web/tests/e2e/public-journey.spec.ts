import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

const publicLeaguePathPattern = /^\/leagues\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/u;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

const requiredHref = async (link: Locator, description: string): Promise<string> => {
  await expect(link, `${description} should be visible`).toBeVisible();
  const href = await link.getAttribute('href');
  if (!href) throw new Error(`${description} has no href.`);
  return new URL(href, 'http://league.test').pathname;
};

const expectPathname = async (page: Page, expectedPathname: string): Promise<void> => {
  await expect
    .poll(() => new URL(page.url()).pathname, {
      message: `Expected navigation to ${expectedPathname}`,
    })
    .toBe(expectedPathname);
};

const configuredLeagueLink = (page: Page): Locator =>
  page.locator('main a[href^="/leagues/"]').first();

const visiblePrimaryNavigation = (page: Page): Locator =>
  page.locator('nav[aria-label="Primary"]:visible');

const visibleLeagueNavigation = async (page: Page): Promise<Locator> => {
  const primary = visiblePrimaryNavigation(page);
  if (await primary.isVisible()) return primary;

  const menu = page.getByText('Menu', { exact: true });
  await expect(menu).toBeVisible();
  await menu.click();
  return page.getByRole('navigation', { name: 'Mobile primary' });
};

const nonDefaultOptions = async (
  select: Locator,
): Promise<readonly { readonly label: string; readonly value: string }[]> =>
  select.locator('option').evaluateAll((options) =>
    options
      .map((option) => ({
        label: option.textContent?.trim() ?? '',
        value: (option as HTMLOptionElement).value,
      }))
      .filter((option) => option.value.length > 0),
  );

const matchingOption = async (
  select: Locator,
  visibleText: string,
  description: string,
): Promise<{ readonly label: string; readonly value: string }> => {
  const options = await nonDefaultOptions(select);
  const normalizedVisibleText = visibleText.toLocaleLowerCase('en-US');
  const match = options.find((option) =>
    normalizedVisibleText.includes(option.label.toLocaleLowerCase('en-US')),
  );
  if (!match) throw new Error(`No ${description} option matched the first published game.`);
  return match;
};

const resultCount = async (locator: Locator, noun: 'game' | 'team'): Promise<number> => {
  const text = (await locator.textContent())?.trim() ?? '';
  const match = new RegExp(`^(\\d+) ${noun}s? shown$`, 'u').exec(text);
  if (!match) throw new Error(`Could not parse the visible ${noun} result count: ${text}`);
  return Number.parseInt(match[1] ?? '', 10);
};

const teamNameFromCard = async (link: Locator): Promise<string> => {
  const name = (await link.getByRole('heading', { level: 2 }).textContent())?.trim();
  if (!name) throw new Error('Could not discover a published team name from its card heading.');
  return name;
};

const expectNoViewportOverflow = async (page: Page): Promise<void> => {
  const widths = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(
    widths.document,
    'document should not overflow the viewport horizontally',
  ).toBeLessThanOrEqual(widths.viewport);
  expect(widths.body, 'body should not overflow the viewport horizontally').toBeLessThanOrEqual(
    widths.viewport,
  );
};

const expectMinimumTarget = async (locator: Locator, description: string): Promise<void> => {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${description} has no measurable box.`);
  expect(box.height, `${description} should be at least 44px high`).toBeGreaterThanOrEqual(44);
  expect(box.width, `${description} should be at least 44px wide`).toBeGreaterThanOrEqual(44);
};

test('visitor reaches and filters every published league page from the root gateway', async ({
  page,
}) => {
  await page.goto('/');

  const openLeague = configuredLeagueLink(page);
  await expect(openLeague).toHaveAccessibleName(/open league/iu);
  const leaguePath = await requiredHref(openLeague, 'Configured league action');
  expect(leaguePath).toMatch(publicLeaguePathPattern);
  await openLeague.click();
  await expectPathname(page, leaguePath);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  let primaryNavigation = visiblePrimaryNavigation(page);
  const scheduleLink = primaryNavigation.getByRole('link', {
    exact: true,
    name: 'Schedule',
  });
  const teamsLink = primaryNavigation.getByRole('link', { exact: true, name: 'Teams' });
  const schedulePath = await requiredHref(scheduleLink, 'League schedule navigation');
  const teamsPath = await requiredHref(teamsLink, 'League teams navigation');
  expect(schedulePath).toMatch(new RegExp(`^${leaguePath}/seasons/[^/]+/schedule$`, 'u'));
  expect(teamsPath).toMatch(new RegExp(`^${leaguePath}/seasons/[^/]+/teams$`, 'u'));

  await scheduleLink.click();
  await expectPathname(page, schedulePath);
  await expect(page.getByRole('heading', { level: 1, name: 'Schedule' })).toBeVisible();

  const schedule = page.getByRole('region', { name: 'Published game schedule' });
  const scheduleCount = schedule.getByText(/^\d+ games? shown$/u);
  const initialGameCount = await resultCount(scheduleCount, 'game');
  expect(initialGameCount).toBeGreaterThan(0);

  const firstGame = schedule.getByRole('article').first();
  const firstGameText = await firstGame.innerText();
  const firstDateHeading =
    (await schedule.getByRole('heading', { level: 2 }).first().textContent())?.trim() ?? '';
  const dateSelect = page.getByLabel('Date', { exact: true });
  const teamSelect = page.getByLabel('Team', { exact: true });
  const fieldSelect = page.getByLabel('Field', { exact: true });
  const statusSelect = page.getByLabel('Status', { exact: true });
  const matchingDate = await matchingOption(dateSelect, firstDateHeading, 'date');
  const matchingTeam = await matchingOption(teamSelect, firstGameText, 'team');
  const matchingField = await matchingOption(fieldSelect, firstGameText, 'field');
  const matchingStatus = await matchingOption(statusSelect, firstGameText, 'status');

  await dateSelect.selectOption(matchingDate.value);
  await teamSelect.selectOption(matchingTeam.value);
  await fieldSelect.selectOption(matchingField.value);
  await statusSelect.selectOption(matchingStatus.value);
  await expect(dateSelect).toHaveValue(matchingDate.value);
  await expect(teamSelect).toHaveValue(matchingTeam.value);
  await expect(fieldSelect).toHaveValue(matchingField.value);
  await expect(statusSelect).toHaveValue(matchingStatus.value);
  await expect(scheduleCount).toHaveText(/^[1-9]\d* games? shown$/u);
  expect(await resultCount(scheduleCount, 'game')).toBeGreaterThan(0);
  await expect(firstGame).toContainText(matchingTeam.label);
  await expect(firstGame).toContainText(matchingField.label);

  const statusOptions = await nonDefaultOptions(statusSelect);
  // The committed seed currently has only a scheduled game. If a FINAL fixture is present, enforce
  // the product's exact official-state wording instead of accepting the raw enum label.
  const officialFinal = statusOptions.find((option) =>
    ['FINAL', 'OFFICIAL_FINAL'].includes(option.value.toUpperCase()),
  );
  if (officialFinal) {
    await dateSelect.selectOption('');
    await teamSelect.selectOption('');
    await fieldSelect.selectOption('');
    expect(officialFinal.label).toBe('Official Final');
    await statusSelect.selectOption(officialFinal.value);
    await expect(schedule.getByText('Official Final', { exact: true }).first()).toBeVisible();
  }

  const resetFilters = page.getByRole('button', { name: 'Reset filters' }).first();
  await expect(resetFilters).toBeEnabled();
  await resetFilters.click();
  await expect(dateSelect).toHaveValue('');
  await expect(teamSelect).toHaveValue('');
  await expect(fieldSelect).toHaveValue('');
  await expect(statusSelect).toHaveValue('');
  await expect(scheduleCount).toHaveText(
    `${initialGameCount} ${initialGameCount === 1 ? 'game' : 'games'} shown`,
  );

  primaryNavigation = visiblePrimaryNavigation(page);
  await primaryNavigation.getByRole('link', { exact: true, name: 'Teams' }).click();
  await expectPathname(page, teamsPath);
  await expect(page.getByRole('heading', { level: 1, name: 'Teams' })).toBeVisible();

  const directory = page.getByRole('region', { name: 'Published team directory' });
  const teamCount = directory.getByText(/^\d+ teams? shown$/u);
  const initialTeamCount = await resultCount(teamCount, 'team');
  expect(initialTeamCount).toBeGreaterThan(0);

  const stableTeamLink = directory
    .getByRole('link', { name: /View team page/iu })
    .filter({ hasText: 'Demo Away Team' });
  const teamPath = await requiredHref(stableTeamLink, 'Stable seeded team card');
  const teamName = await teamNameFromCard(stableTeamLink);
  const search = page.getByLabel('Search teams', { exact: true });

  await search.fill(teamName);
  await expect(teamCount).toHaveText('1 team shown');
  await expect(
    directory.getByRole('link', { name: new RegExp(escapeRegExp(teamName), 'iu') }),
  ).toBeVisible();

  await search.fill('no-published-team-can-match-this-query');
  await expect(teamCount).toHaveText('0 teams shown');
  await expect(
    directory.getByRole('heading', { level: 2, name: 'No teams match this search' }),
  ).toBeVisible();

  const resetSearch = page.getByRole('button', { name: 'Reset search' }).first();
  await resetSearch.click();
  await expect(search).toHaveValue('');
  await expect(teamCount).toHaveText(
    `${initialTeamCount} ${initialTeamCount === 1 ? 'team' : 'teams'} shown`,
  );

  await directory.getByRole('link', { name: new RegExp(escapeRegExp(teamName), 'iu') }).click();
  await expectPathname(page, teamPath);
  await expect(page.getByRole('heading', { level: 1, name: teamName })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Published game schedule' })).toContainText(
    teamName,
  );
});

test('393px public journey reflows without body overflow', async ({ page }) => {
  await page.setViewportSize({ height: 852, width: 393 });
  await page.goto('/');

  const openLeague = configuredLeagueLink(page);
  const leaguePath = await requiredHref(openLeague, 'Configured league action');
  await openLeague.click();
  await expectPathname(page, leaguePath);
  await expectNoViewportOverflow(page);

  await page.getByText('Menu', { exact: true }).click();
  const mobileNavigation = page.getByRole('navigation', { name: 'Mobile primary' });
  const scheduleLink = mobileNavigation.getByRole('link', { exact: true, name: 'Schedule' });
  const schedulePath = await requiredHref(scheduleLink, 'Mobile schedule navigation');
  await scheduleLink.click();
  await expectPathname(page, schedulePath);

  const schedule = page.getByRole('region', { name: 'Published game schedule' });
  await expect(schedule.getByRole('article').first()).toBeVisible();
  const breadcrumbLinks = await page
    .getByRole('navigation', { name: 'Breadcrumb' })
    .getByRole('link')
    .all();
  for (const [index, link] of breadcrumbLinks.entries()) {
    await expectMinimumTarget(link, `Breadcrumb link ${index + 1}`);
  }
  await expectNoViewportOverflow(page);
});

test('a missing team is a not-found response rather than a service failure', async ({ page }) => {
  await page.goto('/');
  const openLeague = configuredLeagueLink(page);
  const leaguePath = await requiredHref(openLeague, 'Configured league action');
  await openLeague.click();
  await expectPathname(page, leaguePath);

  const teamsLink = visiblePrimaryNavigation(page).getByRole('link', {
    exact: true,
    name: 'Teams',
  });
  const teamsPath = await requiredHref(teamsLink, 'League teams navigation');
  const response = await page.goto(`${teamsPath}/missing-published-team`);

  // Next.js can flush the shared layout before a dynamic segment calls notFound(), which produces a
  // streamed 200 response. The rendered not-found boundary and injected noindex directive are the
  // durable public behavior in both streamed and non-streamed responses.
  expect([200, 404]).toContain(response?.status());
  await expect(
    page.getByRole('heading', { level: 1, name: 'This page is not published.' }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  await expect(page.getByText('Temporarily unavailable', { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('alert').filter({ hasText: 'We could not load this page.' }),
  ).toHaveCount(0);
});

test('@a11y discovered published routes have no detectable WCAG A/AA violations', async ({
  page,
}) => {
  await page.goto('/');
  const leaguePath = await requiredHref(configuredLeagueLink(page), 'Configured league action');

  await page.goto(leaguePath);
  const primaryNavigation = await visibleLeagueNavigation(page);
  const schedulePath = await requiredHref(
    primaryNavigation.getByRole('link', { exact: true, name: 'Schedule' }),
    'League schedule navigation',
  );
  const teamsPath = await requiredHref(
    primaryNavigation.getByRole('link', { exact: true, name: 'Teams' }),
    'League teams navigation',
  );

  await page.goto(teamsPath);
  const teamPath = await requiredHref(
    page
      .getByRole('region', { name: 'Published team directory' })
      .getByRole('link', { name: /View team page/iu })
      .filter({ hasText: 'Demo Away Team' }),
    'Stable seeded team card',
  );

  for (const path of ['/', '/sign-in', leaguePath, schedulePath, teamsPath, teamPath]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations, `${path} accessibility violations`).toEqual([]);
  }
});
