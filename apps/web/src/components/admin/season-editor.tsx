'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';

import {
  ApiError,
  browserApi,
  type FieldErrors,
  type SeasonAdmin,
  getApiErrorMessage,
} from '../../lib/api-client';
import { FieldError, FormErrorSummary, invalidProps } from '../form-feedback';
import { StatusBadge } from '../site-shell';
import { TeamList } from './team-list';

export function SeasonEditor({
  organizationId,
  seasonId,
}: {
  readonly organizationId: string;
  readonly seasonId: string;
}) {
  const [season, setSeason] = useState<SeasonAdmin | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void browserApi
      .getSeasons(organizationId)
      .then((items) => {
        if (!active) return;
        const match = items.find((item) => item.seasonId === seasonId);
        if (match) setSeason(match);
        else setRequestError('This season was not found in your organization.');
      })
      .catch(() => {
        if (active) setRequestError('We could not load this season.');
      });
    return () => {
      active = false;
    };
  }, [organizationId, seasonId]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!season) return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const startDate = String(data.get('startDate') ?? '');
    const endDate = String(data.get('endDate') ?? '');
    const timezone = String(data.get('timezone') ?? '').trim();
    const nextErrors: Record<string, readonly string[]> = {};
    if (!name) nextErrors.name = ['Enter a season name.'];
    if (!startDate) nextErrors.startDate = ['Choose a start date.'];
    if (!endDate || endDate < startDate)
      nextErrors.endDate = ['End date must be on or after the start date.'];
    if (!timezone.includes('/')) nextErrors.timezone = ['Enter a valid IANA timezone.'];
    setErrors(nextErrors);
    setMessage(null);
    setRequestError(null);
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    try {
      setSeason(
        await browserApi.updateSeason(organizationId, seasonId, {
          expectedVersion: season.version,
          name,
          startDate,
          endDate,
          timezone,
        }),
      );
      setMessage('Season changes saved. Publish again when the public version is ready.');
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      setRequestError(
        error instanceof ApiError && error.status === 409
          ? 'This season changed elsewhere. Reload before trying again.'
          : getApiErrorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  };

  const togglePublication = async () => {
    if (!season) return;
    setBusy(true);
    setMessage(null);
    setRequestError(null);
    try {
      const next = await browserApi.setSeasonPublication(
        organizationId,
        seasonId,
        season.version,
        !season.published,
      );
      setSeason(next);
      setMessage(
        next.published
          ? 'Season published. Approved public details are now visible.'
          : 'Season withdrawn from public view. History was retained.',
      );
    } catch (error) {
      setRequestError(
        error instanceof ApiError && error.status === 409
          ? 'This season changed elsewhere. Reload before trying again.'
          : getApiErrorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  };

  if (requestError && !season)
    return (
      <div className="callout error" role="alert">
        {requestError}
      </div>
    );
  if (!season) return <p aria-live="polite">Loading season…</p>;

  return (
    <div className="stack">
      <section className="form-card">
        <div className="page-heading">
          <div>
            <StatusBadge value={season.published ? 'published' : 'draft'} />
            <h2>{season.name}</h2>
            <p className="meta">
              Version {season.version} · URL: {season.slug}
            </p>
          </div>
          <button
            className={season.published ? 'danger' : 'secondary'}
            disabled={busy}
            onClick={togglePublication}
            type="button"
          >
            {season.published ? 'Withdraw public season' : 'Publish season'}
          </button>
        </div>
        {message ? (
          <div className="callout" aria-live="polite">
            {message}
          </div>
        ) : null}
        {requestError ? (
          <div className="callout error" role="alert">
            {requestError}
          </div>
        ) : null}
        <form className="stack" noValidate onSubmit={save}>
          <FormErrorSummary errors={errors} />
          <div className="form-grid">
            <div className="field span-full">
              <label htmlFor="name">Season name</label>
              <input
                defaultValue={season.name}
                id="name"
                key={`${season.version}-name`}
                name="name"
                {...invalidProps('name', errors)}
              />
              <FieldError errors={errors} field="name" />
            </div>
            <div className="field">
              <label htmlFor="startDate">Start date</label>
              <input
                defaultValue={season.startDate}
                id="startDate"
                key={`${season.version}-start`}
                name="startDate"
                type="date"
                {...invalidProps('startDate', errors)}
              />
              <FieldError errors={errors} field="startDate" />
            </div>
            <div className="field">
              <label htmlFor="endDate">End date</label>
              <input
                defaultValue={season.endDate}
                id="endDate"
                key={`${season.version}-end`}
                name="endDate"
                type="date"
                {...invalidProps('endDate', errors)}
              />
              <FieldError errors={errors} field="endDate" />
            </div>
            <div className="field span-full">
              <label htmlFor="timezone">League timezone</label>
              <input
                defaultValue={season.timezone}
                id="timezone"
                key={`${season.version}-timezone`}
                name="timezone"
                {...invalidProps('timezone', errors)}
              />
              <FieldError errors={errors} field="timezone" />
            </div>
          </div>
          <div className="action-row">
            <button disabled={busy} type="submit">
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>
      <section>
        <div className="page-heading">
          <div>
            <p className="eyebrow">Season teams</p>
            <h2>Teams</h2>
          </div>
          <Link className="button" href={`/admin/${organizationId}/seasons/${seasonId}/teams/new`}>
            Create team
          </Link>
        </div>
        <TeamList organizationId={organizationId} seasonId={seasonId} />
      </section>
    </div>
  );
}
