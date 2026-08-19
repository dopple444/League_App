import Constants from 'expo-constants';

interface LeagueExtraConfig {
  readonly apiBaseUrl?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as LeagueExtraConfig;

export const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? extra.apiBaseUrl ?? 'http://localhost:8080';
