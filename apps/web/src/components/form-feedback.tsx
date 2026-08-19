import type { FieldErrors } from '../lib/api-client';

export function FormErrorSummary({ errors }: { readonly errors: FieldErrors }) {
  const entries = Object.entries(errors).filter(([, messages]) => messages.length > 0);
  if (!entries.length) return null;

  return (
    <div className="callout error" role="alert" tabIndex={-1}>
      <strong>Please correct the following:</strong>
      <ul>
        {entries.map(([field, messages]) => (
          <li key={field}>
            <a href={`#${field}`}>{messages[0]}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FieldError({
  field,
  errors,
}: {
  readonly field: string;
  readonly errors: FieldErrors;
}) {
  const message = errors[field]?.[0];
  return message ? (
    <p className="field-error" id={`${field}-error`}>
      {message}
    </p>
  ) : null;
}

export const invalidProps = (field: string, errors: FieldErrors) => ({
  'aria-describedby': errors[field]?.length ? `${field}-error` : undefined,
  'aria-invalid': errors[field]?.length ? (true as const) : undefined,
});
