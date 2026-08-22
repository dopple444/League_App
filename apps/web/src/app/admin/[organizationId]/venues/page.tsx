import { VenueFieldManager } from '../../../../components/admin/venue-field-manager';
import { Breadcrumbs } from '../../../../components/breadcrumbs';

export default async function VenuesPage({
  params,
}: {
  readonly params: Promise<{ readonly organizationId: string }>;
}) {
  const { organizationId } = await params;

  return (
    <>
      <Breadcrumbs
        items={[
          { href: `/admin/${organizationId}`, label: 'Overview' },
          { label: 'Venues & Fields' },
        ]}
      />
      <VenueFieldManager organizationId={organizationId} />
    </>
  );
}
