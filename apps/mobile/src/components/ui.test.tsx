import { color, control, typography, type StatusTone } from '@league/ui-tokens';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { ActionButton, Heading, StatusPill } from './ui';

describe('mobile UI primitives', () => {
  it('uses the native Modern Field typeface and exposes semantic headings', async () => {
    const view = await render(<Heading eyebrow="Season" title="League overview" />);
    const heading = view.getByRole('header', { name: 'League overview' });

    expect(heading).toHaveStyle({ fontFamily: typography.fontFamily.native });
    expect(view.getByText('SEASON')).toBeTruthy();
  });

  it.each([
    ['SCHEDULED', 'info'],
    ['FINAL', 'officialFinal'],
    ['POSTPONED', 'warning'],
    ['PENDING_SYNC', 'pendingSync'],
    ['PUBLISHED', 'success'],
    ['SUCCESS', 'success'],
  ] as const satisfies readonly (readonly [string, StatusTone])[])(
    'maps %s to the %s semantic status appearance',
    async (value, tone) => {
      const view = await render(<StatusPill value={value} />);
      const appearance = color.statusAppearance[tone];

      expect(view.getByLabelText(`Status: ${value.replaceAll('_', ' ')}`)).toHaveStyle({
        backgroundColor: appearance.surface,
        borderColor: appearance.border,
      });
      expect(view.getByText(value.replaceAll('_', ' '))).toHaveStyle({ color: appearance.text });
      expect(view.getByTestId(`status-${tone}-indicator`)).toHaveStyle({
        backgroundColor: appearance.indicator,
        borderColor: appearance.text,
      });
    },
  );

  it('uses a labeled neutral appearance for an unknown status', async () => {
    const view = await render(<StatusPill value="RAIN_REVIEW" />);

    expect(view.getByLabelText('Status: RAIN REVIEW')).toHaveStyle({
      backgroundColor: color.statusAppearance.neutral.surface,
      borderColor: color.statusAppearance.neutral.border,
    });
    expect(view.getByText('RAIN REVIEW')).toBeTruthy();
    expect(view.getByTestId('status-neutral-indicator')).toHaveStyle({
      backgroundColor: color.statusAppearance.neutral.indicator,
      borderColor: color.statusAppearance.neutral.text,
    });
  });

  it.each([
    {
      variant: 'primary' as const,
      backgroundColor: color.action.primary.default,
      borderColor: color.action.primary.default,
      foreground: color.action.primary.foreground,
    },
    {
      variant: 'secondary' as const,
      backgroundColor: color.action.secondary.default,
      borderColor: color.action.secondary.border,
      foreground: color.action.secondary.foreground,
    },
    {
      variant: 'destructive' as const,
      backgroundColor: color.action.destructive.default,
      borderColor: color.action.destructive.default,
      foreground: color.action.destructive.foreground,
    },
  ])('renders the $variant action with semantic colors', async (expected) => {
    const view = await render(
      <ActionButton
        label={`${expected.variant} action`}
        onPress={jest.fn()}
        variant={expected.variant}
      />,
    );

    expect(view.getByRole('button', { name: `${expected.variant} action` })).toHaveStyle({
      backgroundColor: expected.backgroundColor,
      borderColor: expected.borderColor,
    });
    expect(view.getByText(`${expected.variant} action`)).toHaveStyle({
      color: expected.foreground,
    });
  });

  it('keeps standard and scoring actions at their required target sizes', async () => {
    const view = await render(
      <>
        <ActionButton label="Standard action" onPress={jest.fn()} />
        <ActionButton label="Scoring action" onPress={jest.fn()} size="scoring" />
      </>,
    );

    expect(view.getByRole('button', { name: 'Standard action' })).toHaveStyle({
      minHeight: control.touchTargetMin,
    });
    expect(view.getByRole('button', { name: 'Scoring action' })).toHaveStyle({
      minHeight: control.scoringTargetMin,
    });
  });

  it('uses a semantic disabled state and does not invoke its action', async () => {
    const onPress = jest.fn();
    const view = await render(
      <ActionButton disabled label="Unavailable action" onPress={onPress} variant="destructive" />,
    );
    const button = view.getByRole('button', { name: 'Unavailable action' });

    expect(button.props.accessibilityState).toEqual({ disabled: true });
    expect(button).toHaveStyle({
      backgroundColor: color.action.disabled.surface,
      borderColor: color.action.disabled.border,
    });
    expect(view.getByText('Unavailable action')).toHaveStyle({ color: color.action.disabled.text });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('provides an operable labeled action', async () => {
    const onPress = jest.fn();
    const view = await render(<ActionButton label="Choose organization" onPress={onPress} />);
    await fireEvent.press(view.getByRole('button', { name: 'Choose organization' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
