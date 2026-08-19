import * as SecureStore from 'expo-secure-store';
import type { PropsWithChildren } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { mobileApi, type OrganizationSummary } from '../lib/api-client';
import { authClient } from '../lib/auth-client';

const organizationStorageKey = 'league-companion.selected-organization';

interface SessionContextValue {
  readonly status: 'loading' | 'signed-in' | 'signed-out';
  readonly userLabel: string | null;
  readonly organizations: readonly OrganizationSummary[];
  readonly selectedOrganization: OrganizationSummary | null;
  readonly error: string | null;
  readonly signIn: (email: string, password: string) => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly selectOrganization: (organizationId: string) => Promise<void>;
  readonly refreshOrganizations: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const sessionQuery = authClient.useSession();
  const [organizations, setOrganizations] = useState<readonly OrganizationSummary[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);
  const [loadingOrganizations, setLoadingOrganizations] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshOrganizations = useCallback(async () => {
    setLoadingOrganizations(true);
    setError(null);
    try {
      const next = await mobileApi.getOrganizations();
      setOrganizations(next);
      const stored = await SecureStore.getItemAsync(organizationStorageKey);
      const allowedStored = next.some((item) => item.organizationId === stored) ? stored : null;
      setSelectedOrganizationId(
        allowedStored ?? (next.length === 1 ? (next[0]?.organizationId ?? null) : null),
      );
    } catch {
      setError('We could not load your organizations. Check your connection and try again.');
    } finally {
      setLoadingOrganizations(false);
    }
  }, []);

  useEffect(() => {
    if (sessionQuery.data?.session) void refreshOrganizations();
    if (!sessionQuery.isPending && !sessionQuery.data?.session) {
      setOrganizations([]);
      setSelectedOrganizationId(null);
    }
  }, [refreshOrganizations, sessionQuery.data?.session, sessionQuery.isPending]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setError(null);
      const result = await authClient.signIn.email({ email, password });
      if (result.error) throw new Error(result.error.message ?? 'Sign in failed.');
      await sessionQuery.refetch();
    },
    [sessionQuery],
  );

  const signOut = useCallback(async () => {
    try {
      await authClient.signOut();
    } finally {
      await SecureStore.deleteItemAsync(organizationStorageKey);
      setOrganizations([]);
      setSelectedOrganizationId(null);
      await sessionQuery.refetch();
    }
  }, [sessionQuery]);

  const selectOrganization = useCallback(
    async (organizationId: string) => {
      if (!organizations.some((item) => item.organizationId === organizationId)) {
        throw new Error('Organization access is not available.');
      }
      await SecureStore.setItemAsync(organizationStorageKey, organizationId);
      setSelectedOrganizationId(organizationId);
    },
    [organizations],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      status:
        sessionQuery.isPending || loadingOrganizations
          ? 'loading'
          : sessionQuery.data?.session
            ? 'signed-in'
            : 'signed-out',
      userLabel: sessionQuery.data?.user.name || sessionQuery.data?.user.email || null,
      organizations,
      selectedOrganization:
        organizations.find((item) => item.organizationId === selectedOrganizationId) ?? null,
      error,
      signIn,
      signOut,
      selectOrganization,
      refreshOrganizations,
    }),
    [
      error,
      loadingOrganizations,
      organizations,
      refreshOrganizations,
      selectOrganization,
      selectedOrganizationId,
      sessionQuery.data,
      sessionQuery.isPending,
      signIn,
      signOut,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useLeagueSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useLeagueSession must be used inside SessionProvider.');
  return value;
}
