import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import {
  ActionButton,
  Card,
  Heading,
  InlineError,
  Screen,
  uiStyles,
} from '../../src/components/ui';
import { useLeagueSession } from '../../src/providers/session-provider';

export default function OrganizationsScreen() {
  const router = useRouter();
  const { error, organizations, refreshOrganizations, selectOrganization, selectedOrganization } =
    useLeagueSession();
  return (
    <Screen>
      <Heading
        eyebrow="Your access"
        title="Choose an organization"
        description="Roles and permissions may differ in each organization."
      />
      {error ? (
        <InlineError
          action={
            <ActionButton
              label="Retry"
              onPress={() => {
                void refreshOrganizations();
              }}
              variant="secondary"
            />
          }
        >
          {error}
        </InlineError>
      ) : null}
      {!organizations.length && !error ? (
        <Card>
          <Text style={uiStyles.sectionTitle}>No organization access</Text>
          <Text style={uiStyles.muted}>Ask a league access administrator to add your account.</Text>
        </Card>
      ) : null}
      {organizations.map((organization) => (
        <Card key={organization.organizationId}>
          <Text accessibilityRole="header" style={uiStyles.sectionTitle}>
            {organization.name}
          </Text>
          <Text style={uiStyles.muted}>{organization.timezone}</Text>
          <Text style={uiStyles.muted}>
            {organization.leagues.map((league) => league.name).join(', ')}
          </Text>
          <View>
            <ActionButton
              label={
                selectedOrganization?.organizationId === organization.organizationId
                  ? 'Selected'
                  : 'Use this organization'
              }
              onPress={() => {
                void selectOrganization(organization.organizationId).then(() =>
                  router.replace('/(app)/home'),
                );
              }}
              variant={
                selectedOrganization?.organizationId === organization.organizationId
                  ? 'secondary'
                  : 'primary'
              }
            />
          </View>
        </Card>
      ))}
    </Screen>
  );
}
