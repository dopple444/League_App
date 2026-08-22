import { MfaEnrollmentForm } from '../../../components/auth/mfa-enrollment-form';
import { PageHeading } from '../../../components/site-shell';

export default function EnrollMfaPage() {
  return (
    <main className="main-content" id="main-content">
      <div className="content-width narrow-content">
        <PageHeading
          eyebrow="Account security"
          title="Protect administrative access"
          description="Connect an authenticator before making privileged controlled-beta changes."
        />
        <MfaEnrollmentForm />
      </div>
    </main>
  );
}
