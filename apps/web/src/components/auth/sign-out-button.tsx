'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { browserApi } from '../../lib/api-client';

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await browserApi.signOut();
        } finally {
          router.replace('/sign-in');
          router.refresh();
        }
      }}
      type="button"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
