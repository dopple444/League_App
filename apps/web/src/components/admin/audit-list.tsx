'use client';

import { useEffect, useState } from 'react';

import { browserApi, type AuditEventSummary } from '../../lib/api-client';
import { EmptyState } from '../site-shell';

const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(date) + ' UTC';
};

export function AuditList({ organizationId }: { readonly organizationId: string }) {
  const [events, setEvents] = useState<readonly AuditEventSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void browserApi
      .getAuditEvents(organizationId)
      .then((items) => {
        if (active) setEvents(items);
      })
      .catch(() => {
        if (active) setError('We could not load audit history.');
      });
    return () => {
      active = false;
    };
  }, [organizationId]);
  if (error)
    return (
      <div className="callout error" role="alert">
        {error}
      </div>
    );
  if (!events) return <p aria-live="polite">Loading audit history…</p>;
  if (!events.length)
    return (
      <EmptyState title="No audited changes yet">
        <p>Authoritative season, team, publication, and access changes will appear here.</p>
      </EmptyState>
    );
  return (
    <div className="table-card">
      <table>
        <caption>Most recent audited changes</caption>
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Actor</th>
            <th scope="col">Action</th>
            <th scope="col">Target</th>
            <th scope="col">Trace</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.auditEventId}>
              <td>{formatTimestamp(event.occurredAt)}</td>
              <td>{event.actorUserId ?? 'System'}</td>
              <td>{event.action.replaceAll('_', ' ')}</td>
              <td>
                {event.targetType}
                <br />
                <span className="meta">{event.targetId}</span>
              </td>
              <td>
                <span className="meta">
                  Request {event.requestId}
                  <br />
                  Source {event.source}
                </span>
                {event.reason ? (
                  <>
                    <br />
                    Reason: {event.reason}
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
