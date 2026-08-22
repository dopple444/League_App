import { expect, test, type Locator, type Page, type Response } from '@playwright/test';
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

const facilityResponse = (
  response: Response,
  method: 'POST' | 'PATCH',
  pathname: string,
): boolean =>
  response.request().method() === method && new URL(response.url()).pathname === pathname;

const directChildResponse = (
  response: Response,
  method: 'POST' | 'PATCH',
  collectionPath: string,
): boolean => {
  const pathname = new URL(response.url()).pathname;
  if (response.request().method() !== method || !pathname.startsWith(`${collectionPath}/`))
    return false;
  return !pathname.slice(collectionPath.length + 1).includes('/');
};

const responseIdentifier = async (
  response: Response,
  key: 'venueId' | 'fieldId',
): Promise<string> => {
  expect(response.ok(), `${response.request().method()} ${new URL(response.url()).pathname}`).toBe(
    true,
  );
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !(key in body) || typeof body[key] !== 'string')
    throw new Error(`The facility response did not include a string ${key}.`);
  return body[key];
};

const venueDetails = (page: Page, name: string): Locator =>
  page.locator('details').filter({ has: page.getByText(name, { exact: true }) });

const existingName = async (
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
  action: 'venue.created' | 'venue.updated' | 'field.created' | 'field.updated',
  targetType: 'Venue' | 'Field',
  targetId: string,
): Promise<void> => {
  const row = table.getByRole('row').filter({ hasText: action }).filter({ hasText: targetId });
  await expect(row.first(), `${action} audit for ${targetId}`).toBeVisible();
  await expect(row.first()).toContainText(targetType);
  await expect(row.first()).toContainText('Source WEB');
};

test('administrator creates and updates a tenant-scoped venue and field with audit history', async ({
  page,
}) => {
  const password = getDemoPassword();
  test.skip(!password, 'Run the environment initializer to create synthetic demo credentials.');

  const longToken = 'x'.repeat(72);
  const venueNames = [
    `A E2E Reusable Venue ${longToken}`,
    `A E2E Reusable Venue ${longToken} Updated`,
  ] as const;
  const fieldNames = [
    `A E2E Reusable Field ${longToken}`,
    `A E2E Reusable Field ${longToken} Updated`,
  ] as const;
  const directions = 'Synthetic public entrance for the reusable browser fixture.';
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  const adminPath = await signInAndOpenAdministration(page, password ?? '');
  const organizationId = organizationIdFromAdminPath(adminPath);
  await page.getByRole('link', { name: 'Manage facilities' }).click();
  await expect(page).toHaveURL(`${adminPath}/venues`);
  await expect(page.getByRole('heading', { level: 1, name: 'Venues & Fields' })).toBeVisible();
  await expect(page.getByText('Loading venues and fields…')).toHaveCount(0);

  const venueCollectionPath = `/api/v1/organizations/${organizationId}/venues`;
  let venueCreated = false;
  let currentVenueName = await existingName(page.locator('body'), venueNames);
  if (!currentVenueName) {
    venueCreated = true;
    currentVenueName = venueNames[0];
    await page.getByRole('button', { name: 'Add Venue' }).click();
    const createVenuePanel = page.getByRole('region', { name: 'Add venue' });
    await createVenuePanel.getByLabel('Venue name (required)').fill(currentVenueName);
    const [createVenueResponse] = await Promise.all([
      page.waitForResponse((response) => facilityResponse(response, 'POST', venueCollectionPath)),
      createVenuePanel.getByRole('button', { name: 'Add venue' }).click(),
    ]);
    await responseIdentifier(createVenueResponse, 'venueId');
    await expect(page.getByRole('status')).toContainText(`${currentVenueName} was added.`);
  }

  const currentVenue = venueDetails(page, currentVenueName);
  const currentSummary = currentVenue.locator('summary');
  if (venueCreated) await expect(currentSummary).toBeFocused();
  await currentSummary.click();
  await currentVenue.getByRole('button', { name: 'Edit venue' }).click();
  const nextVenueName = currentVenueName === venueNames[0] ? venueNames[1] : venueNames[0];
  const editVenuePanel = page.getByRole('region', { name: `Edit ${currentVenueName}` });
  await editVenuePanel.getByLabel('Venue name (required)').fill(nextVenueName);
  await editVenuePanel.getByLabel('Active').uncheck();
  const [updateVenueResponse] = await Promise.all([
    page.waitForResponse((response) => directChildResponse(response, 'PATCH', venueCollectionPath)),
    editVenuePanel.getByRole('button', { name: 'Save changes' }).click(),
  ]);
  const venueId = await responseIdentifier(updateVenueResponse, 'venueId');
  const venuePath = `${venueCollectionPath}/${venueId}`;
  await expect(page.getByRole('status')).toContainText(`${nextVenueName} was updated.`);

  const updatedVenue = venueDetails(page, nextVenueName);
  const updatedSummary = updatedVenue.locator('summary');
  await expect(updatedSummary).toBeFocused();
  await expect(updatedSummary).toContainText('inactive');
  const fieldCollectionPath = `${venuePath}/fields`;
  let fieldCreated = false;
  let currentFieldName = await existingName(updatedVenue, fieldNames);
  if (!currentFieldName) {
    fieldCreated = true;
    currentFieldName = fieldNames[0];
    await updatedVenue.getByRole('button', { name: 'Add Field' }).click();
    const createFieldPanel = page.getByRole('region', {
      name: `Add field at ${nextVenueName}`,
    });
    await createFieldPanel.getByLabel('Field name (required)').fill(currentFieldName);
    await createFieldPanel.getByLabel('Public directions (optional)').fill(directions);
    await createFieldPanel.getByLabel('Fence distance in feet (optional)').fill('275');
    await createFieldPanel.getByLabel('Lights available').check();
    const [createFieldResponse] = await Promise.all([
      page.waitForResponse((response) => facilityResponse(response, 'POST', fieldCollectionPath)),
      createFieldPanel.getByRole('button', { name: 'Add field' }).click(),
    ]);
    await responseIdentifier(createFieldResponse, 'fieldId');
    await expect(page.getByRole('status')).toContainText(`${currentFieldName} was added.`);
    await expect(updatedSummary).toBeFocused();
  }

  const nextFieldName = currentFieldName === fieldNames[0] ? fieldNames[1] : fieldNames[0];
  await updatedVenue.getByRole('button', { name: `Edit ${currentFieldName}` }).click();
  const editFieldPanel = page.getByRole('region', { name: `Edit ${currentFieldName}` });
  await editFieldPanel.getByLabel('Field name (required)').fill(nextFieldName);
  await editFieldPanel.getByLabel('Public directions (optional)').fill(directions);
  await editFieldPanel.getByLabel('Fence distance in feet (optional)').fill('285');
  await editFieldPanel.getByLabel('Lights available').check();
  await editFieldPanel.getByLabel('Active').uncheck();
  const [updateFieldResponse] = await Promise.all([
    page.waitForResponse((response) => directChildResponse(response, 'PATCH', fieldCollectionPath)),
    editFieldPanel.getByRole('button', { name: 'Save changes' }).click(),
  ]);
  const fieldId = await responseIdentifier(updateFieldResponse, 'fieldId');
  await expect(page.getByRole('status')).toContainText(`${nextFieldName} was updated.`);
  const updatedFieldRow = updatedVenue.getByRole('row').filter({ hasText: nextFieldName });
  await expect(updatedFieldRow).toContainText('285 ft');
  await expect(updatedFieldRow.getByText('inactive', { exact: true })).toBeVisible();

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
        { message: `${viewport.width}px venue page should not overflow horizontally` },
      )
      .toBeLessThanOrEqual(0);
  }

  await page.setViewportSize({ height: 852, width: 393 });
  await expect(updatedSummary).toBeFocused();
  await updatedSummary.press('Enter');
  await expect(updatedVenue).not.toHaveAttribute('open', '');
  await updatedSummary.press('Enter');
  await expect(updatedVenue).toHaveAttribute('open', '');
  const summaryBox = await updatedSummary.boundingBox();
  expect(summaryBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  for (const button of await updatedVenue.getByRole('button').all()) {
    if (await button.isVisible()) {
      const box = await button.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  }

  await page.getByRole('link', { name: 'Audit history' }).click();
  await expect(page).toHaveURL(`${adminPath}/audit`);
  const auditTable = page.getByRole('table', { name: 'Most recent audited changes' });
  await expect(auditTable).toBeVisible();
  if (venueCreated) await expectAuditAction(auditTable, 'venue.created', 'Venue', venueId);
  await expectAuditAction(auditTable, 'venue.updated', 'Venue', venueId);
  if (fieldCreated) await expectAuditAction(auditTable, 'field.created', 'Field', fieldId);
  await expectAuditAction(auditTable, 'field.updated', 'Field', fieldId);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

if (process.env.CAPTURE_UI_EVIDENCE === '1') {
  test('@evidence captures synthetic venue and field administration viewports', async ({
    page,
  }) => {
    const password = getDemoPassword();
    test.skip(!password, 'Run the environment initializer to create synthetic demo credentials.');

    const evidenceDirectory = resolve(
      process.cwd(),
      '../../docs/evidence/ui/2026-08-21-venue-field-management',
    );
    mkdirSync(evidenceDirectory, { recursive: true });

    const adminPath = await signInAndOpenAdministration(page, password ?? '');
    await page.getByRole('link', { name: 'Manage facilities' }).click();
    await expect(page).toHaveURL(`${adminPath}/venues`);
    await expect(page.getByText('Loading venues and fields…')).toHaveCount(0);

    const seededVenue = venueDetails(page, 'Synthetic Ballpark');
    await expect(seededVenue).toBeVisible();
    await page.setViewportSize({ height: 1000, width: 1440 });
    await seededVenue.locator('summary').click();
    await seededVenue.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: resolve(evidenceDirectory, '01-venues-expanded-desktop-1440.png'),
    });

    await page.setViewportSize({ height: 1000, width: 1024 });
    await seededVenue.getByRole('button', { name: 'Add Field' }).click();
    const fieldPanel = page.getByRole('region', { name: 'Add field at Synthetic Ballpark' });
    await expect(fieldPanel).toBeVisible();
    await fieldPanel.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: resolve(evidenceDirectory, '02-add-field-form-tablet-1024.png'),
    });

    await page.setViewportSize({ height: 1600, width: 393 });
    await seededVenue.evaluate((element) => {
      window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 88 });
    });
    await page.screenshot({
      path: resolve(evidenceDirectory, '03-add-field-form-mobile-393.png'),
    });
  });
}
