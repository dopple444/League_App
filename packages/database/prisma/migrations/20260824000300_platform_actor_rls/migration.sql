-- Platform idempotency responses and audit history are global rather than
-- tenant-owned, but they are still actor-scoped. Enforce that boundary in the
-- database so a runtime query cannot read or mutate another operator's rows.
ALTER TABLE "platform_idempotency_record" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_idempotency_record" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_actor_isolation ON "platform_idempotency_record"
  USING ("actor_user_id" = app.current_user_id())
  WITH CHECK ("actor_user_id" = app.current_user_id());

ALTER TABLE "platform_audit_event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_audit_event" FORCE ROW LEVEL SECURITY;
CREATE POLICY platform_actor_isolation ON "platform_audit_event"
  USING ("actor_user_id" = app.current_user_id())
  WITH CHECK ("actor_user_id" = app.current_user_id());
