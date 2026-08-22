'use client';

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import {
  ApiError,
  browserApi,
  createIdempotencyKey,
  type FieldAdmin,
  type FieldErrors,
  type VenueAdmin,
  getApiErrorMessage,
} from '../../lib/api-client';
import { FieldError, FormErrorSummary, invalidProps } from '../form-feedback';
import { EmptyState, PageHeading, StatusBadge } from '../site-shell';
import styles from './venue-field-manager.module.css';

type VenueTask =
  | { readonly kind: 'venue-create' }
  | { readonly kind: 'venue-edit'; readonly venue: VenueAdmin }
  | { readonly kind: 'field-create'; readonly venue: VenueAdmin }
  | {
      readonly kind: 'field-edit';
      readonly venue: VenueAdmin;
      readonly field: FieldAdmin;
    };

type SavedFacility =
  | { readonly kind: 'venue'; readonly venue: VenueAdmin }
  | { readonly kind: 'field'; readonly field: FieldAdmin };

interface FacilityFormValues {
  readonly name: string;
  readonly publicDirections: string;
  readonly hasLights: boolean;
  readonly fenceDistanceFeet: string;
  readonly active: boolean;
}

interface MutationAttempt {
  readonly fingerprint: string;
  readonly idempotencyKey: string;
}

const sortFields = (fields: readonly FieldAdmin[]): FieldAdmin[] =>
  [...fields].sort((left, right) => left.name.localeCompare(right.name));

const sortVenues = (venues: readonly VenueAdmin[]): VenueAdmin[] =>
  [...venues]
    .map((venue) => ({ ...venue, fields: sortFields(venue.fields) }))
    .sort((left, right) => left.name.localeCompare(right.name));

const taskVenueId = (task: VenueTask): string | null =>
  task.kind === 'venue-create' ? null : task.venue.venueId;

const taskKey = (task: VenueTask): string => {
  if (task.kind === 'venue-create') return task.kind;
  if (task.kind === 'field-edit') return `${task.kind}-${task.field.fieldId}-${task.field.version}`;
  return `${task.kind}-${task.venue.venueId}-${task.venue.version}`;
};

const initialValues = (task: VenueTask): FacilityFormValues => {
  const venue = task.kind === 'venue-edit' ? task.venue : null;
  const field = task.kind === 'field-edit' ? task.field : null;
  return {
    name: field?.name ?? venue?.name ?? '',
    publicDirections: field?.publicDirections ?? '',
    hasLights: field?.hasLights ?? false,
    fenceDistanceFeet:
      field?.fenceDistanceFeet === null || field?.fenceDistanceFeet === undefined
        ? ''
        : String(field.fenceDistanceFeet),
    active: field?.active ?? venue?.active ?? true,
  };
};

const validateValues = (task: VenueTask, values: FacilityFormValues): FieldErrors => {
  const errors: Record<string, readonly string[]> = {};
  const name = values.name.trim();
  if (!name) errors.name = ['Enter a name.'];
  else if (name.length > 120) errors.name = ['Use 120 characters or fewer.'];

  if (task.kind === 'field-create' || task.kind === 'field-edit') {
    if (values.publicDirections.trim().length > 500)
      errors.publicDirections = ['Use 500 characters or fewer.'];
    const fenceDistance = values.fenceDistanceFeet.trim();
    if (fenceDistance && !/^\d+$/.test(fenceDistance)) {
      errors.fenceDistanceFeet = ['Enter a whole number of feet.'];
    } else if (fenceDistance) {
      const distance = Number(fenceDistance);
      if (distance < 100 || distance > 600)
        errors.fenceDistanceFeet = ['Enter a distance from 100 through 600 feet.'];
    }
  }

  return errors;
};

const loadErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError && [401, 403].includes(error.status))
    return 'You do not have permission to view venues and fields for this organization.';
  if (error instanceof ApiError && error.status === 404)
    return 'This organization is unavailable or you no longer have access.';
  return 'We could not load venues and fields. Check your connection and try again.';
};

const mutationErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError && [401, 403].includes(error.status))
    return 'You do not have permission to make this change.';
  if (error instanceof ApiError && error.status === 404)
    return 'This record is no longer available in your organization. Your entries were retained.';
  if (error instanceof ApiError && error.status === 409 && error.code === 'VERSION_CONFLICT')
    return 'This record changed elsewhere. Reload the page, review the latest version, and try again.';
  if (
    error instanceof ApiError &&
    error.status === 409 &&
    ['DUPLICATE_VENUE_NAME', 'DUPLICATE_FIELD_NAME'].includes(error.code)
  )
    return 'A record with this name already exists here. Choose a different name.';
  return getApiErrorMessage(error);
};

function FacilityTaskPanel({
  organizationId,
  task,
  onCancel,
  onSaved,
  onSubmittingChange,
}: {
  readonly organizationId: string;
  readonly task: VenueTask;
  readonly onCancel: () => void;
  readonly onSaved: (saved: SavedFacility) => void;
  readonly onSubmittingChange: (submitting: boolean) => void;
}) {
  const [values, setValues] = useState<FacilityFormValues>(() => initialValues(task));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const panelRef = useRef<HTMLElement>(null);
  const mutationAttemptRef = useRef<MutationAttempt | null>(null);

  const isField = task.kind === 'field-create' || task.kind === 'field-edit';
  const isCreate = task.kind === 'venue-create' || task.kind === 'field-create';
  const title =
    task.kind === 'venue-create'
      ? 'Add venue'
      : task.kind === 'venue-edit'
        ? `Edit ${task.venue.name}`
        : task.kind === 'field-create'
          ? `Add field at ${task.venue.name}`
          : `Edit ${task.field.name}`;

  useEffect(() => {
    if (!focusRequest) return;
    panelRef.current?.querySelector<HTMLElement>('[role="alert"][tabindex]')?.focus();
  }, [focusRequest]);

  const updateValue = <Key extends keyof FacilityFormValues>(
    key: Key,
    value: FacilityFormValues[Key],
  ) => {
    const next = { ...values, [key]: value };
    setValues(next);
    setRequestError(null);
    if (attempted) setErrors(validateValues(task, next));
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
    if (submitting) return;

    const nextErrors = validateValues(task, values);
    setAttempted(true);
    setErrors(nextErrors);
    setRequestError(null);
    if (Object.keys(nextErrors).length) {
      setFocusRequest((value) => value + 1);
      return;
    }

    setSubmitting(true);
    onSubmittingChange(true);
    try {
      if (task.kind === 'venue-create') {
        const input = {
          name: values.name.trim(),
          active: values.active,
        };
        const idempotencyKey = idempotencyKeyFor({
          operation: 'venue.create',
          organizationId,
          input,
        });
        const venue = await browserApi.createVenue(organizationId, input, idempotencyKey);
        onSaved({ kind: 'venue', venue });
      } else if (task.kind === 'venue-edit') {
        const input = {
          expectedVersion: task.venue.version,
          name: values.name.trim(),
          active: values.active,
        };
        const idempotencyKey = idempotencyKeyFor({
          operation: 'venue.update',
          organizationId,
          venueId: task.venue.venueId,
          input,
        });
        const venue = await browserApi.updateVenue(
          organizationId,
          task.venue.venueId,
          input,
          idempotencyKey,
        );
        onSaved({ kind: 'venue', venue });
      } else {
        const input = {
          name: values.name.trim(),
          publicDirections: values.publicDirections.trim() || null,
          hasLights: values.hasLights,
          fenceDistanceFeet: values.fenceDistanceFeet.trim()
            ? Number(values.fenceDistanceFeet)
            : null,
          active: values.active,
        };
        if (task.kind === 'field-create') {
          const idempotencyKey = idempotencyKeyFor({
            operation: 'field.create',
            organizationId,
            venueId: task.venue.venueId,
            input,
          });
          const field = await browserApi.createField(
            organizationId,
            task.venue.venueId,
            input,
            idempotencyKey,
          );
          onSaved({ kind: 'field', field });
        } else {
          const updateInput = { ...input, expectedVersion: task.field.version };
          const idempotencyKey = idempotencyKeyFor({
            operation: 'field.update',
            organizationId,
            venueId: task.venue.venueId,
            fieldId: task.field.fieldId,
            input: updateInput,
          });
          const field = await browserApi.updateField(
            organizationId,
            task.venue.venueId,
            task.field.fieldId,
            updateInput,
            idempotencyKey,
          );
          onSaved({ kind: 'field', field });
        }
      }
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      setRequestError(mutationErrorMessage(error));
      if (error instanceof ApiError && error.fieldErrors) setFocusRequest((value) => value + 1);
    } finally {
      setSubmitting(false);
      onSubmittingChange(false);
    }
  };

  return (
    <section
      aria-labelledby="facility-task-title"
      className={`form-card ${styles.taskPanel}`}
      ref={panelRef}
    >
      <div className={styles.taskHeading}>
        <div>
          <p className="eyebrow">{isCreate ? 'Create facility' : 'Update facility'}</p>
          <h2 id="facility-task-title">{title}</h2>
        </div>
        <button className="secondary" disabled={submitting} onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
      <form className="stack" noValidate onSubmit={submit}>
        <FormErrorSummary errors={errors} />
        {requestError ? (
          <div className="callout error" role="alert">
            {requestError}
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="name">{isField ? 'Field name' : 'Venue name'} (required)</label>
          <input
            autoComplete="off"
            id="name"
            maxLength={121}
            name="name"
            onChange={(event) => updateValue('name', event.currentTarget.value)}
            required
            value={values.name}
            {...invalidProps('name', errors)}
          />
          <FieldError errors={errors} field="name" />
        </div>

        {isField ? (
          <>
            <div className="field">
              <label htmlFor="publicDirections">Public directions (optional)</label>
              <p className={styles.helper} id="publicDirections-help">
                Plain text only. This may be shared publicly in a future approved schedule.
              </p>
              <textarea
                aria-describedby={
                  errors.publicDirections?.length
                    ? 'publicDirections-help publicDirections-error'
                    : 'publicDirections-help'
                }
                aria-invalid={errors.publicDirections?.length ? true : undefined}
                id="publicDirections"
                maxLength={501}
                name="publicDirections"
                onChange={(event) => updateValue('publicDirections', event.currentTarget.value)}
                rows={3}
                value={values.publicDirections}
              />
              <FieldError errors={errors} field="publicDirections" />
            </div>
            <div className="field">
              <label htmlFor="fenceDistanceFeet">Fence distance in feet (optional)</label>
              <p className={styles.helper} id="fenceDistanceFeet-help">
                Enter a whole number from 100 through 600.
              </p>
              <input
                aria-describedby={
                  errors.fenceDistanceFeet?.length
                    ? 'fenceDistanceFeet-help fenceDistanceFeet-error'
                    : 'fenceDistanceFeet-help'
                }
                aria-invalid={errors.fenceDistanceFeet?.length ? true : undefined}
                id="fenceDistanceFeet"
                inputMode="numeric"
                max={600}
                min={100}
                name="fenceDistanceFeet"
                onChange={(event) => updateValue('fenceDistanceFeet', event.currentTarget.value)}
                step={1}
                type="number"
                value={values.fenceDistanceFeet}
              />
              <FieldError errors={errors} field="fenceDistanceFeet" />
            </div>
            <div className={styles.checkField}>
              <input
                checked={values.hasLights}
                id="hasLights"
                name="hasLights"
                onChange={(event) => updateValue('hasLights', event.currentTarget.checked)}
                type="checkbox"
              />
              <div>
                <label htmlFor="hasLights">Lights available</label>
                <p className={styles.helper}>
                  Mark this when games can use installed field lights.
                </p>
              </div>
            </div>
          </>
        ) : null}

        <div className={styles.checkField}>
          <input
            checked={values.active}
            id="active"
            name="active"
            onChange={(event) => updateValue('active', event.currentTarget.checked)}
            type="checkbox"
          />
          <div>
            <label htmlFor="active">Active</label>
            <p className={styles.helper}>
              Inactive facilities remain in history and should not be used for future schedules.
            </p>
          </div>
        </div>
        <div className="action-row">
          <button disabled={submitting} type="submit">
            {submitting
              ? isCreate
                ? 'Adding…'
                : 'Saving…'
              : task.kind === 'venue-create'
                ? 'Add venue'
                : task.kind === 'field-create'
                  ? 'Add field'
                  : 'Save changes'}
          </button>
          <button className="secondary" disabled={submitting} onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

function FieldTable({
  disabled,
  venue,
  onEdit,
}: {
  readonly disabled: boolean;
  readonly venue: VenueAdmin;
  readonly onEdit: (field: FieldAdmin, trigger: HTMLButtonElement) => void;
}) {
  if (!venue.fields.length)
    return <p className={styles.noFields}>No fields have been added to this venue.</p>;

  return (
    <div className={styles.tableRegion}>
      <table className={styles.fieldTable}>
        <caption>Fields at {venue.name}</caption>
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Lights</th>
            <th scope="col">Fence distance</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className={styles.visuallyHidden}>Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {venue.fields.map((field) => (
            <tr key={field.fieldId}>
              <td data-label="Field">
                <strong>{field.name}</strong>
                {field.publicDirections ? (
                  <p className={styles.directions}>{field.publicDirections}</p>
                ) : (
                  <p className={styles.directions}>No public directions saved.</p>
                )}
              </td>
              <td data-label="Lights">{field.hasLights ? 'Available' : 'Not available'}</td>
              <td data-label="Fence distance">
                {field.fenceDistanceFeet === null
                  ? 'Not recorded'
                  : `${field.fenceDistanceFeet} ft`}
              </td>
              <td data-label="Status">
                <StatusBadge value={field.active ? 'active' : 'inactive'} />
              </td>
              <td className={styles.actionCell} data-label="Actions">
                <button
                  className="secondary"
                  disabled={disabled}
                  onClick={(event) => onEdit(field, event.currentTarget)}
                  type="button"
                >
                  Edit {field.name}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function VenueFieldManager({ organizationId }: { readonly organizationId: string }) {
  const [venues, setVenues] = useState<readonly VenueAdmin[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [task, setTask] = useState<VenueTask | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [pendingFocusVenueId, setPendingFocusVenueId] = useState<string | null>(null);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const summaryRefs = useRef(new Map<string, HTMLElement>());
  const taskTriggerRef = useRef<HTMLElement | null>(null);
  const taskActiveRef = useRef(false);
  const loadRequestRef = useRef(0);
  const taskSubmittingRef = useRef(false);

  const loadVenues = useCallback(async () => {
    const requestNumber = loadRequestRef.current + 1;
    loadRequestRef.current = requestNumber;
    setLoadError(null);
    setVenues(null);
    try {
      const result = await browserApi.getVenues(organizationId);
      if (loadRequestRef.current === requestNumber) setVenues(sortVenues(result));
    } catch (error) {
      if (loadRequestRef.current === requestNumber) setLoadError(loadErrorMessage(error));
    }
  }, [organizationId]);

  useEffect(() => {
    void loadVenues();
    return () => {
      loadRequestRef.current += 1;
    };
  }, [loadVenues]);

  useEffect(() => {
    if (!pendingFocusVenueId) return;
    const summary = summaryRefs.current.get(pendingFocusVenueId);
    if (!summary) return;
    summary.focus();
    setPendingFocusVenueId(null);
  }, [pendingFocusVenueId, venues]);

  const beginTask = (nextTask: VenueTask, trigger: HTMLElement) => {
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

  const saveFacility = (saved: SavedFacility) => {
    changeTaskSubmitting(false);
    taskActiveRef.current = false;
    if (saved.kind === 'venue') {
      setVenues((current) => {
        if (!current) return [saved.venue];
        const exists = current.some((venue) => venue.venueId === saved.venue.venueId);
        return sortVenues(
          exists
            ? current.map((venue) => (venue.venueId === saved.venue.venueId ? saved.venue : venue))
            : [...current, saved.venue],
        );
      });
      setAnnouncement(
        task?.kind === 'venue-create'
          ? `${saved.venue.name} was added.`
          : `${saved.venue.name} was updated.`,
      );
      setPendingFocusVenueId(saved.venue.venueId);
    } else {
      setVenues((current) =>
        current
          ? sortVenues(
              current.map((venue) => {
                if (venue.venueId !== saved.field.venueId) return venue;
                const exists = venue.fields.some((field) => field.fieldId === saved.field.fieldId);
                return {
                  ...venue,
                  fields: sortFields(
                    exists
                      ? venue.fields.map((field) =>
                          field.fieldId === saved.field.fieldId ? saved.field : field,
                        )
                      : [...venue.fields, saved.field],
                  ),
                };
              }),
            )
          : current,
      );
      setAnnouncement(
        task?.kind === 'field-create'
          ? `${saved.field.name} was added.`
          : `${saved.field.name} was updated.`,
      );
      setPendingFocusVenueId(saved.field.venueId);
    }
    setTask(null);
  };

  const taskLocked = task !== null || taskSubmitting;

  return (
    <div className={styles.manager}>
      <PageHeading
        actions={
          <button
            disabled={taskLocked}
            onClick={(event) => beginTask({ kind: 'venue-create' }, event.currentTarget)}
            type="button"
          >
            Add Venue
          </button>
        }
        description="Create the physical locations and field details used by future schedules. Changes stay inside this organization."
        eyebrow="Schedule setup"
        title="Venues & Fields"
      />

      {announcement ? (
        <div className="callout" role="status">
          {announcement}
        </div>
      ) : null}

      {task?.kind === 'venue-create' ? (
        <FacilityTaskPanel
          key={taskKey(task)}
          onCancel={cancelTask}
          onSaved={saveFacility}
          onSubmittingChange={changeTaskSubmitting}
          organizationId={organizationId}
          task={task}
        />
      ) : null}

      {loadError ? (
        <section className="empty-state" role="alert">
          <h2>Venues unavailable</h2>
          <p>{loadError}</p>
          <button onClick={() => void loadVenues()} type="button">
            Try again
          </button>
        </section>
      ) : !venues ? (
        <p aria-live="polite">Loading venues and fields…</p>
      ) : venues.length === 0 ? (
        <EmptyState
          action={
            <button
              disabled={taskLocked}
              onClick={(event) => beginTask({ kind: 'venue-create' }, event.currentTarget)}
              type="button"
            >
              Add your first venue
            </button>
          }
          title="Add your first venue"
        >
          <p>Venues contain the individual fields that will later receive schedule availability.</p>
        </EmptyState>
      ) : (
        <section aria-label="Venue and field list" className={styles.venueList}>
          {venues.map((venue) => {
            const taskBelongsHere = task && taskVenueId(task) === venue.venueId;
            return (
              <details className={styles.venue} key={venue.venueId}>
                <summary
                  className={styles.venueSummary}
                  ref={(element) => {
                    if (element) summaryRefs.current.set(venue.venueId, element);
                    else summaryRefs.current.delete(venue.venueId);
                  }}
                >
                  <span className={styles.summaryContent}>
                    <span className={styles.summaryIdentity}>
                      <strong>{venue.name}</strong>
                      <span className={styles.fieldCount}>
                        {venue.fields.length} {venue.fields.length === 1 ? 'field' : 'fields'}
                      </span>
                    </span>
                    <StatusBadge value={venue.active ? 'active' : 'inactive'} />
                  </span>
                </summary>
                <div className={styles.venueBody}>
                  <div className={styles.venueActions}>
                    <button
                      className="secondary"
                      disabled={taskLocked}
                      onClick={(event) =>
                        beginTask({ kind: 'venue-edit', venue }, event.currentTarget)
                      }
                      type="button"
                    >
                      Edit venue
                    </button>
                    <button
                      disabled={taskLocked}
                      onClick={(event) =>
                        beginTask({ kind: 'field-create', venue }, event.currentTarget)
                      }
                      type="button"
                    >
                      Add Field
                    </button>
                  </div>

                  {taskBelongsHere && task ? (
                    <FacilityTaskPanel
                      key={taskKey(task)}
                      onCancel={cancelTask}
                      onSaved={saveFacility}
                      onSubmittingChange={changeTaskSubmitting}
                      organizationId={organizationId}
                      task={task}
                    />
                  ) : null}

                  <FieldTable
                    disabled={taskLocked}
                    onEdit={(field, trigger) =>
                      beginTask({ kind: 'field-edit', venue, field }, trigger)
                    }
                    venue={venue}
                  />
                </div>
              </details>
            );
          })}
        </section>
      )}
    </div>
  );
}
