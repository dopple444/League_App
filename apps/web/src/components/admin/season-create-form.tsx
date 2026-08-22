'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useState } from 'react';

import {
  ApiError,
  browserApi,
  type FieldErrors,
  type LeagueSummary,
  getApiErrorMessage,
} from '../../lib/api-client';
import { FieldError, FormErrorSummary, invalidProps } from '../form-feedback';

const validateSeason = (
  values: Record<string, string>,
  activeLeagueIds: ReadonlySet<string>,
): FieldErrors => {
  const errors: Record<string, readonly string[]> = {};
  if (!values.leagueId || !activeLeagueIds.has(values.leagueId)) {
    errors.leagueId = ['Choose an active league.'];
  }
  if (!values.name?.trim()) errors.name = ['Enter a season name.'];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug ?? ''))
    errors.slug = ['Use lowercase letters, numbers, and single hyphens.'];
  if (!values.startDate) errors.startDate = ['Choose a start date.'];
  if (!values.endDate) errors.endDate = ['Choose an end date.'];
  if (values.startDate && values.endDate && values.endDate < values.startDate)
    errors.endDate = ['End date must be on or after the start date.'];
  if (!values.timezone?.includes('/'))
    errors.timezone = ['Enter an IANA timezone such as America/New_York.'];
  return errors;
};

export function SeasonCreateForm({ organizationId }: { readonly organizationId: string }) {
  const router = useRouter();
  const [leagues, setLeagues] = useState<readonly LeagueSummary[] | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void browserApi
      .getOrganizations()
      .then((items) => {
        if (!active) return;
        const activeLeagues =
          items
            .find((item) => item.organizationId === organizationId)
            ?.leagues.filter((league) => league.active) ?? [];
        setLeagues(activeLeagues);
        setSelectedLeagueId((current) => {
          if (activeLeagues.length === 1) return activeLeagues[0]?.leagueId ?? '';
          return activeLeagues.some((league) => league.leagueId === current) ? current : '';
        });
      })
      .catch(() => {
        if (active) setRequestError('We could not load the leagues for this organization.');
      });
    return () => {
      active = false;
    };
  }, [organizationId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = Object.fromEntries(
      ['leagueId', 'name', 'slug', 'startDate', 'endDate', 'timezone'].map((key) => [
        key,
        String(data.get(key) ?? '').trim(),
      ]),
    );
    const activeLeagueIds = new Set(leagues?.map((league) => league.leagueId) ?? []);
    const nextErrors = validateSeason(values, activeLeagueIds);
    setErrors(nextErrors);
    setRequestError(null);
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      const season = await browserApi.createSeason(organizationId, {
        leagueId: values.leagueId ?? '',
        name: values.name ?? '',
        slug: values.slug ?? '',
        startDate: values.startDate ?? '',
        endDate: values.endDate ?? '',
        timezone: values.timezone ?? '',
      });
      router.replace(`/admin/${organizationId}/seasons/${season.seasonId}`);
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
      <div className="form-grid">
        <div className="field span-full">
          <label htmlFor="leagueId">League</label>
          <select
            disabled={!leagues?.length}
            id="leagueId"
            name="leagueId"
            onChange={(event) => setSelectedLeagueId(event.currentTarget.value)}
            value={selectedLeagueId}
            {...invalidProps('leagueId', errors)}
          >
            <option value="">Choose a league</option>
            {leagues?.map((league) => (
              <option key={league.leagueId} value={league.leagueId}>
                {league.name}
              </option>
            ))}
          </select>
          <FieldError errors={errors} field="leagueId" />
        </div>
        <div className="field">
          <label htmlFor="name">Season name</label>
          <input
            autoComplete="off"
            id="name"
            name="name"
            placeholder="2027 Season"
            {...invalidProps('name', errors)}
          />
          <FieldError errors={errors} field="name" />
        </div>
        <div className="field">
          <label htmlFor="slug">Public URL name</label>
          <input
            autoCapitalize="none"
            autoComplete="off"
            id="slug"
            name="slug"
            placeholder="2027-season"
            {...invalidProps('slug', errors)}
          />
          <FieldError errors={errors} field="slug" />
        </div>
        <div className="field">
          <label htmlFor="startDate">Start date</label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            {...invalidProps('startDate', errors)}
          />
          <FieldError errors={errors} field="startDate" />
        </div>
        <div className="field">
          <label htmlFor="endDate">End date</label>
          <input id="endDate" name="endDate" type="date" {...invalidProps('endDate', errors)} />
          <FieldError errors={errors} field="endDate" />
        </div>
        <div className="field span-full">
          <label htmlFor="timezone">League timezone</label>
          <input
            defaultValue="America/New_York"
            id="timezone"
            name="timezone"
            {...invalidProps('timezone', errors)}
          />
          <FieldError errors={errors} field="timezone" />
        </div>
      </div>
      {leagues !== null && leagues.length === 0 ? (
        <div className="callout" role="status">
          <strong>No active leagues are available.</strong>{' '}
          <Link href={`/admin/${organizationId}/leagues`}>Manage leagues</Link> to activate or add
          one before creating a season.
        </div>
      ) : null}
      <div className="callout" role="note">
        <strong>Private by default.</strong> Creating this season does not publish it.
      </div>
      <div className="action-row">
        <button disabled={submitting || !leagues?.length} type="submit">
          {submitting ? 'Creating…' : 'Create draft season'}
        </button>
        <button className="secondary" onClick={() => router.back()} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}
