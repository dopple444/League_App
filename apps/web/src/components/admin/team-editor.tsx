'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';

import {
  ApiError,
  browserApi,
  type FieldErrors,
  type TeamAdmin,
  getApiErrorMessage,
} from '../../lib/api-client';
import { FieldError, FormErrorSummary, invalidProps } from '../form-feedback';
import { StatusBadge } from '../site-shell';

export function TeamEditor({
  organizationId,
  seasonId,
  teamSeasonId,
}: {
  readonly organizationId: string;
  readonly seasonId: string;
  readonly teamSeasonId: string;
}) {
  const [team, setTeam] = useState<TeamAdmin | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void browserApi
      .getTeams(organizationId, seasonId)
      .then((items) => {
        if (!active) return;
        const match = items.find((item) => item.teamSeasonId === teamSeasonId);
        if (match) setTeam(match);
        else setRequestError('This team was not found in your organization and season.');
      })
      .catch(() => {
        if (active) setRequestError('We could not load this team.');
      });
    return () => {
      active = false;
    };
  }, [organizationId, seasonId, teamSeasonId]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!team) return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const publicName = String(data.get('publicName') ?? '').trim();
    const slug = String(data.get('slug') ?? '').trim();
    const nextErrors: Record<string, readonly string[]> = {};
    if (!name) nextErrors.name = ['Enter the internal team name.'];
    if (!publicName) nextErrors.publicName = ['Enter the approved public name.'];
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      nextErrors.slug = ['Use lowercase letters, numbers, and single hyphens.'];
    setErrors(nextErrors);
    setRequestError(null);
    setMessage(null);
    if (Object.keys(nextErrors).length) return;
    setBusy(true);
    try {
      setTeam(
        await browserApi.updateTeam(organizationId, seasonId, teamSeasonId, {
          expectedVersion: team.version,
          name,
          publicName,
          slug,
        }),
      );
      setMessage('Team changes saved. Publish again when the public version is ready.');
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      setRequestError(
        error instanceof ApiError && error.status === 409
          ? 'This team changed elsewhere. Reload before trying again.'
          : getApiErrorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  };
  const togglePublication = async () => {
    if (!team) return;
    setBusy(true);
    setMessage(null);
    setRequestError(null);
    try {
      const next = await browserApi.setTeamPublication(
        organizationId,
        seasonId,
        teamSeasonId,
        team.version,
        !team.published,
      );
      setTeam(next);
      setMessage(
        next.published
          ? 'Team published with its approved public name.'
          : 'Team withdrawn from public view. History was retained.',
      );
    } catch (error) {
      setRequestError(
        error instanceof ApiError && error.status === 409
          ? 'This team changed elsewhere. Reload before trying again.'
          : getApiErrorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  };
  if (requestError && !team)
    return (
      <div className="callout error" role="alert">
        {requestError}
      </div>
    );
  if (!team) return <p aria-live="polite">Loading team…</p>;
  return (
    <section className="form-card">
      <div className="page-heading">
        <div>
          <StatusBadge value={team.published ? 'published' : 'draft'} />
          <h2>{team.name}</h2>
          <p className="meta">Version {team.version}</p>
        </div>
        <button
          className={team.published ? 'danger' : 'secondary'}
          disabled={busy}
          onClick={togglePublication}
          type="button"
        >
          {team.published ? 'Withdraw public team' : 'Publish team'}
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
        <div className="field">
          <label htmlFor="name">Internal team name</label>
          <input
            defaultValue={team.name}
            id="name"
            key={`${team.version}-name`}
            name="name"
            {...invalidProps('name', errors)}
          />
          <FieldError errors={errors} field="name" />
        </div>
        <div className="field">
          <label htmlFor="publicName">Approved public team name</label>
          <input
            defaultValue={team.publicName}
            id="publicName"
            key={`${team.version}-public`}
            name="publicName"
            {...invalidProps('publicName', errors)}
          />
          <FieldError errors={errors} field="publicName" />
        </div>
        <div className="field">
          <label htmlFor="slug">Public URL name</label>
          <input
            defaultValue={team.slug}
            id="slug"
            key={`${team.version}-slug`}
            name="slug"
            {...invalidProps('slug', errors)}
          />
          <FieldError errors={errors} field="slug" />
        </div>
        <div className="action-row">
          <button disabled={busy} type="submit">
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          <Link href={`/admin/${organizationId}/seasons/${seasonId}`}>Back to season</Link>
        </div>
      </form>
    </section>
  );
}
