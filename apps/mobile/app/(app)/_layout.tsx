import { color, typography } from '@league/ui-tokens';
import { Redirect, Tabs } from 'expo-router';

import { LoadingState } from '../../src/components/ui';
import { useLeagueSession } from '../../src/providers/session-provider';

export default function AppTabsLayout() {
  const { status } = useLeagueSession();
  if (status === 'loading') return <LoadingState label="Loading your league…" />;
  if (status === 'signed-out') return <Redirect href="/(auth)/sign-in" />;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: color.background.surface },
        headerTintColor: color.text.primary,
        headerTitleStyle: { fontFamily: typography.fontFamily.native },
        tabBarActiveTintColor: color.action.primary.default,
        tabBarInactiveTintColor: color.text.muted,
        tabBarLabelStyle: { fontFamily: typography.fontFamily.native },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'League', tabBarAccessibilityLabel: 'League overview tab' }}
      />
      <Tabs.Screen
        name="organizations"
        options={{ title: 'Organizations', tabBarAccessibilityLabel: 'Choose organization tab' }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarAccessibilityLabel: 'Account tab' }}
      />
    </Tabs>
  );
}
