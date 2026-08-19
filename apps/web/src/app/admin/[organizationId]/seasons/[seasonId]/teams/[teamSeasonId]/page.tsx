import { TeamEditor } from '../../../../../../../components/admin/team-editor';
import { PageHeading } from '../../../../../../../components/site-shell';

export default async function TeamPage({
  params,
}: {
  readonly params: Promise<{
    readonly organizationId: string;
    readonly seasonId: string;
    readonly teamSeasonId: string;
  }>;
}) {
  const { organizationId, seasonId, teamSeasonId } = await params;
  return (
    <>
      <PageHeading
        eyebrow="Team workspace"
        title="Review and publish team"
        description="Only the approved public name is exposed on public routes."
      />
      <TeamEditor organizationId={organizationId} seasonId={seasonId} teamSeasonId={teamSeasonId} />
    </>
  );
}
