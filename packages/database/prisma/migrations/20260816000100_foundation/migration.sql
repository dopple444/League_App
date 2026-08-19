-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AuthorityKind" AS ENUM ('BOARD', 'OFFICER', 'OPERATIONS', 'AUDIT');

-- CreateEnum
CREATE TYPE "AuditSource" AS ENUM ('WEB', 'MOBILE', 'API', 'WORKER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PublicationResourceKind" AS ENUM ('SEASON', 'TEAM_SEASON', 'SCHEDULE');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('SCHEDULED', 'POSTPONED', 'CANCELED', 'FINAL');

-- CreateTable
CREATE TABLE "auth_user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auth_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" UUID NOT NULL,

    CONSTRAINT "auth_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_account" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ(3),
    "refresh_token_expires_at" TIMESTAMPTZ(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auth_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_verification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "auth_verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "organization_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "league" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "league_pkey" PRIMARY KEY ("organization_id","id")
);

-- CreateTable
CREATE TABLE "division" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "league_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "division_pkey" PRIMARY KEY ("organization_id","id")
);

-- CreateTable
CREATE TABLE "season" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "league_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "season_pkey" PRIMARY KEY ("organization_id","id")
);

-- CreateTable
CREATE TABLE "season_configuration_revision" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "configuration" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "season_configuration_revision_pkey" PRIMARY KEY ("organization_id","id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "team_pkey" PRIMARY KEY ("organization_id","id")
);

-- CreateTable
CREATE TABLE "team_season" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "public_name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "team_season_pkey" PRIMARY KEY ("organization_id","id")
);

-- CreateTable
CREATE TABLE "venue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "venue_pkey" PRIMARY KEY ("organization_id","id")
);

-- CreateTable
CREATE TABLE "field" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "public_directions" TEXT,

    CONSTRAINT "field_pkey" PRIMARY KEY ("organization_id","id")
);

-- CreateTable
CREATE TABLE "schedule_version" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_version_pkey" PRIMARY KEY ("organization_id","id")
);

-- CreateTable
CREATE TABLE "game" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "season_id" UUID NOT NULL,
    "schedule_version_id" UUID NOT NULL,
    "home_team_season_id" UUID NOT NULL,
    "away_team_season_id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "game_pkey" PRIMARY KEY ("organization_id","id")
);

-- CreateTable
CREATE TABLE "organization_membership" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_membership_pkey" PRIMARY KEY ("organization_id","id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "authority_kind" "AuthorityKind" NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("organization_id","id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "organization_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission" TEXT NOT NULL,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("organization_id","role_id","permission")
);

-- CreateTable
CREATE TABLE "role_assignment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "valid_from" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "revoked_by_user_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "role_assignment_pkey" PRIMARY KEY ("organization_id","id")
);

-- CreateTable
CREATE TABLE "publication_snapshot" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "resource_kind" "PublicationResourceKind" NOT NULL,
    "resource_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn_at" TIMESTAMPTZ(3),

    CONSTRAINT "publication_snapshot_pkey" PRIMARY KEY ("organization_id","id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "request_id" TEXT NOT NULL,
    "source" "AuditSource" NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("organization_id","id")
);

-- CreateTable
CREATE TABLE "security_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "event_type" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "request_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_event_pkey" PRIMARY KEY ("organization_id","id")
);

-- CreateTable
CREATE TABLE "outbox_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "request_id" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("organization_id","id")
);

-- CreateTable
CREATE TABLE "idempotency_record" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_record_pkey" PRIMARY KEY ("organization_id","id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_user_email_key" ON "auth_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_session_token_key" ON "auth_session"("token");

-- CreateIndex
CREATE INDEX "auth_session_user_id_idx" ON "auth_session"("user_id");

-- CreateIndex
CREATE INDEX "auth_account_user_id_idx" ON "auth_account"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_account_provider_id_account_id_key" ON "auth_account"("provider_id", "account_id");

-- CreateIndex
CREATE INDEX "auth_verification_identifier_idx" ON "auth_verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "league_organization_id_slug_key" ON "league"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "division_organization_id_league_id_slug_key" ON "division"("organization_id", "league_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "season_organization_id_league_id_slug_key" ON "season"("organization_id", "league_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "season_configuration_revision_organization_id_season_id_rev_key" ON "season_configuration_revision"("organization_id", "season_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "team_season_organization_id_season_id_team_id_key" ON "team_season"("organization_id", "season_id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_season_organization_id_season_id_slug_key" ON "team_season"("organization_id", "season_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "team_season_organization_id_season_id_id_key" ON "team_season"("organization_id", "season_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "field_organization_id_venue_id_name_key" ON "field"("organization_id", "venue_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_version_organization_id_season_id_revision_key" ON "schedule_version"("organization_id", "season_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_version_organization_id_season_id_id_key" ON "schedule_version"("organization_id", "season_id", "id");

-- CreateIndex
CREATE INDEX "game_organization_id_season_id_starts_at_idx" ON "game"("organization_id", "season_id", "starts_at");

-- CreateIndex
CREATE INDEX "organization_membership_user_id_status_idx" ON "organization_membership"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_membership_organization_id_user_id_key" ON "organization_membership"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_organization_id_key_key" ON "role"("organization_id", "key");

-- CreateIndex
CREATE INDEX "role_assignment_organization_id_membership_id_idx" ON "role_assignment"("organization_id", "membership_id");

-- CreateIndex
CREATE INDEX "publication_snapshot_organization_id_resource_kind_resource_idx" ON "publication_snapshot"("organization_id", "resource_kind", "resource_id", "withdrawn_at");

-- CreateIndex
CREATE UNIQUE INDEX "publication_snapshot_organization_id_resource_kind_resource_key" ON "publication_snapshot"("organization_id", "resource_kind", "resource_id", "revision");

-- CreateIndex
CREATE INDEX "audit_event_organization_id_occurred_at_idx" ON "audit_event"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "security_event_organization_id_occurred_at_idx" ON "security_event"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "outbox_event_organization_id_status_available_at_idx" ON "outbox_event"("organization_id", "status", "available_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_record_organization_id_actor_user_id_key_key" ON "idempotency_record"("organization_id", "actor_user_id", "key");

-- AddForeignKey
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league" ADD CONSTRAINT "league_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "division" ADD CONSTRAINT "division_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "division" ADD CONSTRAINT "division_organization_id_league_id_fkey" FOREIGN KEY ("organization_id", "league_id") REFERENCES "league"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season" ADD CONSTRAINT "season_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season" ADD CONSTRAINT "season_organization_id_league_id_fkey" FOREIGN KEY ("organization_id", "league_id") REFERENCES "league"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_configuration_revision" ADD CONSTRAINT "season_configuration_revision_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_configuration_revision" ADD CONSTRAINT "season_configuration_revision_organization_id_season_id_fkey" FOREIGN KEY ("organization_id", "season_id") REFERENCES "season"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season" ADD CONSTRAINT "team_season_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season" ADD CONSTRAINT "team_season_organization_id_season_id_fkey" FOREIGN KEY ("organization_id", "season_id") REFERENCES "season"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_season" ADD CONSTRAINT "team_season_organization_id_team_id_fkey" FOREIGN KEY ("organization_id", "team_id") REFERENCES "team"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue" ADD CONSTRAINT "venue_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field" ADD CONSTRAINT "field_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field" ADD CONSTRAINT "field_organization_id_venue_id_fkey" FOREIGN KEY ("organization_id", "venue_id") REFERENCES "venue"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_version" ADD CONSTRAINT "schedule_version_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_version" ADD CONSTRAINT "schedule_version_organization_id_season_id_fkey" FOREIGN KEY ("organization_id", "season_id") REFERENCES "season"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game" ADD CONSTRAINT "game_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game" ADD CONSTRAINT "game_organization_id_season_id_fkey" FOREIGN KEY ("organization_id", "season_id") REFERENCES "season"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game" ADD CONSTRAINT "game_organization_id_season_id_schedule_version_id_fkey" FOREIGN KEY ("organization_id", "season_id", "schedule_version_id") REFERENCES "schedule_version"("organization_id", "season_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game" ADD CONSTRAINT "game_organization_id_season_id_home_team_season_id_fkey" FOREIGN KEY ("organization_id", "season_id", "home_team_season_id") REFERENCES "team_season"("organization_id", "season_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game" ADD CONSTRAINT "game_organization_id_season_id_away_team_season_id_fkey" FOREIGN KEY ("organization_id", "season_id", "away_team_season_id") REFERENCES "team_season"("organization_id", "season_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "game" ADD CONSTRAINT "game_distinct_teams_check" CHECK ("home_team_season_id" <> "away_team_season_id");

-- AddForeignKey
ALTER TABLE "game" ADD CONSTRAINT "game_organization_id_field_id_fkey" FOREIGN KEY ("organization_id", "field_id") REFERENCES "field"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_membership" ADD CONSTRAINT "organization_membership_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_membership" ADD CONSTRAINT "organization_membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role" ADD CONSTRAINT "role_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_organization_id_role_id_fkey" FOREIGN KEY ("organization_id", "role_id") REFERENCES "role"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_organization_id_membership_id_fkey" FOREIGN KEY ("organization_id", "membership_id") REFERENCES "organization_membership"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_organization_id_role_id_fkey" FOREIGN KEY ("organization_id", "role_id") REFERENCES "role"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_snapshot" ADD CONSTRAINT "publication_snapshot_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_event" ADD CONSTRAINT "security_event_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_record" ADD CONSTRAINT "idempotency_record_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Application context and least-privilege runtime role.
CREATE SCHEMA IF NOT EXISTS app;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'league_runtime') THEN
    CREATE ROLE league_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'league_rls_owner') THEN
    CREATE ROLE league_rls_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public, app TO league_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO league_runtime;
REVOKE UPDATE, DELETE ON "audit_event" FROM league_runtime;
REVOKE UPDATE, DELETE ON "season_configuration_revision" FROM league_runtime;
REVOKE DELETE ON "publication_snapshot" FROM league_runtime;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'league_test') THEN
    GRANT USAGE ON SCHEMA public, app TO league_test;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO league_test;
    REVOKE UPDATE, DELETE ON "audit_event" FROM league_test;
    REVOKE UPDATE, DELETE ON "season_configuration_revision" FROM league_test;
    REVOKE DELETE ON "publication_snapshot" FROM league_test;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION app.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_organization_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.require_organization_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  value uuid;
BEGIN
  value := app.current_organization_id();
  IF value IS NULL THEN
    RAISE EXCEPTION 'tenant context is required' USING ERRCODE = '42501';
  END IF;
  RETURN value;
END
$$;

-- These are the only pre-tenant discovery paths. They return identifiers, not
-- tenant-owned rows, and run with the migration owner's privileges.
CREATE OR REPLACE FUNCTION app.list_user_organizations()
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
      AND membership.status = 'ACTIVE';
END
$$;

CREATE OR REPLACE FUNCTION app.resolve_public_organization(
  p_organization_slug text,
  p_league_slug text
)
RETURNS TABLE(organization_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT organization.organization_id
  FROM organization
  JOIN league
    ON league.organization_id = organization.organization_id
  WHERE organization.slug = p_organization_slug
    AND league.slug = p_league_slug
    AND EXISTS (
      SELECT 1
      FROM publication_snapshot
      WHERE publication_snapshot.organization_id = organization.organization_id
        AND publication_snapshot.resource_kind = 'SEASON'
        AND publication_snapshot.withdrawn_at IS NULL
    )
  LIMIT 1
$$;

ALTER FUNCTION app.list_user_organizations() OWNER TO league_rls_owner;
ALTER FUNCTION app.resolve_public_organization(text, text) OWNER TO league_rls_owner;
GRANT USAGE ON SCHEMA public, app TO league_rls_owner;
GRANT SELECT ON organization, league, organization_membership, publication_snapshot TO league_rls_owner;

REVOKE ALL ON FUNCTION app.current_organization_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.require_organization_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.current_organization_id(), app.current_user_id(), app.require_organization_id() TO league_runtime, league_rls_owner;

REVOKE ALL ON FUNCTION app.list_user_organizations() FROM PUBLIC;
REVOKE ALL ON FUNCTION app.resolve_public_organization(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.list_user_organizations() TO league_runtime;
GRANT EXECUTE ON FUNCTION app.resolve_public_organization(text, text) TO league_runtime;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'league_test') THEN
    GRANT EXECUTE ON FUNCTION app.current_organization_id(), app.current_user_id(), app.require_organization_id() TO league_test;
    GRANT EXECUTE ON FUNCTION app.list_user_organizations() TO league_test;
    GRANT EXECUTE ON FUNCTION app.resolve_public_organization(text, text) TO league_test;
  END IF;
END
$$;

DO $rls$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'organization',
    'league',
    'division',
    'season',
    'season_configuration_revision',
    'team',
    'team_season',
    'venue',
    'field',
    'schedule_version',
    'game',
    'organization_membership',
    'role',
    'role_permission',
    'role_assignment',
    'publication_snapshot',
    'audit_event',
    'security_event',
    'outbox_event',
    'idempotency_record'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (organization_id = app.require_organization_id()) WITH CHECK (organization_id = app.require_organization_id())',
      table_name
    );
  END LOOP;
END
$rls$;

-- Audit history is append-only. A reviewed recovery migration can explicitly
-- disable this trigger if a forward repair is ever required.
CREATE OR REPLACE FUNCTION app.prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit events are append-only' USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER audit_event_append_only
BEFORE UPDATE OR DELETE ON audit_event
FOR EACH ROW EXECUTE FUNCTION app.prevent_audit_mutation();

CREATE TRIGGER season_configuration_revision_append_only
BEFORE UPDATE OR DELETE ON season_configuration_revision
FOR EACH ROW EXECUTE FUNCTION app.prevent_audit_mutation();

CREATE OR REPLACE FUNCTION app.protect_publication_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'publication snapshots are immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.resource_kind IS DISTINCT FROM OLD.resource_kind
    OR NEW.resource_id IS DISTINCT FROM OLD.resource_id
    OR NEW.revision IS DISTINCT FROM OLD.revision
    OR NEW.payload IS DISTINCT FROM OLD.payload
    OR NEW.published_at IS DISTINCT FROM OLD.published_at
    OR OLD.withdrawn_at IS NOT NULL
    OR NEW.withdrawn_at IS NULL
  THEN
    RAISE EXCEPTION 'publication snapshots are immutable except for first withdrawal' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER publication_snapshot_immutable
BEFORE UPDATE OR DELETE ON publication_snapshot
FOR EACH ROW EXECUTE FUNCTION app.protect_publication_snapshot();
