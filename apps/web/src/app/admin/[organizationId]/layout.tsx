import type { ReactNode } from 'react';

import { AdminShell } from '../../../components/admin/admin-shell';

export default async function OrganizationAdminLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ readonly organizationId: string }>;
}) {
  const { organizationId } = await params;
  return (
    <main className="main-content" id="main-content">
      <div className="content-width">
        <AdminShell organizationId={organizationId}>{children}</AdminShell>
      </div>
    </main>
  );
}
