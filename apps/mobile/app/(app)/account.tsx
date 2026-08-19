import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import {
  ActionButton,
  Card,
  Heading,
  InlineError,
  Screen,
  uiStyles,
} from '../../src/components/ui';
import { useLeagueSession } from '../../src/providers/session-provider';

export default function AccountScreen() {
  const router = useRouter();
  const { selectedOrganization, signOut, userLabel } = useLeagueSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitSignOut = async () => {
    setBusy(true);
    setError(null);
    try {
      await signOut();
      router.replace('/(auth)/sign-in');
    } catch {
      setError('We could not confirm sign out. Close the app before sharing this device.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen>
      <Heading
        eyebrow="Account"
        title={userLabel ?? 'League account'}
        description="Session and organization access are managed separately from league roles."
      />
      {error ? <InlineError>{error}</InlineError> : null}
      <Card>
        <Text style={uiStyles.sectionTitle}>Current organization</Text>
        <Text style={uiStyles.paragraph}>{selectedOrganization?.name ?? 'None selected'}</Text>
        <ActionButton
          label="Choose organization"
          onPress={() => router.push('/(app)/organizations')}
          variant="secondary"
        />
      </Card>
      <Card>
        <Text style={uiStyles.sectionTitle}>Privacy and account deletion</Text>
        <Text style={uiStyles.muted}>
          Account deletion requests will be available here before production. Required league
          records may follow documented retention rules.
        </Text>
      </Card>
      <ActionButton
        accessibilityHint="Clears the stored session and organization selection from this device"
        disabled={busy}
        label={busy ? 'Signing out…' : 'Sign out'}
        onPress={() => {
          void submitSignOut();
        }}
        variant="secondary"
      />
    </Screen>
  );
}
