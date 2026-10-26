# Database

`apps/api/src/main/resources/db/migration/V1__core.sql` defines workspaces, memberships, workflows, workflow versions, executions, node executions, execution events, and audit logs. IDs are UUID strings except the deliberate local workspace seed IDs. Times use epoch milliseconds. Graphs and payloads are JSON serialized to SQL TEXT for portability between PostgreSQL and the local H2 profile. Native JSONB is deferred until the portability tradeoff is measured.

Ownership is verified by membership queries; composite foreign keys link execution and version ownership to the workflow workspace. Indexes cover workspace histories and queue status/lease scans. Idempotency keys are unique per workspace. Execution creation locks the workspace row to serialize limit checks and duplicate keys. Draft saves use conditional revision updates. Publishing locks the workflow before choosing the next version.

Checkpoints and corresponding events share a transaction. Terminal state updates are guarded by the current claim token and RUNNING state. Cancellation locks indirectly through the execution UPDATE and prevents later checkpoint commits from changing terminal state.

Flyway validates migration checksums on startup. Never edit an applied migration; add a new one. Back up PostgreSQL before schema changes. Prefer forward-compatible schema changes and forward repair; do not attempt untested automatic downgrade scripts. Test restore from a backup in staging before production. Local H2 data lives in `apps/api/.data` and must not be committed.

Retention, soft deletion, user erasure, PostgreSQL RLS, document/object storage, subscription records, and archival jobs are not implemented. Do not run with unbounded production retention without first defining those policies.
