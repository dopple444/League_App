import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Response } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { signIn } from './auth';

// Invitation inspection sends its bearer in a POST body. Disable traces for this file so a failed
// browser run cannot retain that ephemeral value in a trace archive.
test.use({ trace: 'off' });

const inspectPath = '/api/v1/onboarding/invitations/inspect';
const platformOnboardingPath = '/api/v1/platform/onboarding';
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const;

interface InvitationInspectionObservation {
  readonly fragmentLengthAtRequest: number | null;
  readonly inspectionCount: number;
  readonly queryLengthAtRequest: number | null;
}

const browserAddressHygiene = (page: Page, expectedPath: string) => {
  const address = new URL(page.url());
  return {
    fragmentLength: address.hash.length,
    isExpectedPath: address.pathname === expectedPath,
    queryLength: address.search.length,
  };
};

const expectTokenFreeSurface = async (page: Page, expectedPath: string): Promise<void> => {
  expect(browserAddressHygiene(page, expectedPath)).toEqual({
    fragmentLength: 0,
    isExpectedPath: true,
    queryLength: 0,
  });
  expect(
    await page.evaluate(() => {
      const storageKeys = [
        ...Object.keys(window.localStorage),
        ...Object.keys(window.sessionStorage),
      ];
      const historyText = JSON.stringify(window.history.state);
      const visibleText = document.body.innerText;
      return {
        historyContainsBearerMarker:
          historyText.includes('#token=') || historyText.includes('invitationToken'),
        invitationStorageKeys: storageKeys.filter((key) => /invitation|bearer/iu.test(key)).length,
        visibleBearerMarkers:
          Number(visibleText.includes('#token=')) + Number(visibleText.includes('invitationToken')),
      };
    }),
  ).toEqual({
    historyContainsBearerMarker: false,
    invitationStorageKeys: 0,
    visibleBearerMarkers: 0,
  });
};

const expectNoHorizontalOverflow = async (
  page: Page,
  label: string,
  viewports: readonly { readonly height: number; readonly width: number }[],
): Promise<void> => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) -
              document.documentElement.clientWidth,
          ),
        { message: `${viewport.width}px ${label} should not overflow horizontally` },
      )
      .toBeLessThanOrEqual(0);
  }
};

const expectNoAxeViolations = async (page: Page, label: string): Promise<void> => {
  const accessibility = await new AxeBuilder({ page }).withTags([...axeTags]).analyze();
  expect(accessibility.violations, `${label} accessibility violations`).toEqual([]);
};

const getDemoPassword = (): string | undefined => {
  if (process.env.DEMO_ADMIN_PASSWORD) return process.env.DEMO_ADMIN_PASSWORD;
  const envPath = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')].find(
    (path) => existsSync(path),
  );
  const match = envPath ? /^DEMO_ADMIN_PASSWORD=(.+)$/mu.exec(readFileSync(envPath, 'utf8')) : null;
  return match?.[1];
};

const isEmailSignInResponse = (response: Response): boolean =>
  response.request().method() === 'POST' &&
  new URL(response.url()).pathname === '/api/auth/sign-in/email';

const signInIdentity = async (page: Page, email: string, password: string): Promise<void> => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password').fill(password);
  const submit = page.getByRole('button', { name: 'Sign in' });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const [response] = await Promise.all([
      page.waitForResponse(isEmailSignInResponse),
      submit.click(),
    ]);
    if (response.status() !== 429) {
      if (!response.ok()) {
        throw new Error(`Synthetic identity sign-in failed with HTTP ${response.status()}.`);
      }
      return;
    }
    if (attempt === 3) {
      throw new Error('Synthetic identity sign-in remained rate limited after three attempts.');
    }
    const retryAfter = Number(
      response.headers()['retry-after'] ?? response.headers()['x-retry-after'],
    );
    const retryDelaySeconds =
      Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 65) : 61;
    await page.waitForTimeout(retryDelaySeconds * 1_000 + 250);
  }
};

const openEphemeralInvitation = async (page: Page): Promise<void> => {
  await page.goto('/');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.evaluate(() => {
      const bytes = window.crypto.getRandomValues(new Uint8Array(48));
      const ephemeralBearer = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
        '',
      );
      window.location.assign(`/auth/accept-invite#token=${encodeURIComponent(ephemeralBearer)}`);
    }),
  ]);
};

const installEphemeralInvitation = async (
  page: Page,
  outcome: 'ready' | 'unavailable',
): Promise<() => InvitationInspectionObservation> => {
  let inspectionCount = 0;
  let fragmentLengthAtRequest: number | null = null;
  let queryLengthAtRequest: number | null = null;
  await page.route(`**${inspectPath}`, async (route) => {
    inspectionCount += 1;
    const browserAddress = new URL(page.url());
    fragmentLengthAtRequest ??= browserAddress.hash.length;
    queryLengthAtRequest ??= browserAddress.search.length;
    const request = route.request();
    const requestUrl = new URL(request.url());
    const body = request.postDataJSON() as { readonly invitationToken?: unknown };
    if (
      request.method() !== 'POST' ||
      requestUrl.search !== '' ||
      typeof body.invitationToken !== 'string' ||
      body.invitationToken.length < 32
    ) {
      throw new Error('Invitation inspection did not use a bounded POST-body bearer.');
    }

    if (outcome === 'unavailable') {
      await route.fulfill({
        body: JSON.stringify({
          code: 'INVITATION_UNAVAILABLE',
          message: 'Invitation unavailable.',
          requestId: 'synthetic-browser-request',
        }),
        contentType: 'application/json',
        status: 410,
      });
      return;
    }

    await route.fulfill({
      body: JSON.stringify({
        administratorEmailHint: 'a***@example.invalid',
        expiresAt: '2026-09-01T12:00:00.000Z',
        leagueName: 'Synthetic Community Softball',
        organizationName: 'Synthetic Community Recreation',
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
  return () => ({ fragmentLengthAtRequest, inspectionCount, queryLengthAtRequest });
};

const syntheticPlatformItem = {
  acceptedAt: null,
  activatedAt: null,
  administratorEmail: 'administrator@example.invalid',
  createdAt: '2026-08-24T12:00:00.000Z',
  expiresAt: '2026-09-01T12:00:00.000Z',
  invitationId: '16a79428-8259-43c0-8504-e70e70e524ea',
  leagueId: '97ec788c-3c07-4a82-9b9f-c3612f7023e0',
  leagueName: 'Synthetic Community Softball',
  leagueSlug: 'synthetic-community-softball',
  organizationId: '6ecab6e5-acaa-485e-9d89-eb7a930e7ee8',
  organizationName: 'Synthetic Community Recreation',
  organizationSlug: 'synthetic-community-recreation',
  revokedAt: null,
  status: 'PENDING',
  timezone: 'America/New_York',
  version: 1,
} as const;

const installSyntheticPlatformRoutes = async (page: Page): Promise<() => number> => {
  let mutationCount = 0;
  await page.route('**/api/v1/me/security', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        mfaEnabled: true,
        mfaRequired: true,
        pendingActivation: false,
        platformAccess: true,
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
  await page.route(`**${platformOnboardingPath}`, async (route) => {
    if (route.request().method() !== 'GET') {
      mutationCount += 1;
      await route.fulfill({
        body: JSON.stringify({ code: 'EVIDENCE_MUTATION_BLOCKED', message: 'Mutation blocked.' }),
        contentType: 'application/json',
        status: 409,
      });
      return;
    }
    await route.fulfill({
      body: JSON.stringify({
        canProvisionTenants: true,
        canRevokeInvitations: true,
        items: [syntheticPlatformItem],
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
  await page.route('**/api/v1/platform/invitations/**', async (route) => {
    mutationCount += 1;
    await route.fulfill({
      body: JSON.stringify({ code: 'EVIDENCE_MUTATION_BLOCKED', message: 'Mutation blocked.' }),
      contentType: 'application/json',
      status: 409,
    });
  });
  await page.route('**/api/v1/me/organizations', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        items: [
          {
            leagues: [],
            name: syntheticPlatformItem.organizationName,
            organizationId: syntheticPlatformItem.organizationId,
            permissions: ['league:manage'],
            slug: syntheticPlatformItem.organizationSlug,
            timezone: syntheticPlatformItem.timezone,
          },
        ],
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
  return () => mutationCount;
};

test('missing invitation fragment exposes only safe recovery guidance', async ({ page }) => {
  await page.goto('/auth/accept-invite');

  const heading = page.getByRole('heading', { name: 'Invitation link required' });
  const alert = page.getByRole('alert').filter({ has: heading });
  await expect(heading).toBeVisible();
  await expect(alert).toContainText('Open the complete invitation link');
  await expect(page.getByRole('button', { name: 'Create account and continue' })).toHaveCount(0);
  expect(browserAddressHygiene(page, '/auth/accept-invite')).toEqual({
    fragmentLength: 0,
    isExpectedPath: true,
    queryLength: 0,
  });
});

test('unusable invitation is non-enumerating and clears its fragment immediately', async ({
  page,
}) => {
  const inspectionObservation = await installEphemeralInvitation(page, 'unavailable');
  await openEphemeralInvitation(page);

  const heading = page.getByRole('heading', { name: 'Invitation unavailable' });
  const alert = page.getByRole('alert').filter({ has: heading });
  await expect(heading).toBeVisible();
  await expect(alert).toContainText('expired, been revoked, or already been used');
  await expect(alert).not.toContainText('Synthetic Community Recreation');
  expect(inspectionObservation()).toEqual({
    fragmentLengthAtRequest: 0,
    inspectionCount: 1,
    queryLengthAtRequest: 0,
  });
  expect(browserAddressHygiene(page, '/auth/accept-invite')).toEqual({
    fragmentLength: 0,
    isExpectedPath: true,
    queryLength: 0,
  });
});

test('@a11y verified invitation form is responsive and has no detectable WCAG A/AA violations', async ({
  page,
}) => {
  const inspectionObservation = await installEphemeralInvitation(page, 'ready');
  await openEphemeralInvitation(page);

  await expect(page.getByRole('heading', { name: 'Verified invitation context' })).toBeVisible();
  await expect(page.getByText('Synthetic Community Recreation')).toBeVisible();
  await expect(page.getByText('a***@example.invalid')).toBeVisible();
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  expect(inspectionObservation()).toEqual({
    fragmentLengthAtRequest: 0,
    inspectionCount: 1,
    queryLengthAtRequest: 0,
  });
  await expectTokenFreeSurface(page, '/auth/accept-invite');
  await expectNoAxeViolations(page, 'invitation form');
  await expectNoHorizontalOverflow(page, 'invitation form', [
    { height: 900, width: 1440 },
    { height: 852, width: 393 },
    { height: 450, width: 720 },
  ]);

  await page.setViewportSize({ height: 852, width: 393 });
  const registrationForm = page.locator('form');
  for (const button of await registrationForm.getByRole('button').all()) {
    const box = await button.boundingBox();
    const safeLabel = (await button.innerText()).trim() || 'unnamed button';
    expect(box?.height ?? 0, `${safeLabel} touch target height`).toBeGreaterThanOrEqual(44);
  }
  for (const input of await registrationForm.locator('input').all()) {
    const box = await input.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
  }
});

test('@a11y mocked platform workbench and workspace chooser support keyboard, reflow, and WCAG A/AA', async ({
  page,
}) => {
  const mutationCount = await installSyntheticPlatformRoutes(page);
  await page.goto('/platform/onboarding');

  await expect(page.getByRole('heading', { level: 1, name: 'Customer foundations' })).toBeVisible();
  await expect(page.getByText('mfa protected', { exact: true })).toBeVisible();
  await expectTokenFreeSurface(page, '/platform/onboarding');

  const provisionTrigger = page.getByRole('button', { name: 'Provision customer' });
  await provisionTrigger.focus();
  await expect(provisionTrigger).toBeFocused();
  await provisionTrigger.press('Enter');
  const provisionTask = page.getByRole('region', { name: 'Provision customer' });
  await expect(provisionTask.getByLabel('Organization name (required)')).toBeFocused();
  const review = provisionTask.getByRole('button', { name: 'Review customer foundation' });
  await review.focus();
  await review.press('Enter');
  const provisionSummary = provisionTask.getByRole('alert');
  await expect(provisionSummary).toBeFocused();
  await expect(provisionTask.getByLabel('Organization name (required)')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expectNoAxeViolations(page, 'ADM-64 provision validation');
  await expectNoHorizontalOverflow(page, 'ADM-64 provision validation', [
    { height: 1000, width: 1440 },
    { height: 1000, width: 1024 },
    { height: 1400, width: 393 },
  ]);

  const cancel = provisionTask.getByRole('button', { name: 'Cancel' }).first();
  await cancel.focus();
  await cancel.press('Enter');
  await expect(provisionTask).toHaveCount(0);
  await expect(provisionTrigger).toBeFocused();

  const ledgerCard = page.getByRole('article', {
    name: syntheticPlatformItem.organizationName,
  });
  const revokeTrigger = ledgerCard.getByRole('button', { name: 'Revoke invitation' });
  await revokeTrigger.focus();
  await revokeTrigger.press('Enter');
  const confirmRevocation = ledgerCard.getByRole('button', { name: 'Confirm revocation' });
  await confirmRevocation.focus();
  await confirmRevocation.press('Enter');
  const revocationSummary = ledgerCard.getByRole('alert');
  await expect(revocationSummary).toBeFocused();
  await expect(ledgerCard.getByLabel('Revocation reason (required)')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expectNoAxeViolations(page, 'ADM-64 revocation validation');
  await expectNoHorizontalOverflow(page, 'ADM-64 revocation validation', [
    { height: 1000, width: 1440 },
    { height: 1000, width: 1024 },
    { height: 1400, width: 393 },
  ]);
  expect(mutationCount()).toBe(0);

  await page.goto('/admin/organizations');
  await expect(page.getByRole('heading', { name: 'Controlled-beta onboarding' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: syntheticPlatformItem.organizationName }),
  ).toBeVisible();
  await expect(
    page.getByText(/operations available to your separate Platform Operator/u),
  ).toBeVisible();
  await expect(page.getByText(/Provision customer foundations/u)).toHaveCount(0);
  await expectTokenFreeSurface(page, '/admin/organizations');
  await expectNoAxeViolations(page, 'SYS-07 workspace chooser');
  await expectNoHorizontalOverflow(page, 'SYS-07 workspace chooser', [
    { height: 1000, width: 1440 },
    { height: 1000, width: 1024 },
    { height: 1000, width: 393 },
  ]);

  const platformLink = page.getByRole('link', { name: 'Open platform operations' });
  await platformLink.focus();
  await expect(platformLink).toBeFocused();
  await platformLink.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Customer foundations' })).toBeVisible();
  expect(mutationCount()).toBe(0);
});

test('authenticated ordinary administrator is denied platform onboarding data', async ({
  page,
}) => {
  const password = getDemoPassword();
  test.skip(!password, 'Run the environment initializer to create synthetic demo credentials.');
  let platformListRequests = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'GET' &&
      new URL(request.url()).pathname === '/api/v1/platform/onboarding'
    ) {
      platformListRequests += 1;
    }
  });

  await signIn(page, password ?? '');
  await page.goto('/platform/onboarding');

  await expect(page.getByRole('heading', { name: 'Platform access unavailable' })).toBeVisible();
  await expect(
    page.getByText('Customer organization roles do not grant this access.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Provision customer' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Invitation ledger' })).toHaveCount(0);
  expect(platformListRequests).toBe(0);
});

test('synthetic platform operator remains MFA-gated before platform access', async ({ page }) => {
  test.setTimeout(180_000);
  const password = getDemoPassword();
  test.skip(!password, 'Run the environment initializer to create synthetic demo credentials.');

  await signInIdentity(page, 'operator@demo.invalid', password ?? '');

  await expect(page).toHaveURL(/\/auth\/(?:enroll-mfa|two-factor)$/u);
  await expect(
    page.getByRole('heading', {
      name: /^(?:Protect administrative access|Verify it’s you)$/u,
    }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/\/platform\/onboarding/u);
});

if (process.env.CAPTURE_UI_EVIDENCE === '1') {
  test('@evidence captures token-free controlled-beta onboarding viewports', async ({ page }) => {
    const evidenceDirectory = resolve(
      process.cwd(),
      '../../docs/evidence/ui/2026-08-24-controlled-beta-onboarding',
    );
    mkdirSync(evidenceDirectory, { recursive: true });
    const inspectionObservation = await installEphemeralInvitation(page, 'ready');
    const mutationCount = await installSyntheticPlatformRoutes(page);

    await openEphemeralInvitation(page);
    await expect(page.getByRole('heading', { name: 'Verified invitation context' })).toBeVisible();
    expect(inspectionObservation()).toEqual({
      fragmentLengthAtRequest: 0,
      inspectionCount: 1,
      queryLengthAtRequest: 0,
    });
    await expectTokenFreeSurface(page, '/auth/accept-invite');
    await page.setViewportSize({ height: 1000, width: 1440 });
    await page.screenshot({
      fullPage: true,
      path: resolve(evidenceDirectory, '01-invitation-ready-desktop-1440.png'),
    });
    await page.setViewportSize({ height: 1000, width: 393 });
    await expectTokenFreeSurface(page, '/auth/accept-invite');
    await page.screenshot({
      fullPage: true,
      path: resolve(evidenceDirectory, '02-invitation-ready-mobile-393.png'),
    });

    await page.goto('/platform/onboarding');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Customer foundations' }),
    ).toBeVisible();
    await page.setViewportSize({ height: 1000, width: 1440 });
    await expectTokenFreeSurface(page, '/platform/onboarding');
    await page.screenshot({
      fullPage: true,
      path: resolve(evidenceDirectory, '03-platform-workbench-desktop-1440.png'),
    });

    await page.setViewportSize({ height: 1000, width: 1024 });
    await page.getByRole('button', { name: 'Provision customer' }).click();
    await expect(page.getByRole('region', { name: 'Provision customer' })).toBeVisible();
    await expectTokenFreeSurface(page, '/platform/onboarding');
    await page.screenshot({
      fullPage: true,
      path: resolve(evidenceDirectory, '04-platform-provision-form-tablet-1024.png'),
    });
    await page.setViewportSize({ height: 1600, width: 393 });
    await expectTokenFreeSurface(page, '/platform/onboarding');
    await page.screenshot({
      fullPage: true,
      path: resolve(evidenceDirectory, '05-platform-provision-form-mobile-393.png'),
    });

    await page.goto('/admin/organizations');
    await expect(page.getByRole('heading', { name: 'Controlled-beta onboarding' })).toBeVisible();
    await page.setViewportSize({ height: 1000, width: 1440 });
    await expectTokenFreeSurface(page, '/admin/organizations');
    await page.screenshot({
      fullPage: true,
      path: resolve(evidenceDirectory, '06-workspace-chooser-desktop-1440.png'),
    });
    await page.setViewportSize({ height: 1000, width: 393 });
    await expectTokenFreeSurface(page, '/admin/organizations');
    await page.screenshot({
      fullPage: true,
      path: resolve(evidenceDirectory, '07-workspace-chooser-mobile-393.png'),
    });
    expect(mutationCount()).toBe(0);
  });
}
