-- Add an index for the metadata-only cross-tenant discovery function. Tenant
-- payload access remains protected by forced RLS and tenant-scoped transactions.
CREATE INDEX "outbox_event_relay_due_idx"
ON "outbox_event"("status", "available_at", "organization_id");

-- The relay may discover only organization identifiers. It cannot read event
-- metadata or payloads across tenants through this function.
CREATE OR REPLACE FUNCTION app.list_due_outbox_organizations(p_limit integer)
RETURNS TABLE(organization_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 500 THEN
    RAISE EXCEPTION 'outbox organization limit must be between 1 and 500'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
    SELECT event.organization_id
    FROM public.outbox_event AS event
    WHERE event.status IN ('PENDING', 'PROCESSING')
      AND event.available_at <= CURRENT_TIMESTAMP
    GROUP BY event.organization_id
    ORDER BY min(event.available_at), event.organization_id
    LIMIT p_limit;
END
$$;

-- Health exposes aggregate lifecycle metadata only. It never returns tenant,
-- aggregate, request, actor, or payload values.
CREATE OR REPLACE FUNCTION app.outbox_relay_health()
RETURNS TABLE(
  pending_count bigint,
  processing_count bigint,
  failed_count bigint,
  oldest_due_seconds double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT
    count(event.organization_id) FILTER (WHERE event.status = 'PENDING') AS pending_count,
    count(event.organization_id) FILTER (WHERE event.status = 'PROCESSING') AS processing_count,
    count(event.organization_id) FILTER (WHERE event.status = 'FAILED') AS failed_count,
    CASE
      WHEN min(event.available_at) FILTER (
        WHERE event.status IN ('PENDING', 'PROCESSING')
          AND event.available_at <= CURRENT_TIMESTAMP
      ) IS NULL THEN NULL
      ELSE greatest(
        0::double precision,
        extract(epoch FROM (
          CURRENT_TIMESTAMP - min(event.available_at) FILTER (
            WHERE event.status IN ('PENDING', 'PROCESSING')
              AND event.available_at <= CURRENT_TIMESTAMP
          )
        ))::double precision
      )
    END AS oldest_due_seconds
  FROM public.outbox_event AS event
$$;

GRANT SELECT ("organization_id", "status", "available_at")
ON TABLE "outbox_event" TO league_rls_owner;

-- Runtime code may insert an immutable authoritative event and advance only
-- its delivery lifecycle. It cannot rewrite payload/identity metadata or
-- delete the retained delivery record.
REVOKE UPDATE, DELETE ON TABLE "outbox_event" FROM league_runtime;
GRANT UPDATE ("status", "attempts", "available_at", "completed_at")
ON TABLE "outbox_event" TO league_runtime;

ALTER FUNCTION app.list_due_outbox_organizations(integer) OWNER TO league_rls_owner;
ALTER FUNCTION app.outbox_relay_health() OWNER TO league_rls_owner;

REVOKE ALL ON FUNCTION app.list_due_outbox_organizations(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.outbox_relay_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.list_due_outbox_organizations(integer) TO league_runtime;
GRANT EXECUTE ON FUNCTION app.outbox_relay_health() TO league_runtime;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'league_test') THEN
    GRANT EXECUTE ON FUNCTION app.list_due_outbox_organizations(integer) TO league_test;
    GRANT EXECUTE ON FUNCTION app.outbox_relay_health() TO league_test;
  END IF;
END
$$;
