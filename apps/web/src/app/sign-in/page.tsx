import { SignInForm } from '../../components/auth/sign-in-form';
import { PageHeading } from '../../components/site-shell';

export default function SignInPage() {
  return (
    <main className="main-content" id="main-content">
      <div className="content-width narrow-content">
        <PageHeading
          eyebrow="Secure administration"
          title="Staff sign in"
          description="Manage only the organizations and league work assigned to your account."
        />
        <SignInForm />
      </div>
    </main>
  );
}
