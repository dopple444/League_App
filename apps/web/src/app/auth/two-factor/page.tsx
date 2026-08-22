import { MfaChallengeForm } from '../../../components/auth/mfa-challenge-form';
import { PageHeading } from '../../../components/site-shell';

export default function TwoFactorPage() {
  return (
    <main className="main-content" id="main-content">
      <div className="content-width narrow-content">
        <PageHeading
          eyebrow="Secure sign-in"
          title="Verify it’s you"
          description="Complete the second step with your authenticator or a saved recovery code."
        />
        <MfaChallengeForm />
      </div>
    </main>
  );
}
