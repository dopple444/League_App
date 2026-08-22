ALTER TABLE "auth_user"
ADD COLUMN "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "auth_two_factor" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "secret" TEXT NOT NULL,
  "backup_codes" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT true,
  "failed_verification_count" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMPTZ(3),
  CONSTRAINT "auth_two_factor_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_two_factor_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "auth_user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "auth_two_factor_secret_idx" ON "auth_two_factor"("secret");
CREATE INDEX "auth_two_factor_user_id_idx" ON "auth_two_factor"("user_id");

-- Better Auth owns this identity-scoped table. It deliberately does not carry
-- tenant RLS; application authorization still requires tenant membership.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "auth_two_factor" TO league_runtime;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'league_test') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "auth_two_factor" TO league_test;
  END IF;
END
$$;
