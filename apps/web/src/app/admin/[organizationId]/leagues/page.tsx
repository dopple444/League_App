import { LeagueManager } from '../../../../components/admin/league-manager';
import { Breadcrumbs } from '../../../../components/breadcrumbs';

export default async function LeaguesPage({
  params,
}: {
  readonly params: Promise<{ readonly organizationId: string }>;
}) {
  const { organizationId } = await params;

  return (
    <>
      <Breadcrumbs
        items={[{ href: `/admin/${organizationId}`, label: 'Overview' }, { label: 'Leagues' }]}
      />
      <LeagueManager organizationId={organizationId} />
    </>
  );
}
