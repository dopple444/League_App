import { TeamCreateForm } from '../../../../../../../components/admin/team-create-form';
import { PageHeading } from '../../../../../../../components/site-shell';

export default async function NewTeamPage({
  params,
}: {
  readonly params: Promise<{ readonly organizationId: string; readonly seasonId: string }>;
}) {
  const { organizationId, seasonId } = await params;
  return (
    <>
      <PageHeading
        eyebrow="New team"
        title="Create a team"
        description="Keep the internal name separate from the name approved for public display."
      />
      <TeamCreateForm organizationId={organizationId} seasonId={seasonId} />
    </>
  );
}
