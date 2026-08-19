import { OrganizationPicker } from '../../../components/admin/organization-picker';
import { PageHeading } from '../../../components/site-shell';

export default function OrganizationsPage() {
  return (
    <main className="main-content" id="main-content">
      <div className="content-width">
        <PageHeading
          eyebrow="Your access"
          title="Choose an organization"
          description="Your roles and permissions may differ in each organization."
        />
        <OrganizationPicker />
      </div>
    </main>
  );
}
