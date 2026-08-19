'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { ApiError, browserApi, type FieldErrors, getApiErrorMessage } from '../../lib/api-client';
import { FieldError, FormErrorSummary, invalidProps } from '../form-feedback';

const validate = (name: string, publicName: string, slug: string): FieldErrors => {
  const errors: Record<string, readonly string[]> = {};
  if (!name) errors.name = ['Enter the internal team name.'];
  if (!publicName) errors.publicName = ['Enter the name approved for public display.'];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    errors.slug = ['Use lowercase letters, numbers, and single hyphens.'];
  return errors;
};

export function TeamCreateForm({
  organizationId,
  seasonId,
}: {
  readonly organizationId: string;
  readonly seasonId: string;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const publicName = String(data.get('publicName') ?? '').trim();
    const slug = String(data.get('slug') ?? '').trim();
    const nextErrors = validate(name, publicName, slug);
    setErrors(nextErrors);
    setRequestError(null);
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      const team = await browserApi.createTeam(organizationId, seasonId, {
        name,
        publicName,
        slug,
      });
      router.replace(`/admin/${organizationId}/seasons/${seasonId}/teams/${team.teamSeasonId}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      setRequestError(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <form className="form-card stack" noValidate onSubmit={submit}>
      <FormErrorSummary errors={errors} />
      {requestError ? (
        <div className="callout error" role="alert">
          {requestError}
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="name">Internal team name</label>
        <input autoComplete="off" id="name" name="name" {...invalidProps('name', errors)} />
        <FieldError errors={errors} field="name" />
        <p className="meta">Visible only to authorized staff in this slice.</p>
      </div>
      <div className="field">
        <label htmlFor="publicName">Approved public team name</label>
        <input
          autoComplete="off"
          id="publicName"
          name="publicName"
          {...invalidProps('publicName', errors)}
        />
        <FieldError errors={errors} field="publicName" />
        <p className="meta">Do not include private contact details or participant information.</p>
      </div>
      <div className="field">
        <label htmlFor="slug">Public URL name</label>
        <input
          autoCapitalize="none"
          autoComplete="off"
          id="slug"
          name="slug"
          placeholder="grace-community"
          {...invalidProps('slug', errors)}
        />
        <FieldError errors={errors} field="slug" />
      </div>
      <div className="callout" role="note">
        <strong>Private by default.</strong> Review the public name before publishing the team.
      </div>
      <div className="action-row">
        <button disabled={submitting} type="submit">
          {submitting ? 'Creating…' : 'Create draft team'}
        </button>
        <button className="secondary" onClick={() => router.back()} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}
