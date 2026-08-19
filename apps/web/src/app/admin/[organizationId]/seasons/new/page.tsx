import { SeasonCreateForm } from '../../../../../components/admin/season-create-form';
import { PageHeading } from '../../../../../components/site-shell';

export default async function NewSeasonPage({
  params,
}: {
  readonly params: Promise<{ readonly organizationId: string }>;
}) {
  const { organizationId } = await params;
  return (
    <>
      <PageHeading
        eyebrow="New configuration"
        title="Create a season"
        description="Set the dates and timezone for a private draft season."
      />
      <SeasonCreateForm organizationId={organizationId} />
    </>
  );
}
