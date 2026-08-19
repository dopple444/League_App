import { AuditList } from '../../../../components/admin/audit-list';
import { PageHeading } from '../../../../components/site-shell';

export default async function AuditPage({
  params,
}: {
  readonly params: Promise<{ readonly organizationId: string }>;
}) {
  const { organizationId } = await params;
  return (
    <>
      <PageHeading
        eyebrow="Traceability"
        title="Audit history"
        description="Authoritative changes record who acted, what changed, when it happened, and the request source."
      />
      <AuditList organizationId={organizationId} />
    </>
  );
}
