import { InvitationAcceptance } from '../../../components/auth/invitation-acceptance';
import { PageHeading } from '../../../components/site-shell';

export default function AcceptInvitationPage() {
  return (
    <main className="main-content" id="main-content">
      <div className="content-width narrow-content">
        <PageHeading
          description="Use the issued invitation to create or connect your administrator account. Access remains pending until MFA is complete."
          eyebrow="Controlled-beta access"
          title="Administrator invitation"
        />
        <InvitationAcceptance />
      </div>
    </main>
  );
}
