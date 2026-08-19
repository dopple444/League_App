import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { color, control, layout, typography } from './index';

const luminance = (hex: string): number => {
  const channels = hex
    .slice(1)
    .match(/.{2}/gu)
    ?.map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4),
    );
  if (!channels || channels.length !== 3) throw new Error(`Invalid color token: ${hex}`);
  const [red, green, blue] = channels;
  if (red === undefined || green === undefined || blue === undefined) {
    throw new Error(`Incomplete color token: ${hex}`);
  }
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrast = (foreground: string, background: string): number => {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

const kebabCase = (value: string): string =>
  value.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);

const flattenCssColors = (
  prefix: string,
  values: Readonly<Record<string, unknown>>,
): readonly (readonly [string, string])[] =>
  Object.entries(values).flatMap(([key, value]) => {
    const name = `${prefix}-${kebabCase(key)}`;
    return typeof value === 'string'
      ? ([[name, value]] as const)
      : flattenCssColors(name, value as Readonly<Record<string, unknown>>);
  });

describe('Modern Field UI tokens', () => {
  it('preserves the locked guide primitives and platform dimensions', () => {
    expect(color.background).toMatchObject({
      canvas: '#F8FAFC',
      surface: '#FFFFFF',
      surfaceMuted: '#F1F5F9',
      inverse: '#0F172A',
    });
    expect(color.text).toMatchObject({
      primary: '#0F172A',
      muted: '#64748B',
      inverse: '#F8FAFC',
    });
    expect(color.status).toMatchObject({
      success: '#10B981',
      warning: '#F59E0B',
      danger: '#EF4444',
      info: '#3B82F6',
      offline: '#94A3B8',
      live: '#10B981',
      pendingSync: '#F59E0B',
      officialFinal: '#0F172A',
      synchronizing: '#3B82F6',
    });
    expect(control.touchTargetMin).toBeGreaterThanOrEqual(44);
    expect(control.scoringTargetMin).toBeGreaterThanOrEqual(64);
    expect(layout.contentMaxWidth).toBe(1280);
  });

  it('uses Roboto Flex without the superseded display typeface', () => {
    expect(typography.fontFamily.sans[0]).toBe('Roboto Flex');
    expect(typography.fontFamily.web).toContain('Roboto Flex Variable');
    expect(typography.fontFamily.native).toBe('RobotoFlex_400Regular');
    expect(JSON.stringify(typography)).not.toMatch(/Inter|Georgia/u);
  });

  it('provides AA contrast for action and status text pairs', () => {
    const actionPairs = [
      [color.action.primary.foreground, color.action.primary.default],
      [color.action.secondary.foreground, color.action.secondary.default],
      [color.action.destructive.foreground, color.action.destructive.default],
    ] as const;
    const statusPairs = Object.values(color.statusAppearance).map(
      (appearance) => [appearance.text, appearance.surface] as const,
    );

    for (const [foreground, background] of [...actionPairs, ...statusPairs]) {
      expect(
        contrast(foreground, background),
        `${foreground} on ${background}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps every CSS color contract value aligned with TypeScript tokens', () => {
    const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').toUpperCase();
    const expected = [
      ...flattenCssColors('--color-background', color.background),
      ...flattenCssColors('--color-text', color.text),
      ...flattenCssColors('--color-brand', color.brand),
      ...flattenCssColors('--color-action', color.action),
      ...flattenCssColors('--color-border', color.border),
      ...flattenCssColors('--color-status', color.statusAppearance),
    ];

    for (const [name, value] of expected) {
      expect(css).toContain(`${name}: ${value}`.toUpperCase());
    }
    expect(css).toContain('--CONTENT-WIDTH: 80REM');
    expect(css).toContain('--TARGET-TOUCH-MIN: 2.75REM');
    expect(css).toContain('--TARGET-SCORING-MIN: 4REM');
  });
});
