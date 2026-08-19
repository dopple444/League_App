import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import { apiBaseUrl } from './config';

export const authClient = createAuthClient({
  baseURL: apiBaseUrl,
  plugins: [
    expoClient({
      scheme: 'league-companion',
      storagePrefix: 'league-companion',
      storage: SecureStore,
    }),
  ],
});
