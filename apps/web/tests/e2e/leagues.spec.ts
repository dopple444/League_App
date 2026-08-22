import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Response } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { signInAndOpenAdministration } from './auth';

const getDemoPassword = (): string | undefined => {
  if (process.env.DEMO_ADMIN_PASSWORD) return process.env.DEMO_ADMIN_PASSWORD;
  const envPath = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')].find(
    (path) => existsSync(path),
  );
  const match = envPath ? /^DEMO_ADMIN_PASSWORD=(.+)$/mu.exec(readFileSync(envPath, 'utf8')) : null;
  return match?.[1];
};

const organizationIdFromAdminPath = (adminPath: string): string => {
  const organizationId = adminPath.split('/').at(-1);
  if (!organizationId) throw new Error(`Could not read an organization ID from ${adminPath}.`);
  return organizationId;
};

const leagueMutationResponse = (
  response: Response,
  method: 'POST' | 'PATCH',
  collectionPath: string,
): boolean => {
  const pathname = new URL(response.url()).pathname;
  if (response.request().method() !== method) return false;
  if (method === 'POST') return pathname === collectionPath;
  return (
    pathname.startsWith(`${collectionPath}/`) &&
    !pathname.slice(collectionPath.length + 1).includes('/')
  );
};

const leagueIdentifier = async (response: Response, expectedStatus: 200 | 201): Promise<string> => {
  expect(
    response.status(),
    `${response.request().method()} ${new URL(response.url()).pathname} status`,
  ).toBe(expectedStatus);
  expect(response.ok(), `${response.request().method()} ${new URL(response.url()).pathname}`).toBe(
    true,
  );
  const body: unknown = await response.json();
  if (
    !body ||
    typeof body !== 'object' ||
    !('leagueId' in body) ||
    typeof body.leagueId !== 'string'
  ) {
    throw new Error('The league response did not include a string leagueId.');
  }
  return body.leagueId;
};

const existingFixtureName = async (
  root: Locator,
  candidates: readonly [string, string],
): Promise<string | null> => {
  for (const candidate of candidates) {
    if ((await root.getByText(candidate, { exact: true }).count()) === 1) return candidate;
  }
  return null;
};

const expectAuditAction = async (
  table: Locator,
  action: 'league.created' | 'league.updated',
  leagueId: string,
): Promise<void> => {
  const row = table.getByRole('row').filter({ hasText: action }).filter({ hasText: leagueId });
  await expect(row.first(), `${action} audit for ${leagueId}`).toBeVisible();
  await expect(row.first()).toContainText('League');
  await expect(row.first()).toContainText('Source WEB');
};

test('administrator creates and updates a dedicated tenant-scoped league with audit history', async ({
  page,
}) => {
  const password = getDemoPassword();
  test.skip(!password, 'Run the environment initializer to create synthetic demo credentials.');

  const longToken = 'x'.repeat(72);
  const leagueNames = [
    `A E2E Reusable League ${longToken}`,
    `A E2E Reusable League ${longToken} Updated`,
  ] as const;
  const leagueSlugs = [
    `e2e-reusable-league-${'x'.repeat(48)}`,
    `e2e-reusable-league-updated-${'x'.repeat(38)}`,
  ] as const;
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const adminPath = await signInAndOpenAdministration(page, password ?? '');
  const organizationId = organizationIdFromAdminPath(adminPath);
  await page.getByRole('link', { name: 'Manage leagues' }).click();
  await expect(page).toHaveURL(`${adminPath}/leagues`);
  await expect(page.getByRole('heading', { level: 1, name: 'Leagues' })).toBeVisible();
  await expect(page.getByText('Loading leagues…')).toHaveCount(0);

  const collectionPath = `/api/v1/organizations/${organizationId}/leagues`;
  let created = false;
  let currentName = await existingFixtureName(page.locator('body'), leagueNames);
  let currentSlug = leagueSlugs[0];
  if (!currentName) {
    created = true;
    currentName = leagueNames[0];
    await page.getByRole('button', { name: 'Add League' }).click();
    const createPanel = page.getByRole('region', { name: 'Add league' });
    await createPanel.getByLabel('League name (required)').fill(currentName);
    await createPanel.getByLabel('Public URL name (required)').fill(currentSlug);
    const [createResponse] = await Promise.all([
      page.waitForResponse((response) => leagueMutationResponse(response, 'POST', collectionPath)),
      createPanel.getByRole('button', { name: 'Add league' }).click(),
    ]);
    await leagueIdentifier(createResponse, 201);
    await expect(page.getByRole('status')).toContainText(`${currentName} was added.`);
  }

  const currentCard = page.getByRole('article', { name: currentName });
  if (created) await expect(currentCard).toBeFocused();
  await currentCard.getByRole('button', { name: `Edit ${currentName}` }).click();
  const editPanel = page.getByRole('region', { name: `Edit ${currentName}` });
  const currentSlugValue = await editPanel.getByLabel('Public URL name (required)').inputValue();
  currentSlug = currentSlugValue === leagueSlugs[0] ? leagueSlugs[0] : leagueSlugs[1];
  const nextName = currentName === leagueNames[0] ? leagueNames[1] : leagueNames[0];
  const nextSlug = currentSlug === leagueSlugs[0] ? leagueSlugs[1] : leagueSlugs[0];
  await editPanel.getByLabel('League name (required)').fill(nextName);
  await editPanel.getByLabel('Public URL name (required)').fill(nextSlug);
  const active = editPanel.getByLabel('Active');
  const wasActive = await active.isChecked();
  if (wasActive) await active.uncheck();
  else await active.check();
  const [updateResponse] = await Promise.all([
    page.waitForResponse((response) => leagueMutationResponse(response, 'PATCH', collectionPath)),
    editPanel.getByRole('button', { name: 'Save changes' }).click(),
  ]);
  const leagueId = await leagueIdentifier(updateResponse, 200);
  await expect(page.getByRole('status')).toContainText(`${nextName} was updated.`);

  const updatedCard = page.getByRole('article', { name: nextName });
  await expect(updatedCard).toBeFocused();
  await expect(updatedCard.getByText(nextSlug, { exact: true })).toBeVisible();
  await expect(
    updatedCard.getByText(wasActive ? 'inactive' : 'active', { exact: true }),
  ).toBeVisible();

  for (const viewport of [
    { height: 900, width: 1440 },
    { height: 768, width: 1024 },
    { height: 852, width: 393 },
    { height: 450, width: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) -
              document.documentElement.clientWidth,
          ),
        { message: `${viewport.width}px league page should not overflow horizontally` },
      )
      .toBeLessThanOrEqual(0);
  }

  await page.setViewportSize({ height: 852, width: 393 });
  const editButton = updatedCard.getByRole('button', { name: `Edit ${nextName}` });
  await editButton.focus();
  await editButton.press('Enter');
  const keyboardPanel = page.getByRole('region', { name: `Edit ${nextName}` });
  await expect(keyboardPanel).toBeVisible();
  for (const button of await keyboardPanel.getByRole('button').all()) {
    const box = await button.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  for (const input of [
    keyboardPanel.getByLabel('League name (required)'),
    keyboardPanel.getByLabel('Public URL name (required)'),
  ]) {
    const box = await input.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
  }
  const activeInput = keyboardPanel.getByLabel('Active');
  await expect(activeInput).toHaveAttribute('aria-describedby', 'active-help');
  await expect(keyboardPanel.locator('#active-help')).toContainText('Inactive leagues remain');
  const activeLabelBox = await keyboardPanel.locator('label[for="active"]').boundingBox();
  expect(activeLabelBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(activeLabelBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  const cancel = keyboardPanel.getByRole('button', { name: 'Cancel' }).first();
  await cancel.focus();
  await cancel.press('Enter');
  await expect(keyboardPanel).toHaveCount(0);
  await expect(editButton).toBeFocused();

  await page.getByRole('link', { name: 'Audit history' }).click();
  await expect(page).toHaveURL(`${adminPath}/audit`);
  const auditTable = page.getByRole('table', { name: 'Most recent audited changes' });
  await expect(auditTable).toBeVisible();
  if (created) await expectAuditAction(auditTable, 'league.created', leagueId);
  await expectAuditAction(auditTable, 'league.updated', leagueId);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('@a11y authenticated league and facility forms have no detectable WCAG A/AA violations', async ({
  page,
}) => {
  const password = getDemoPassword();
  test.skip(!password, 'Run the environment initializer to create synthetic demo credentials.');

  const adminPath = await signInAndOpenAdministration(page, password ?? '');
  await page.getByRole('link', { name: 'Manage leagues' }).click();
  await expect(page).toHaveURL(`${adminPath}/leagues`);
  await expect(page.getByText('Loading leagues…')).toHaveCount(0);

  const addLeague = page.getByRole('button', { name: 'Add League' });
  await addLeague.focus();
  await addLeague.press('Enter');
  const panel = page.getByRole('region', { name: 'Add league' });
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel('League name (required)')).toHaveAttribute('required', '');
  await expect(panel.getByLabel('Public URL name (required)')).toHaveAttribute('required', '');

  for (const button of await panel.getByRole('button').all()) {
    const box = await button.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  for (const input of [
    panel.getByLabel('League name (required)'),
    panel.getByLabel('Public URL name (required)'),
  ]) {
    const box = await input.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
  }
  const activeInput = panel.getByLabel('Active');
  await expect(activeInput).toHaveAttribute('aria-describedby', 'active-help');
  await expect(panel.locator('#active-help')).toContainText('Inactive leagues remain');
  const activeLabelBox = await panel.locator('label[for="active"]').boundingBox();
  expect(activeLabelBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(activeLabelBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);

  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(accessibility.violations, 'authenticated league form accessibility violations').toEqual(
    [],
  );

  await panel.getByRole('button', { name: 'Cancel' }).first().click();
  await page.getByRole('link', { name: 'Venues and fields' }).click();
  await expect(page).toHaveURL(`${adminPath}/venues`);
  await expect(page.getByText('Loading venues and fields…')).toHaveCount(0);

  const firstVenue = page
    .getByRole('region', { name: 'Venue and field list' })
    .locator('details')
    .first();
  const venueSummary = firstVenue.locator('summary');
  await expect(venueSummary).toBeVisible();
  await venueSummary.focus();
  await venueSummary.press('Enter');
  await expect(firstVenue).toHaveAttribute('open', '');
  const addField = firstVenue.getByRole('button', { name: 'Add Field' });
  await addField.focus();
  await addField.press('Enter');
  const fieldPanel = page.getByRole('region', { name: /^Add field at /u });
  await expect(fieldPanel).toBeVisible();
  await expect(fieldPanel.getByLabel('Field name (required)')).toHaveAttribute('required', '');

  for (const control of [venueSummary, ...(await fieldPanel.getByRole('button').all())]) {
    const box = await control.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  for (const control of [
    fieldPanel.getByLabel('Field name (required)'),
    fieldPanel.getByLabel('Public directions (optional)'),
    fieldPanel.getByLabel('Fence distance in feet (optional)'),
  ]) {
    const box = await control.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);

  const facilityAccessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    facilityAccessibility.violations,
    'authenticated expanded venue and field form accessibility violations',
  ).toEqual([]);
});

if (process.env.CAPTURE_UI_EVIDENCE === '1') {
  test('@evidence captures synthetic league administration viewports', async ({ page }) => {
    const password = getDemoPassword();
    test.skip(!password, 'Run the environment initializer to create synthetic demo credentials.');

    const evidenceDirectory = resolve(
      process.cwd(),
      '../../docs/evidence/ui/2026-08-21-league-management',
    );
    mkdirSync(evidenceDirectory, { recursive: true });

    const adminPath = await signInAndOpenAdministration(page, password ?? '');
    await page.getByRole('link', { name: 'Manage leagues' }).click();
    await expect(page).toHaveURL(`${adminPath}/leagues`);
    await expect(page.getByText('Loading leagues…')).toHaveCount(0);

    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.screenshot({
      path: resolve(evidenceDirectory, '01-league-basics-desktop-1440.png'),
    });

    await page.setViewportSize({ height: 1000, width: 1024 });
    await page.getByRole('button', { name: 'Add League' }).click();
    const createPanel = page.getByRole('region', { name: 'Add league' });
    await expect(createPanel).toBeVisible();
    await createPanel.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: resolve(evidenceDirectory, '02-league-form-tablet-1024.png'),
    });

    await page.setViewportSize({ height: 1400, width: 393 });
    await createPanel.evaluate((element) => {
      window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 88 });
    });
    await page.screenshot({
      path: resolve(evidenceDirectory, '03-league-form-mobile-393.png'),
    });
  });
}
