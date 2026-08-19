import { SeasonEditor } from '../../../../../components/admin/season-editor';
import { PageHeading } from '../../../../../components/site-shell';

export default async function SeasonPage({
  params,
}: {
  readonly params: Promise<{ readonly organizationId: string; readonly seasonId: string }>;
}) {
  const { organizationId, seasonId } = await params;
  return (
    <>
      <PageHeading
        eyebrow="Season workspace"
        title="Season and teams"
        description="Edits are version checked and publication is always an explicit action."
      />
      <SeasonEditor organizationId={organizationId} seasonId={seasonId} />
    </>
  );
}
