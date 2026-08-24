import { OrganizationPicker } from '../../../components/admin/organization-picker';
import { PageHeading } from '../../../components/site-shell';

export default function OrganizationsPage() {
  return (
    <main className="main-content" id="main-content">
      <div className="content-width">
        <PageHeading
          eyebrow="Your access"
          title="Choose a workspace"
          description="Open an active customer organization or your separately authorized platform workspace."
        />
        <OrganizationPicker />
      </div>
    </main>
  );
}
