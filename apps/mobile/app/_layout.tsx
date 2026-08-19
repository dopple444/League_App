import { RobotoFlex_400Regular, useFonts } from '@expo-google-fonts/roboto-flex';
import { color, spacing, typography } from '@league/ui-tokens';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../src/components/ui';
import { SessionProvider } from '../src/providers/session-provider';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ RobotoFlex_400Regular });

  if (!fontsLoaded && !fontError) {
    return (
      <View
        accessibilityLabel="Loading League Companion"
        accessibilityLiveRegion="polite"
        accessibilityRole="progressbar"
        accessibilityValue={{ text: 'Loading application' }}
        style={rootStyles.fontGate}
      >
        <ActivityIndicator color={color.action.primary.default} size="large" />
        <Text style={rootStyles.fontGateText}>Loading League Companion…</Text>
      </View>
    );
  }

  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ contentStyle: rootStyles.stackContent, headerShown: false }} />
    </SessionProvider>
  );
}

export function ErrorBoundary({
  error,
  retry,
}: PropsWithChildren<{ readonly error: Error; readonly retry: () => void }>) {
  return (
    <View style={rootStyles.errorScreen}>
      <View accessibilityRole="alert">
        <Text style={rootStyles.errorTitle}>The app hit a problem.</Text>
        <Text style={rootStyles.errorBody}>
          No league records were changed. Close and reopen the screen, or try again.
        </Text>
      </View>
      <ActionButton label="Try again" onPress={retry} />
      {__DEV__ ? <Text style={rootStyles.errorReference}>{error.name}</Text> : null}
    </View>
  );
}

const rootStyles = StyleSheet.create({
  stackContent: { backgroundColor: color.background.canvas },
  fontGate: {
    alignItems: 'center',
    backgroundColor: color.background.canvas,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  // This message intentionally uses the platform font because it renders before Roboto Flex loads.
  fontGateText: {
    color: color.text.primary,
    fontSize: typography.size.body,
    lineHeight: Math.round(typography.size.body * typography.lineHeight.body),
  },
  errorScreen: {
    backgroundColor: color.background.canvas,
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  errorTitle: {
    color: color.text.primary,
    fontFamily: typography.fontFamily.native,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    lineHeight: Math.round(typography.size.xl * typography.lineHeight.tight),
    marginBottom: spacing.sm,
  },
  errorBody: {
    color: color.text.muted,
    fontFamily: typography.fontFamily.native,
    fontSize: typography.size.body,
    lineHeight: Math.round(typography.size.body * typography.lineHeight.body),
  },
  errorReference: {
    color: color.text.muted,
    fontFamily: typography.fontFamily.native,
    fontSize: typography.size.sm,
    marginTop: spacing.md,
  },
});
