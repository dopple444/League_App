import { defineConfig, devices } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readLocalEnvironment = (): Readonly<Record<string, string>> => {
  const candidates = [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) return {};
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
};

const localEnvironment = readLocalEnvironment();
const gatewayBaseUrl =
  process.env.PLAYWRIGHT_BASE_URL ??
  localEnvironment.WEB_ORIGIN ??
  `http://localhost:${localEnvironment.GATEWAY_PORT ?? '8080'}`;
const localChromiumExecutable = process.env.CI
  ? undefined
  : [
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
    ].find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 90_000,
  use: {
    baseURL: gatewayBaseUrl,
    ...(localChromiumExecutable
      ? { launchOptions: { executablePath: localChromiumExecutable } }
      : {}),
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { grep: /@a11y/u, name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
});
