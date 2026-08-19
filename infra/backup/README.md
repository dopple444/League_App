# Backup and restore verification

`pnpm db:restore:verify` creates a PostgreSQL custom-format dump of the synthetic local database,
restores it into an explicitly named temporary database, compares public-schema object counts, and
drops only that temporary database. The dump stays in a `mktemp` directory for the duration of the
check and is removed on exit.

This is a development verification path, not the production backup policy. Production still needs
encrypted off-site database and object-storage copies, tested key recovery, alerting, and approved
RPO/RTO values before its Production Gate.
