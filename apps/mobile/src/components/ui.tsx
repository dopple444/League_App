import { color, control, radii, spacing, typography, type StatusTone } from '@league/ui-tokens';
import type { PropsWithChildren, ReactElement, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type RefreshControlProps,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export type ActionButtonVariant = 'primary' | 'secondary' | 'destructive';
export type ActionButtonSize = 'standard' | 'scoring';

const statusToneByValue = {
  CANCELED: 'danger',
  ERROR: 'danger',
  FINAL: 'officialFinal',
  LIVE: 'live',
  OFFICIAL_FINAL: 'officialFinal',
  OFFLINE: 'offline',
  PENDING_SYNC: 'pendingSync',
  POSTPONED: 'warning',
  PUBLISHED: 'success',
  SCHEDULED: 'info',
  SUCCESS: 'success',
  SYNCHRONIZING: 'synchronizing',
  WORKFLOW_PENDING: 'workflowPending',
} as const satisfies Readonly<Record<string, StatusTone>>;

function statusTone(value: string): StatusTone {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/gu, '_');
  return statusToneByValue[normalized as keyof typeof statusToneByValue] ?? 'neutral';
}

function statusLabel(value: string): string {
  return value.trim().replace(/[_-]+/gu, ' ').replace(/\s+/gu, ' ') || 'Unknown';
}

export function Screen({
  children,
  refreshControl,
  scroll = true,
}: PropsWithChildren<{
  readonly refreshControl?: ReactElement<RefreshControlProps>;
  readonly scroll?: boolean;
}>) {
  const content = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={refreshControl}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

export function Heading({
  eyebrow,
  title,
  description,
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description?: string;
}) {
  return (
    <View style={styles.heading}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function ActionButton({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
  size = 'standard',
  accessibilityHint,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly variant?: ActionButtonVariant;
  readonly size?: ActionButtonSize;
  readonly accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'destructive' && styles.buttonDestructive,
        size === 'standard' ? styles.buttonStandard : styles.buttonScoring,
        pressed && !disabled && variant === 'primary' && styles.buttonPrimaryPressed,
        pressed && !disabled && variant === 'secondary' && styles.buttonSecondaryPressed,
        pressed && !disabled && variant === 'destructive' && styles.buttonDestructivePressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'primary' && styles.buttonPrimaryText,
          variant === 'secondary' && styles.buttonSecondaryText,
          variant === 'destructive' && styles.buttonDestructiveText,
          size === 'scoring' && styles.buttonScoringText,
          disabled && styles.buttonDisabledText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function InlineError({
  children,
  action,
}: {
  readonly children: ReactNode;
  readonly action?: ReactNode;
}) {
  return (
    <View accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>
      <Text style={styles.errorText}>{children}</Text>
      {action}
    </View>
  );
}

export function LoadingState({ label = 'Loading…' }: { readonly label?: string }) {
  return (
    <View accessibilityLabel={label} accessibilityLiveRegion="polite" style={styles.loading}>
      <ActivityIndicator color={color.action.primary.default} size="large" />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function StatusPill({ value }: { readonly value: string }) {
  const label = statusLabel(value);
  const tone = statusTone(value);
  const appearance = color.statusAppearance[tone];

  return (
    <View
      accessibilityLabel={`Status: ${label}`}
      style={[styles.pill, { backgroundColor: appearance.surface, borderColor: appearance.border }]}
    >
      <View
        style={[
          styles.pillDot,
          { backgroundColor: appearance.indicator, borderColor: appearance.text },
        ]}
        testID={`status-${tone}-indicator`}
      />
      <Text style={[styles.pillText, { color: appearance.text }]}>{label}</Text>
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  label: {
    color: color.text.primary,
    fontFamily: typography.fontFamily.native,
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: color.background.surface,
    borderColor: color.border.interactive,
    borderRadius: radii.sm,
    borderWidth: 1,
    color: color.text.primary,
    fontFamily: typography.fontFamily.native,
    fontSize: typography.size.body,
    minHeight: control.fieldMinHeight,
    paddingHorizontal: spacing.md,
  },
  field: { marginBottom: spacing.md },
  fieldError: {
    color: color.statusAppearance.danger.text,
    fontFamily: typography.fontFamily.native,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.xs,
  },
  paragraph: {
    color: color.text.primary,
    fontFamily: typography.fontFamily.native,
    fontSize: typography.size.body,
    lineHeight: Math.round(typography.size.body * typography.lineHeight.body),
  },
  muted: {
    color: color.text.muted,
    fontFamily: typography.fontFamily.native,
    fontSize: typography.size.body,
    lineHeight: Math.round(typography.size.body * typography.lineHeight.body),
  },
  sectionTitle: {
    color: color.text.primary,
    fontFamily: typography.fontFamily.native,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    lineHeight: Math.round(typography.size.lg * typography.lineHeight.tight),
    marginBottom: spacing.sm,
  },
});

const styles = StyleSheet.create({
  safe: { backgroundColor: color.background.canvas, flex: 1 },
  scroll: { flexGrow: 1 },
  content: { flex: 1, gap: spacing.md, padding: spacing.lg },
  heading: { gap: spacing.xs, marginBottom: spacing.md },
  eyebrow: {
    color: color.action.primary.default,
    fontFamily: typography.fontFamily.native,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.extraBold,
    letterSpacing: 1.4,
  },
  title: {
    color: color.text.primary,
    fontFamily: typography.fontFamily.native,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    lineHeight: Math.round(typography.size.xl * typography.lineHeight.tight),
  },
  description: {
    color: color.text.muted,
    fontFamily: typography.fontFamily.native,
    fontSize: typography.size.body,
    lineHeight: Math.round(typography.size.body * typography.lineHeight.body),
  },
  card: {
    backgroundColor: color.background.surface,
    borderColor: color.border.subtle,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  button: {
    alignItems: 'center',
    borderRadius: radii.sm,
    borderWidth: 2,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  buttonStandard: {
    minHeight: control.touchTargetMin,
    paddingVertical: spacing.sm,
  },
  buttonScoring: {
    minHeight: control.scoringTargetMin,
    paddingVertical: spacing.md,
  },
  buttonPrimary: {
    backgroundColor: color.action.primary.default,
    borderColor: color.action.primary.default,
  },
  buttonPrimaryPressed: {
    backgroundColor: color.action.primary.pressed,
    borderColor: color.action.primary.pressed,
  },
  buttonSecondary: {
    backgroundColor: color.action.secondary.default,
    borderColor: color.action.secondary.border,
  },
  buttonSecondaryPressed: {
    backgroundColor: color.action.secondary.pressed,
    borderColor: color.action.secondary.border,
  },
  buttonDestructive: {
    backgroundColor: color.action.destructive.default,
    borderColor: color.action.destructive.default,
  },
  buttonDestructivePressed: {
    backgroundColor: color.action.destructive.pressed,
    borderColor: color.action.destructive.pressed,
  },
  buttonDisabled: {
    backgroundColor: color.action.disabled.surface,
    borderColor: color.action.disabled.border,
  },
  buttonText: {
    fontFamily: typography.fontFamily.native,
    fontSize: typography.size.body,
    fontWeight: typography.weight.extraBold,
  },
  buttonScoringText: { fontSize: typography.size.lg },
  buttonPrimaryText: { color: color.action.primary.foreground },
  buttonSecondaryText: { color: color.action.secondary.foreground },
  buttonDestructiveText: { color: color.action.destructive.foreground },
  buttonDisabledText: { color: color.action.disabled.text },
  error: {
    backgroundColor: color.statusAppearance.danger.surface,
    borderColor: color.statusAppearance.danger.border,
    borderLeftColor: color.statusAppearance.danger.indicator,
    borderLeftWidth: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  errorText: {
    color: color.statusAppearance.danger.text,
    fontFamily: typography.fontFamily.native,
    fontSize: typography.size.body,
    fontWeight: typography.weight.semibold,
  },
  loading: {
    alignItems: 'center',
    backgroundColor: color.background.canvas,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    minHeight: 240,
  },
  muted: {
    color: color.text.muted,
    fontFamily: typography.fontFamily.native,
    fontSize: typography.size.body,
  },
  pill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pillDot: { borderRadius: radii.pill, borderWidth: 1, height: 8, width: 8 },
  pillText: {
    fontFamily: typography.fontFamily.native,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.extraBold,
    textTransform: 'capitalize',
  },
});
