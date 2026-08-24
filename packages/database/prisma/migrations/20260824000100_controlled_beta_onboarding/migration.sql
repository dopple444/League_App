-- Controlled-beta onboarding makes PENDING the fail-closed membership default,
-- then adds global platform authority/audit/idempotency records and a tenant-
-- owned invitation. Existing memberships retain their current values.

CREATE TYPE "PlatformPermission" AS ENUM ('TENANT_PROVISION', 'INVITATION_REVOKE');

ALTER TABLE "organization_membership"
  ALTER COLUMN "status" SET DEFAULT 'PENDING',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "activated_at" TIMESTAMPTZ(3),
  ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "organization_membership"
  ADD CONSTRAINT "organization_membership_version_check" CHECK ("version" > 0),
  ADD CONSTRAINT "organization_membership_pending_activation_check"
    CHECK ("status" <> 'PENDING' OR "activated_at" IS NULL);

CREATE TABLE "platform_permission_grant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "permission" "PlatformPermission" NOT NULL,
  "valid_from" TIMESTAMPTZ(3) NOT NULL,
  "expires_at" TIMESTAMPTZ(3),
  "revoked_at" TIMESTAMPTZ(3),
  "granted_by_user_id" UUID,
  "revoked_by_user_id" UUID,
  "reason" TEXT NOT NULL,
  "revocation_reason" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_permission_grant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "platform_permission_grant_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "auth_user"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "platform_permission_grant_granted_by_user_id_fkey"
    FOREIGN KEY ("granted_by_user_id") REFERENCES "auth_user"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "platform_permission_grant_revoked_by_user_id_fkey"
    FOREIGN KEY ("revoked_by_user_id") REFERENCES "auth_user"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "platform_permission_grant_time_check"
    CHECK ("expires_at" IS NULL OR "expires_at" > "valid_from"),
  CONSTRAINT "platform_permission_grant_reason_check"
    CHECK (length(btrim("reason")) > 0),
  CONSTRAINT "platform_permission_grant_revocation_check"
    CHECK (
      ("revoked_at" IS NULL AND "revoked_by_user_id" IS NULL AND "revocation_reason" IS NULL)
      OR
      ("revoked_at" IS NOT NULL AND "revoked_by_user_id" IS NOT NULL AND length(btrim("revocation_reason")) > 0)
    )
);

CREATE INDEX "platform_permission_grant_user_id_permission_valid_from_idx"
  ON "platform_permission_grant"("user_id", "permission", "valid_from");

CREATE TABLE "platform_idempotency_record" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_user_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "response_status" INTEGER NOT NULL,
  "response_body" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "platform_idempotency_record_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "platform_idempotency_record_expiry_check" CHECK ("expires_at" > "created_at")
);

CREATE UNIQUE INDEX "platform_idempotency_record_actor_user_id_key_key"
  ON "platform_idempotency_record"("actor_user_id", "key");

CREATE TABLE "platform_audit_event" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_user_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "reason" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "source" "AuditSource" NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_audit_event_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "platform_audit_event_reason_check" CHECK (length(btrim("reason")) > 0)
);

CREATE INDEX "platform_audit_event_occurred_at_idx"
  ON "platform_audit_event"("occurred_at");

CREATE TABLE "administrator_invitation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "league_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "email_normalized" TEXT NOT NULL,
  "token_digest" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "accepted_at" TIMESTAMPTZ(3),
  "accepted_by_user_id" UUID,
  "revoked_at" TIMESTAMPTZ(3),
  "revoked_by_user_id" UUID,
  "revocation_reason" TEXT,
  "activated_at" TIMESTAMPTZ(3),
  "activated_by_user_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "administrator_invitation_pkey" PRIMARY KEY ("organization_id", "id"),
  CONSTRAINT "administrator_invitation_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "administrator_invitation_organization_id_league_id_fkey"
    FOREIGN KEY ("organization_id", "league_id") REFERENCES "league"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "administrator_invitation_organization_id_role_id_fkey"
    FOREIGN KEY ("organization_id", "role_id") REFERENCES "role"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "administrator_invitation_email_normalized_check"
    CHECK (
      "email_normalized" = lower(btrim("email_normalized"))
      AND length("email_normalized") BETWEEN 3 AND 320
    ),
  CONSTRAINT "administrator_invitation_token_digest_check"
    CHECK ("token_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "administrator_invitation_expiry_check" CHECK ("expires_at" > "created_at"),
  CONSTRAINT "administrator_invitation_version_check" CHECK ("version" > 0),
  CONSTRAINT "administrator_invitation_acceptance_check"
    CHECK (
      ("accepted_at" IS NULL AND "accepted_by_user_id" IS NULL)
      OR ("accepted_at" IS NOT NULL AND "accepted_by_user_id" IS NOT NULL)
    ),
  CONSTRAINT "administrator_invitation_revocation_check"
    CHECK (
      ("revoked_at" IS NULL AND "revoked_by_user_id" IS NULL AND "revocation_reason" IS NULL)
      OR
      ("revoked_at" IS NOT NULL AND "revoked_by_user_id" IS NOT NULL AND length(btrim("revocation_reason")) > 0)
    ),
  CONSTRAINT "administrator_invitation_activation_check"
    CHECK (
      ("activated_at" IS NULL AND "activated_by_user_id" IS NULL)
      OR
      (
        "activated_at" IS NOT NULL
        AND "activated_by_user_id" IS NOT NULL
        AND "accepted_at" IS NOT NULL
        AND "accepted_by_user_id" = "activated_by_user_id"
        AND "revoked_at" IS NULL
      )
    ),
  CONSTRAINT "administrator_invitation_terminal_state_check"
    CHECK ("accepted_at" IS NULL OR "revoked_at" IS NULL)
);

CREATE UNIQUE INDEX "administrator_invitation_token_digest_key"
  ON "administrator_invitation"("token_digest");
CREATE INDEX "administrator_invitation_organization_id_email_normalized_idx"
  ON "administrator_invitation"("organization_id", "email_normalized");
CREATE INDEX "administrator_invitation_organization_id_expires_at_idx"
  ON "administrator_invitation"("organization_id", "expires_at");

-- The invitation is tenant-owned. Platform tables remain identity/platform scoped
-- and intentionally carry no organization RLS policy.
ALTER TABLE "administrator_invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "administrator_invitation" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "administrator_invitation"
  USING ("organization_id" = app.require_organization_id())
  WITH CHECK ("organization_id" = app.require_organization_id());

-- New-table grants are explicit because the foundation's ALL TABLES grant does
-- not apply retroactively. Platform grant reads remain behind effective-access
-- helpers; runtime writes only idempotency/audit and tenant-scoped invitations.
GRANT SELECT, INSERT, UPDATE, DELETE ON "administrator_invitation" TO league_runtime;
GRANT SELECT ON "platform_permission_grant" TO league_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "platform_idempotency_record" TO league_runtime;
GRANT INSERT, SELECT ON "platform_audit_event" TO league_runtime;
REVOKE UPDATE, DELETE ON "platform_audit_event" FROM league_runtime;

DO $test_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'league_test') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "administrator_invitation" TO league_test;
    GRANT SELECT ON "platform_permission_grant" TO league_test;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "platform_idempotency_record" TO league_test;
    GRANT INSERT, SELECT ON "platform_audit_event" TO league_test;
    REVOKE UPDATE, DELETE ON "platform_audit_event" FROM league_test;
  END IF;
END
$test_grants$;

-- Platform audit history is append-only under the same reviewed recovery model
-- as tenant audit history.
CREATE TRIGGER platform_audit_event_append_only
BEFORE UPDATE OR DELETE ON "platform_audit_event"
FOR EACH ROW EXECUTE FUNCTION app.prevent_audit_mutation();

CREATE OR REPLACE FUNCTION app.has_platform_permission(p_permission "PlatformPermission")
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT app.current_user_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM platform_permission_grant AS grant_record
      WHERE grant_record.user_id = app.current_user_id()
        AND grant_record.permission = p_permission
        AND grant_record.valid_from <= CURRENT_TIMESTAMP
        AND (grant_record.expires_at IS NULL OR grant_record.expires_at > CURRENT_TIMESTAMP)
        AND grant_record.revoked_at IS NULL
    )
$$;

-- Token state is deliberately not interpreted here. Callers receive only the
-- tenant identifier and must apply uniform terminal-state behavior under RLS.
CREATE OR REPLACE FUNCTION app.resolve_administrator_invitation_organization(
  p_token_digest text
)
RETURNS TABLE(organization_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT invitation.organization_id
  FROM administrator_invitation AS invitation
  WHERE invitation.token_digest = p_token_digest
    AND p_token_digest ~ '^[0-9a-f]{64}$'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION app.list_pending_membership_organizations()
RETURNS TABLE(organization_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF app.current_user_id() IS NULL THEN
    RAISE EXCEPTION 'authenticated user context is required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT membership.organization_id
    FROM organization_membership AS membership
    WHERE membership.user_id = app.current_user_id()
      AND membership.status = 'PENDING';
END
$$;

CREATE OR REPLACE FUNCTION app.list_platform_onboarding()
RETURNS TABLE(
  organization_id uuid,
  organization_slug text,
  organization_name text,
  organization_timezone text,
  league_id uuid,
  league_slug text,
  league_name text,
  invitation_id uuid,
  administrator_email text,
  invitation_expires_at timestamptz,
  invitation_accepted_at timestamptz,
  invitation_revoked_at timestamptz,
  invitation_activated_at timestamptz,
  invitation_version integer,
  invitation_created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT (
    app.has_platform_permission('TENANT_PROVISION')
    OR app.has_platform_permission('INVITATION_REVOKE')
  ) THEN
    RAISE EXCEPTION 'effective platform permission is required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT
      organization.organization_id,
      organization.slug,
      organization.name,
      organization.timezone,
      league.id,
      league.slug,
      league.name,
      invitation.id,
      invitation.email_normalized,
      invitation.expires_at,
      invitation.accepted_at,
      invitation.revoked_at,
      invitation.activated_at,
      invitation.version,
      invitation.created_at
    FROM administrator_invitation AS invitation
    JOIN organization
      ON organization.organization_id = invitation.organization_id
    JOIN league
      ON league.organization_id = invitation.organization_id
      AND league.id = invitation.league_id
    ORDER BY invitation.created_at DESC, invitation.id
    LIMIT 200;
END
$$;

CREATE OR REPLACE FUNCTION app.resolve_platform_invitation_organization(
  p_invitation_id uuid
)
RETURNS TABLE(organization_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT app.has_platform_permission('INVITATION_REVOKE') THEN
    RAISE EXCEPTION 'effective invitation revocation permission is required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT invitation.organization_id
    FROM administrator_invitation AS invitation
    WHERE invitation.id = p_invitation_id
    LIMIT 1;
END
$$;

ALTER FUNCTION app.has_platform_permission("PlatformPermission") OWNER TO league_rls_owner;
ALTER FUNCTION app.resolve_administrator_invitation_organization(text) OWNER TO league_rls_owner;
ALTER FUNCTION app.list_pending_membership_organizations() OWNER TO league_rls_owner;
ALTER FUNCTION app.list_platform_onboarding() OWNER TO league_rls_owner;
ALTER FUNCTION app.resolve_platform_invitation_organization(uuid) OWNER TO league_rls_owner;

GRANT SELECT ON
  "administrator_invitation",
  "organization",
  "league",
  "organization_membership",
  "platform_permission_grant"
TO league_rls_owner;

REVOKE ALL ON FUNCTION app.has_platform_permission("PlatformPermission") FROM PUBLIC;
REVOKE ALL ON FUNCTION app.resolve_administrator_invitation_organization(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app.list_pending_membership_organizations() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.list_platform_onboarding() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.resolve_platform_invitation_organization(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app.has_platform_permission("PlatformPermission") TO league_runtime;
GRANT EXECUTE ON FUNCTION app.resolve_administrator_invitation_organization(text) TO league_runtime;
GRANT EXECUTE ON FUNCTION app.list_pending_membership_organizations() TO league_runtime;
GRANT EXECUTE ON FUNCTION app.list_platform_onboarding() TO league_runtime;
GRANT EXECUTE ON FUNCTION app.resolve_platform_invitation_organization(uuid) TO league_runtime;

DO $test_function_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'league_test') THEN
    GRANT EXECUTE ON FUNCTION app.has_platform_permission("PlatformPermission") TO league_test;
    GRANT EXECUTE ON FUNCTION app.resolve_administrator_invitation_organization(text) TO league_test;
    GRANT EXECUTE ON FUNCTION app.list_pending_membership_organizations() TO league_test;
    GRANT EXECUTE ON FUNCTION app.list_platform_onboarding() TO league_test;
    GRANT EXECUTE ON FUNCTION app.resolve_platform_invitation_organization(uuid) TO league_test;
  END IF;
END
$test_function_grants$;
