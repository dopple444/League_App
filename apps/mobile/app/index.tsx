import { Redirect } from 'expo-router';

import { LoadingState } from '../src/components/ui';
import { useLeagueSession } from '../src/providers/session-provider';

export default function IndexRoute() {
  const { selectedOrganization, status } = useLeagueSession();
  if (status === 'loading') return <LoadingState label="Restoring your session…" />;
  if (status === 'signed-out') return <Redirect href="/(auth)/sign-in" />;
  return <Redirect href={selectedOrganization ? '/(app)/home' : '/(app)/organizations'} />;
}
