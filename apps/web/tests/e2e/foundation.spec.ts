import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { signIn, signInAndOpenAdministration } from './auth';

const getDemoPassword = (): string | undefined => {
  if (process.env.DEMO_ADMIN_PASSWORD) return process.env.DEMO_ADMIN_PASSWORD;
  const envPath = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')].find(
    (path) => existsSync(path),
  );
  const match = envPath ? /^DEMO_ADMIN_PASSWORD=(.+)$/mu.exec(readFileSync(envPath, 'utf8')) : null;
  return match?.[1];
};

const nonceFromCsp = (policy: string | undefined): string => {
  const nonce = /(?:^|;)\s*script-src[^;]*'nonce-([^']+)'/u.exec(policy ?? '')?.[1];
  if (!nonce) throw new Error(`The gateway CSP is missing a script nonce: ${policy ?? '<none>'}`);
  return nonce;
};

test('landing page explains the verified publication boundary', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'One place for every game night.' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Draft seasons and private participant information never appear on public pages.',
    ),
  ).toBeVisible();
  const icon = page.locator('link[rel="icon"]');
  await expect(icon).toHaveAttribute('href', /\/icon/u);
  await expect(icon).toHaveAttribute('type', 'image/png');
  const iconResponse = await page.request.get((await icon.getAttribute('href')) ?? '/icon');
  expect(iconResponse.status()).toBe(200);
  expect(iconResponse.headers()['content-type']).toContain('image/png');
  await page.getByRole('link', { name: 'Staff sign in' }).first().click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByLabel('Email address')).toBeVisible();
});

test('sign-in reports labeled validation errors', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Enter a valid email address.' }),
  ).toContainText('Enter a valid email address.');
  await expect(page.getByLabel('Email address')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Password')).toHaveAttribute('aria-invalid', 'true');
});

test('MFA entry pages expose labeled, paste-compatible validation states', async ({ page }) => {
  const password = getDemoPassword();
  test.skip(!password, 'Run the environment initializer to create synthetic demo credentials.');
  await signIn(page, password ?? '');

  await page.goto('/auth/enroll-mfa');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Protect administrative access' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Start authenticator setup' }).click();
  await expect(page.getByLabel('Current password')).toHaveAttribute('aria-invalid', 'true');

  await page.goto('/auth/two-factor');
  const code = page.getByLabel('Six-digit authenticator code');
  await expect(code).toHaveAttribute('autocomplete', 'one-time-code');
  await expect(code).toHaveAttribute('inputmode', 'numeric');
  await page.getByRole('button', { name: 'Verify and continue' }).click();
  await expect(code).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'Use a recovery code' }).click();
  await expect(page.getByLabel('Recovery code')).toBeVisible();
});

test('gateway applies unique script nonces and permits Next hydration', async ({
  page,
  request,
}) => {
  const firstResponse = await request.get('/sign-in');
  const secondResponse = await request.get('/sign-in');
  const firstHtml = await firstResponse.text();
  const firstPolicy = firstResponse.headers()['content-security-policy'];
  const secondPolicy = secondResponse.headers()['content-security-policy'];
  const firstNonce = nonceFromCsp(firstPolicy);
  const secondNonce = nonceFromCsp(secondPolicy);
  const scriptDirective = firstPolicy
    ?.split(';')
    .find((directive) => directive.trimStart().startsWith('script-src'));

  expect(firstNonce).not.toBe(secondNonce);
  expect(scriptDirective).not.toContain("'unsafe-inline'");
  expect(firstHtml).toMatch(/<button disabled="" type="submit">Sign in<\/button>/u);

  const staticScriptPath = /<script[^>]+src="([^"]*\/_next\/static\/[^"]+\.js)"/u.exec(
    firstHtml,
  )?.[1];
  expect(staticScriptPath).toBeDefined();
  const staticResponse = await request.get(staticScriptPath ?? '', {
    headers: { 'Accept-Encoding': 'gzip' },
  });
  expect(staticResponse.headers()['content-encoding']).toBe('gzip');

  const cspErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('Content Security Policy')) {
      cspErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const pageResponse = await page.goto('/sign-in', { waitUntil: 'networkidle' });
  const pageNonce = nonceFromCsp(pageResponse?.headers()['content-security-policy']);
  const scriptNonces = await page
    .locator('script')
    .evaluateAll((scripts) => scripts.map((script) => (script as HTMLScriptElement).nonce));

  expect(scriptNonces.length).toBeGreaterThan(0);
  expect(new Set(scriptNonces)).toEqual(new Set([pageNonce]));
  const signInButton = page.getByRole('button', { name: 'Sign in' });
  await expect(signInButton).toBeEnabled();
  await signInButton.click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Enter a valid email address.' }),
  ).toContainText('Enter a valid email address.');

  await page.goto('/leagues/meade-county-demo/church-softball/seasons/spring-2026/schedule', {
    waitUntil: 'networkidle',
  });
  const publicSchedule = page.getByRole('region', { name: 'Published game schedule' });
  await expect(publicSchedule.getByRole('article').first()).toContainText('Demo Away Team');
  await expect(publicSchedule.getByRole('article').first()).toContainText('Demo Home Team');
  await expect(page.getByText('Loading league information…')).toHaveCount(0);
  expect(cspErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('admin publishes a private team, verifies its audit trail, and withdraws it', async ({
  page,
}) => {
  const password = getDemoPassword();
  test.skip(!password, 'Run the environment initializer to create synthetic demo credentials.');

  const suffix = `${Date.now()}-${test.info().workerIndex}`;
  const publicName = `E2E Team ${suffix}`;
  const slug = `e2e-team-${suffix}`;
  const publicSchedulePath =
    '/leagues/meade-county-demo/church-softball/seasons/spring-2026/schedule';
  const publicTeamsPath = '/leagues/meade-county-demo/church-softball/seasons/spring-2026/teams';

  await page.goto(publicSchedulePath);
  await expect(page.getByRole('heading', { level: 1, name: 'Schedule' })).toBeVisible();
  const publicSchedule = page.getByRole('region', { name: 'Published game schedule' });
  await expect(publicSchedule.getByRole('article').first()).toContainText('Demo Away Team');
  await expect(publicSchedule.getByRole('article').first()).toContainText('Demo Home Team');

  const adminBasePath = await signInAndOpenAdministration(page, password ?? '');

  await page.getByRole('link', { name: 'Manage seasons' }).click();
  const seasonCard = page.getByRole('article').filter({ hasText: 'Spring 2026' });
  await seasonCard.getByRole('link', { name: 'Manage season and teams' }).click();
  await page.getByRole('link', { name: 'Create team' }).click();
  await page.getByLabel('Internal team name').fill(`Internal ${publicName}`);
  await page.getByLabel('Approved public team name').fill(publicName);
  await page.getByLabel('Public URL name').fill(slug);
  await page.getByRole('button', { name: 'Create draft team' }).click();
  await expect(
    page.getByRole('heading', { level: 2, name: `Internal ${publicName}` }),
  ).toBeVisible();
  const editorAccessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    editorAccessibility.violations,
    'authenticated team editor accessibility violations',
  ).toEqual([]);
  const teamAdminPath = new URL(page.url()).pathname;
  const teamSeasonId = teamAdminPath.split('/').at(-1);

  await page.goto(publicTeamsPath);
  await expect(page.getByText(publicName, { exact: true })).toHaveCount(0);

  let publicationWasObserved = false;
  try {
    await page.goto(teamAdminPath);
    await page.getByRole('button', { name: 'Publish team' }).click();
    await expect(page.getByText('Team published with its approved public name.')).toBeVisible();
    publicationWasObserved = true;

    await page.goto(publicTeamsPath);
    await expect(page.getByRole('heading', { level: 2, name: publicName })).toBeVisible();

    await page.goto(`${adminBasePath}/audit`);
    await expect(page.getByRole('heading', { level: 1, name: 'Audit history' })).toBeVisible();
    const publishAuditRow = page
      .getByRole('row')
      .filter({ hasText: teamSeasonId ?? 'missing-team-id' })
      .filter({ hasText: 'team.published' });
    await expect(publishAuditRow).toContainText('team.published');
    await expect(publishAuditRow).toContainText('WEB');
  } finally {
    await page.goto(teamAdminPath);
    const publicationToggle = page.getByRole('button', {
      name: /^(?:Publish team|Withdraw public team)$/u,
    });
    await expect(publicationToggle).toBeVisible();
    if ((await publicationToggle.textContent())?.trim() === 'Withdraw public team') {
      await publicationToggle.click();
      await expect(
        page.getByText('Team withdrawn from public view. History was retained.'),
      ).toBeVisible();
      publicationWasObserved = true;
    }

    if (publicationWasObserved) {
      await expect(page.getByRole('button', { name: 'Publish team' })).toBeVisible();
      await expect(page.getByText('draft', { exact: true })).toBeVisible();

      await page.goto(publicTeamsPath);
      await expect(page.getByRole('heading', { level: 2, name: publicName })).toHaveCount(0);

      const withdrawnTeamResponse = await page.goto(`${publicTeamsPath}/${slug}`);
      expect([200, 404]).toContain(withdrawnTeamResponse?.status());
      await expect(
        page.getByRole('heading', { level: 1, name: 'This page is not published.' }),
      ).toBeVisible();
      await expect(page.getByText('Temporarily unavailable', { exact: true })).toHaveCount(0);

      await page.goto(`${adminBasePath}/audit`);
      const withdrawAuditRow = page
        .getByRole('row')
        .filter({ hasText: teamSeasonId ?? 'missing-team-id' })
        .filter({ hasText: 'team.withdrawn' });
      await expect(withdrawAuditRow).toContainText('team.withdrawn');
      await expect(withdrawAuditRow).toContainText('WEB');
    }
  }
});

test('@a11y static entry pages have no detectable WCAG A/AA violations', async ({ page }) => {
  for (const path of [
    '/',
    '/sign-in',
    '/auth/enroll-mfa',
    '/auth/two-factor',
    '/leagues/meade-county-demo/church-softball/seasons/spring-2026/schedule',
  ]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations, `${path} accessibility violations`).toEqual([]);
  }
});
