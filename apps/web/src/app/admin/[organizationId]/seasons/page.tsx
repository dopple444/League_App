import Link from 'next/link';

import { SeasonList } from '../../../../components/admin/season-list';
import { PageHeading } from '../../../../components/site-shell';

export default async function SeasonsPage({
  params,
}: {
  readonly params: Promise<{ readonly organizationId: string }>;
}) {
  const { organizationId } = await params;
  return (
    <>
      <PageHeading
        eyebrow="Configuration"
        title="Seasons"
        description="Draft changes remain private until you publish an approved version."
        actions={
          <Link className="button" href={`/admin/${organizationId}/seasons/new`}>
            Create season
          </Link>
        }
      />
      <SeasonList organizationId={organizationId} />
    </>
  );
}
