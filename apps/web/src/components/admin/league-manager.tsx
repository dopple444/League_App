'use client';

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import {
  ApiError,
  browserApi,
  createIdempotencyKey,
  type FieldErrors,
  type LeagueAdmin,
  getApiErrorMessage,
} from '../../lib/api-client';
import { FieldError, FormErrorSummary, invalidProps } from '../form-feedback';
import { EmptyState, PageHeading, StatusBadge } from '../site-shell';
import styles from './league-manager.module.css';

type LeagueTask =
  | { readonly kind: 'league-create' }
  | { readonly kind: 'league-edit'; readonly league: LeagueAdmin };

interface LeagueFormValues {
  readonly name: string;
  readonly slug: string;
  readonly active: boolean;
}

type PendingAction = 'submit' | 'load-latest';

interface MutationAttempt {
  readonly fingerprint: string;
  readonly idempotencyKey: string;
}

const sortLeagues = (leagues: readonly LeagueAdmin[]): LeagueAdmin[] =>
  [...leagues].sort((left, right) => left.name.localeCompare(right.name));

const taskKey = (task: LeagueTask): string =>
  task.kind === 'league-create'
    ? task.kind
    : `${task.kind}-${task.league.leagueId}-${task.league.version}`;

const initialValues = (task: LeagueTask): LeagueFormValues => ({
  name: task.kind === 'league-edit' ? task.league.name : '',
  slug: task.kind === 'league-edit' ? task.league.slug : '',
  active: task.kind === 'league-edit' ? task.league.active : true,
});

const validateValues = (values: LeagueFormValues): FieldErrors => {
  const errors: Record<string, readonly string[]> = {};
  const name = values.name.trim();
  const slug = values.slug.trim();

  if (!name) errors.name = ['Enter a league name.'];
  else if (name.length > 160) errors.name = ['Use 160 characters or fewer.'];

  if (!slug) errors.slug = ['Enter a public URL name.'];
  else if (slug.length < 2 || slug.length > 80) errors.slug = ['Use from 2 through 80 characters.'];
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    errors.slug = [
      'Use lowercase letters, numbers, and single hyphens; begin and end with a letter or number.',
    ];

  return errors;
};

const loadErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError && [401, 403].includes(error.status))
    return 'You do not have permission to view leagues for this organization.';
  if (error instanceof ApiError && error.status === 404)
    return 'This organization is unavailable or you no longer have access.';
  return 'We could not load leagues. Check your connection and try again.';
};

const mutationErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError && [401, 403].includes(error.status))
    return 'You do not have permission to make this change.';
  if (error instanceof ApiError && error.status === 404)
    return 'This league is no longer available in your organization. Your entries were retained.';
  if (error instanceof ApiError && error.code === 'PUBLISHED_LEAGUE_SLUG_LOCKED')
    return 'This public URL name is locked because the league has published content. Keep the current URL name, or withdraw its published content before renaming it.';
  if (error instanceof ApiError && error.code === 'INACTIVE_LEAGUE')
    return 'This action requires an active league. Mark the league Active and try again.';
  if (error instanceof ApiError && error.status === 409 && error.code === 'VERSION_CONFLICT')
    return 'This league changed elsewhere. Load the latest values before you try to save again.';
  if (
    error instanceof ApiError &&
    error.status === 409 &&
    ['DUPLICATE_LEAGUE', 'DUPLICATE_LEAGUE_NAME', 'DUPLICATE_LEAGUE_SLUG'].includes(error.code)
  )
    return 'That public URL name is already used by another league in this organization. Choose a different one.';
  return getApiErrorMessage(error);
};

const latestValuesErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError && [401, 403].includes(error.status))
    return 'You do not have permission to load the latest league values. Your entries were retained.';
  if (error instanceof ApiError && error.status === 404)
    return 'This league is no longer available in your organization. Your entries were retained.';
  return 'We could not load the latest league values. Your entries were retained. Check your connection and try again.';
};

function LeagueTaskPanel({
  organizationId,
  task,
  onCancel,
  onLatestLoaded,
  onSaved,
  onSubmittingChange,
}: {
  readonly organizationId: string;
  readonly task: LeagueTask;
  readonly onCancel: () => void;
  readonly onLatestLoaded: (league: LeagueAdmin) => void;
  readonly onSaved: (league: LeagueAdmin) => void;
  readonly onSubmittingChange: (submitting: boolean) => void;
}) {
  const [values, setValues] = useState<LeagueFormValues>(() => initialValues(task));
  const [expectedVersion, setExpectedVersion] = useState<number | null>(() =>
    task.kind === 'league-edit' ? task.league.version : null,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [versionConflict, setVersionConflict] = useState(false);
  const [latestAnnouncement, setLatestAnnouncement] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const panelRef = useRef<HTMLElement>(null);
  const pendingRef = useRef(false);
  const mutationAttemptRef = useRef<MutationAttempt | null>(null);
  const isCreate = task.kind === 'league-create';
  const title = isCreate ? 'Add league' : `Edit ${task.league.name}`;
  const pending = pendingAction !== null;

  useEffect(() => {
    if (!focusRequest) return;
    panelRef.current?.querySelector<HTMLElement>('[role="alert"][tabindex]')?.focus();
  }, [focusRequest]);

  useEffect(() => {
    if (attempted) setErrors(validateValues(values));
  }, [attempted, values]);

  const updateValue = <Key extends keyof LeagueFormValues>(
    key: Key,
    value: LeagueFormValues[Key],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));
    setLatestAnnouncement(null);
    if (!versionConflict) setRequestError(null);
  };

  const beginPending = (action: PendingAction): boolean => {
    if (pendingRef.current) return false;
    pendingRef.current = true;
    setPendingAction(action);
    onSubmittingChange(true);
    return true;
  };

  const finishPending = () => {
    pendingRef.current = false;
    setPendingAction(null);
    onSubmittingChange(false);
  };

  const idempotencyKeyFor = (payload: unknown): string => {
    const fingerprint = JSON.stringify(payload);
    if (mutationAttemptRef.current?.fingerprint === fingerprint)
      return mutationAttemptRef.current.idempotencyKey;
    const idempotencyKey = createIdempotencyKey();
    mutationAttemptRef.current = { fingerprint, idempotencyKey };
    return idempotencyKey;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pendingRef.current || versionConflict) return;

    const nextErrors = validateValues(values);
    setAttempted(true);
    setErrors(nextErrors);
    setRequestError(null);
    if (Object.keys(nextErrors).length) {
      setFocusRequest((value) => value + 1);
      return;
    }

    if (!beginPending('submit')) return;
    try {
      const input = {
        name: values.name.trim(),
        slug: values.slug.trim(),
        active: values.active,
      };
      const updateInput =
        task.kind === 'league-edit'
          ? { ...input, expectedVersion: expectedVersion ?? task.league.version }
          : null;
      const idempotencyKey = idempotencyKeyFor({
        operation: isCreate ? 'league.create' : 'league.update',
        organizationId,
        leagueId: task.kind === 'league-edit' ? task.league.leagueId : null,
        input: updateInput ?? input,
      });
      const saved =
        task.kind === 'league-create'
          ? await browserApi.createLeague(organizationId, input, idempotencyKey)
          : await browserApi.updateLeague(
              organizationId,
              task.league.leagueId,
              updateInput ?? { ...input, expectedVersion: task.league.version },
              idempotencyKey,
            );
      onSaved(saved);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      setVersionConflict(error instanceof ApiError && error.code === 'VERSION_CONFLICT');
      setRequestError(mutationErrorMessage(error));
      if (error instanceof ApiError && error.fieldErrors) setFocusRequest((value) => value + 1);
    } finally {
      finishPending();
    }
  };

  const loadLatestValues = async () => {
    if (task.kind !== 'league-edit' || !beginPending('load-latest')) return;
    setLatestAnnouncement(null);
    try {
      const latest = (await browserApi.getLeagues(organizationId)).find(
        (league) => league.leagueId === task.league.leagueId,
      );
      if (!latest) {
        setRequestError(
          'This league is no longer available in your organization. Your entries were retained.',
        );
        return;
      }
      setValues({ name: latest.name, slug: latest.slug, active: latest.active });
      setExpectedVersion(latest.version);
      setErrors({});
      setAttempted(false);
      setRequestError(null);
      setVersionConflict(false);
      setLatestAnnouncement(
        'Latest values loaded. Review the replacement values before saving your change.',
      );
      onLatestLoaded(latest);
    } catch (error) {
      setRequestError(latestValuesErrorMessage(error));
    } finally {
      finishPending();
    }
  };

  return (
    <section
      aria-labelledby="league-task-title"
      className={`form-card ${styles.taskPanel}`}
      ref={panelRef}
    >
      <div className={styles.taskHeading}>
        <div>
          <p className="eyebrow">{isCreate ? 'Create league' : 'Update league'}</p>
          <h2 id="league-task-title">{title}</h2>
        </div>
        <button className="secondary" disabled={pending} onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
      <form className="stack" noValidate onSubmit={submit}>
        <FormErrorSummary errors={errors} />
        {requestError ? (
          <div className={`callout error ${styles.requestError}`} role="alert">
            <p>{requestError}</p>
            {versionConflict && task.kind === 'league-edit' ? (
              <button
                className="secondary"
                disabled={pending}
                onClick={() => void loadLatestValues()}
                type="button"
              >
                {pendingAction === 'load-latest' ? 'Loading latest…' : 'Load latest values'}
              </button>
            ) : null}
          </div>
        ) : null}
        {latestAnnouncement ? (
          <div className="callout" role="status">
            {latestAnnouncement}
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="name">League name (required)</label>
          <input
            autoComplete="organization"
            autoFocus
            id="name"
            maxLength={160}
            name="name"
            onChange={(event) => updateValue('name', event.currentTarget.value)}
            required
            value={values.name}
            {...invalidProps('name', errors)}
          />
          <FieldError errors={errors} field="name" />
        </div>
        <div className="field">
          <label htmlFor="slug">Public URL name (required)</label>
          <p className={styles.helper} id="slug-help">
            Use lowercase letters, numbers, and single hyphens, such as church-softball. A public
            URL name is locked after league content is published.
          </p>
          <input
            aria-describedby={errors.slug?.length ? 'slug-help slug-error' : 'slug-help'}
            aria-invalid={errors.slug?.length ? true : undefined}
            autoCapitalize="none"
            autoComplete="off"
            id="slug"
            maxLength={80}
            name="slug"
            onChange={(event) => updateValue('slug', event.currentTarget.value)}
            required
            spellCheck={false}
            value={values.slug}
          />
          <FieldError errors={errors} field="slug" />
        </div>
        <div className={styles.checkField}>
          <input
            aria-describedby="active-help"
            checked={values.active}
            id="active"
            name="active"
            onChange={(event) => updateValue('active', event.currentTarget.checked)}
            type="checkbox"
          />
          <div>
            <label htmlFor="active">Active</label>
            <p className={styles.helper} id="active-help">
              Inactive leagues remain in history and should not receive new seasons.
            </p>
          </div>
        </div>
        <div className="action-row">
          <button disabled={pending || versionConflict} type="submit">
            {pendingAction === 'submit'
              ? isCreate
                ? 'Adding…'
                : 'Saving…'
              : isCreate
                ? 'Add league'
                : 'Save changes'}
          </button>
          <button className="secondary" disabled={pending} onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

export function LeagueManager({ organizationId }: { readonly organizationId: string }) {
  const [leagues, setLeagues] = useState<readonly LeagueAdmin[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [task, setTask] = useState<LeagueTask | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [pendingFocusLeagueId, setPendingFocusLeagueId] = useState<string | null>(null);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const leagueRefs = useRef(new Map<string, HTMLElement>());
  const taskTriggerRef = useRef<HTMLElement | null>(null);
  const taskActiveRef = useRef(false);
  const taskSubmittingRef = useRef(false);
  const loadRequestRef = useRef(0);

  const loadLeagues = useCallback(async () => {
    const requestNumber = loadRequestRef.current + 1;
    loadRequestRef.current = requestNumber;
    setLoadError(null);
    setLeagues(null);
    try {
      const result = await browserApi.getLeagues(organizationId);
      if (loadRequestRef.current === requestNumber) setLeagues(sortLeagues(result));
    } catch (error) {
      if (loadRequestRef.current === requestNumber) setLoadError(loadErrorMessage(error));
    }
  }, [organizationId]);

  useEffect(() => {
    void loadLeagues();
    return () => {
      loadRequestRef.current += 1;
    };
  }, [loadLeagues]);

  useEffect(() => {
    if (!pendingFocusLeagueId) return;
    const league = leagueRefs.current.get(pendingFocusLeagueId);
    if (!league) return;
    league.focus();
    setPendingFocusLeagueId(null);
  }, [pendingFocusLeagueId, leagues]);

  const beginTask = (nextTask: LeagueTask, trigger: HTMLElement) => {
    if (taskActiveRef.current || taskSubmittingRef.current) return;
    taskActiveRef.current = true;
    taskTriggerRef.current = trigger;
    setAnnouncement(null);
    setTask(nextTask);
  };

  const cancelTask = () => {
    if (taskSubmittingRef.current) return;
    const trigger = taskTriggerRef.current;
    taskActiveRef.current = false;
    setTask(null);
    queueMicrotask(() => trigger?.focus());
  };

  const changeTaskSubmitting = (submitting: boolean) => {
    taskSubmittingRef.current = submitting;
    setTaskSubmitting(submitting);
  };

  const replaceLoadedLeague = (loaded: LeagueAdmin) => {
    setLeagues((current) =>
      current
        ? sortLeagues(
            current.map((league) => (league.leagueId === loaded.leagueId ? loaded : league)),
          )
        : [loaded],
    );
  };

  const saveLeague = (saved: LeagueAdmin) => {
    changeTaskSubmitting(false);
    taskActiveRef.current = false;
    setLeagues((current) => {
      if (!current) return [saved];
      const exists = current.some((league) => league.leagueId === saved.leagueId);
      return sortLeagues(
        exists
          ? current.map((league) => (league.leagueId === saved.leagueId ? saved : league))
          : [...current, saved],
      );
    });
    setAnnouncement(
      task?.kind === 'league-create' ? `${saved.name} was added.` : `${saved.name} was updated.`,
    );
    setPendingFocusLeagueId(saved.leagueId);
    setTask(null);
  };

  const taskLocked = task !== null || taskSubmitting;

  return (
    <div className={styles.manager}>
      <PageHeading
        actions={
          <button
            disabled={taskLocked}
            onClick={(event) => beginTask({ kind: 'league-create' }, event.currentTarget)}
            type="button"
          >
            Add League
          </button>
        }
        description="Maintain the sport and rules identities operated by this organization. Public URL names are used in published league links."
        eyebrow="Organization setup"
        title="Leagues"
      />

      {announcement ? (
        <div className="callout" role="status">
          {announcement}
        </div>
      ) : null}

      {task?.kind === 'league-create' ? (
        <LeagueTaskPanel
          key={taskKey(task)}
          onCancel={cancelTask}
          onLatestLoaded={replaceLoadedLeague}
          onSaved={saveLeague}
          onSubmittingChange={changeTaskSubmitting}
          organizationId={organizationId}
          task={task}
        />
      ) : null}

      {loadError ? (
        <section className="empty-state" role="alert">
          <h2>Leagues unavailable</h2>
          <p>{loadError}</p>
          <button onClick={() => void loadLeagues()} type="button">
            Try again
          </button>
        </section>
      ) : !leagues ? (
        <p aria-live="polite">Loading leagues…</p>
      ) : leagues.length === 0 ? (
        <EmptyState
          action={
            <button
              disabled={taskLocked}
              onClick={(event) => beginTask({ kind: 'league-create' }, event.currentTarget)}
              type="button"
            >
              Add your first league
            </button>
          }
          title="Add your first league"
        >
          <p>A league provides the sport and rules identity used by seasons and public pages.</p>
        </EmptyState>
      ) : (
        <section aria-label="League list">
          <ul className={styles.leagueList}>
            {leagues.map((league) => {
              const titleId = `league-${league.leagueId}-title`;
              const isEditing =
                task?.kind === 'league-edit' && task.league.leagueId === league.leagueId;
              return (
                <li key={league.leagueId}>
                  <article
                    aria-labelledby={titleId}
                    className={styles.leagueCard}
                    ref={(element) => {
                      if (element) leagueRefs.current.set(league.leagueId, element);
                      else leagueRefs.current.delete(league.leagueId);
                    }}
                    tabIndex={-1}
                  >
                    <div className={styles.leagueSummary}>
                      <div className={styles.leagueIdentity}>
                        <h2 id={titleId}>{league.name}</h2>
                        <p className={styles.slugLabel}>
                          <span>Public URL name</span>
                          <code>{league.slug}</code>
                        </p>
                      </div>
                      <StatusBadge value={league.active ? 'active' : 'inactive'} />
                    </div>
                    <div className={styles.leagueActions}>
                      <button
                        className="secondary"
                        disabled={taskLocked}
                        onClick={(event) =>
                          beginTask({ kind: 'league-edit', league }, event.currentTarget)
                        }
                        type="button"
                      >
                        Edit {league.name}
                      </button>
                    </div>
                    {isEditing && task ? (
                      <LeagueTaskPanel
                        key={taskKey(task)}
                        onCancel={cancelTask}
                        onLatestLoaded={replaceLoadedLeague}
                        onSaved={saveLeague}
                        onSubmittingChange={changeTaskSubmitting}
                        organizationId={organizationId}
                        task={task}
                      />
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
