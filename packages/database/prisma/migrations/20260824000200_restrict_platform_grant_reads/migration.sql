-- Effective platform authority is available only through the grant-aware,
-- identity-scoped app.has_platform_permission helper. Runtime roles must not be
-- able to enumerate global platform grant records directly.
REVOKE SELECT ON "platform_permission_grant" FROM league_runtime;

DO $test_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'league_test') THEN
    REVOKE SELECT ON "platform_permission_grant" FROM league_test;
  END IF;
END
$test_grants$;
