# Advanced platform roadmap toward 2027

These are proposed engineering increments, not delivered capabilities or predictions of future standards. Priorities follow tested user needs. The current release remains a local foundation with a frontend-only hosting option.

## Implemented foundations

The visual editor, draft revisions, immutable versions, tenant checks, database queue, bounded recovery, execution history, real metrics, deterministic templates, field-name redaction, and optional bounded AI call provide a base. The advanced increment adds collection filter/pluck/take/count, data assertions, and version-to-draft restore. No benchmark has established horizontal scale.

## Phase A: dependable hosted core

- Browser OIDC authorization code/PKCE onboarding, invitations, owner/admin/editor/viewer administration, session revocation, and tenant-denial coverage.
- Separate API and worker roles; bounded worker pools, PostgreSQL claim/concurrency tests, tenant fairness, retry policies with backoff/jitter, queue age/depth and dead-letter inspection.
- Durable schedules and signed incoming webhooks with replay protection. Approval state transitions with authenticated decision records and expiry.
- Version diff/review, controlled restore, autosave conflict UX, validation on a shared node-schema registry, server event cursors and reconnect recovery.
- Usage ledger, token/cost budgets, per-tenant concurrency, durable quotas, request/body caps, and rate limits shared across replicas.

Acceptance: PostgreSQL E2E suite; actual worker-kill recovery; cross-tenant concurrent tests; staging backup restore; measured 100-user and 1,000-queued-run workloads with documented hardware/latency/errors.

## Phase B: controlled tools and integrations

- A typed connector SDK with capability manifests, scopes, input/output schema, rate limits, credential references, retry semantics, and test-connection behavior.
- Safe HTTP egress before generic HTTP nodes: IP/DNS/redirect validation, network deny rules, metadata/private-address protection, bounded responses, allowlists for privileged internal access.
- Encrypted workspace credentials and OAuth refresh/revocation; GitHub and Slack before expanding to mail/sheets/chat connectors.
- MCP adapters can expose approved tools/resources, with explicit consent and isolation per workspace. Do not auto-trust a remote server or expose unrelated credentials. The MCP specification describes a host/client/server boundary; FlowNova's proposed adapter must preserve it. [MCP architecture](https://modelcontextprotocol.io/specification/2026-07-28/architecture).

Acceptance: mocked provider failures, redirects and rebinding attempts, revoked tokens, duplicate delivery, secret-redaction tests, approval enforcement, and connector-specific idempotency evidence.

## Phase C: bounded agent execution

- Typed agent tasks with explicit tool allowlists, instructions, input/output schemas, maximum iterations, wall-clock/token/cost budgets, and human approval for privileged effects.
- Structured workflow generation: schema-constrained output, supported node registry, missing-connection reporting, human review, and explicit publish/run confirmation.
- Semantic output validation and evaluation datasets. OpenAI documents that JSON mode guarantees JSON format whereas Structured Outputs can constrain a supplied schema; the current adapter uses JSON mode, so stricter semantics remain future work. [Official structured-output guidance](https://developers.openai.com/api/docs/guides/structured-outputs).
- A2A interoperability can be evaluated for authenticated delegation to independent agents. Preserve task identity, cancellation, provenance, authorization and budget propagation. [Official A2A specification](https://a2a-protocol.org/latest/specification/).

Acceptance: prompt-injection test corpus, tool-scope denial tests, malformed/refused/truncated output cases, token and money limits, traceable delegated tasks, and model/provider regression evaluation.

## Phase D: knowledge, governance, and scale

- Signed uploads, safe extraction, chunking, object storage, pgvector retrieval, source citations, deletion propagation, and tenant-isolated evaluation.
- Audit export/retention, role-specific approval policies, workflow promotion between environments, backup drills and incident playbooks.
- Optional provider-agnostic billing with verified signatures and durable usage reconciliation. Prices, tax/business policies, and production provider credentials require owner decisions.
- OpenTelemetry traces through API/worker/provider; SLOs derived from measured workloads; load shedding and cost alerts.

## Architecture policy

Keep the modular monolith until workload or ownership justifies extraction. Use PostgreSQL as the transaction authority. Introduce Redis for shared ephemeral coordination only when necessary; keep execution state durable. Add object storage when real document/artifact workloads arrive. Avoid Kubernetes or multiple databases without evidence. Deployment, compliance, and reliability claims require tests; a 2027 label does not establish them.

Sources consulted 2026-10-26. External protocol/API specifications evolve; pin the reviewed version at implementation time and review its security guidance.
