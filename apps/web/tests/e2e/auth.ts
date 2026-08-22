import { expect, type Page, type Response } from '@playwright/test';

const isEmailSignInResponse = (response: Response): boolean =>
  response.request().method() === 'POST' &&
  new URL(response.url()).pathname === '/api/auth/sign-in/email';

export const signIn = async (page: Page, password: string): Promise<void> => {
  await page.goto('/sign-in');
  await page.getByLabel('Email address').fill('admin@demo.invalid');
  await page.getByLabel('Password').fill(password);

  const submit = page.getByRole('button', { name: 'Sign in' });
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await expect(submit).toBeEnabled();
    const [response] = await Promise.all([
      page.waitForResponse(isEmailSignInResponse),
      submit.click(),
    ]);

    if (response.status() !== 429) {
      if (!response.ok()) {
        throw new Error(`Synthetic administrator sign-in failed with HTTP ${response.status()}.`);
      }
      await expect(page).toHaveURL(/\/admin\/organizations$/u);
      return;
    }

    if (attempt === 3) {
      throw new Error(
        'Synthetic administrator sign-in remained rate limited after three attempts.',
      );
    }

    const retryAfter = Number(response.headers()['x-retry-after']);
    const retryDelaySeconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 10;
    await page.waitForTimeout(retryDelaySeconds * 1_000 + 250);
  }
};

export const signInAndOpenAdministration = async (
  page: Page,
  password: string,
): Promise<string> => {
  await signIn(page, password);

  const openAdministration = page.getByRole('link', { name: 'Open administration' });
  const href = await openAdministration.getAttribute('href');
  if (!href || !/^\/admin\/[^/]+$/u.test(href)) {
    throw new Error(`The synthetic organization link is invalid: ${href ?? '<missing>'}`);
  }
  await openAdministration.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`, 'u'));
  await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
  return href;
};
