# API

The hosted Vercel adapter preserves these endpoints. It reports `mode:vercel`, uses sealed cookie sessions and CSRF, and isolates browser-scoped demo workspaces in private Blob storage. Its records are bounded (25 workflows, 20 versions, 50 runs, 2 active runs, 2 MB). Workflows execute through Vercel Workflows. With API_ORIGIN configured, the proxy uses the Java API described below instead. No visitor Java setup is required for the hosted demo.

Base prefix: `/api/v1`. The Next.js proxy reads server-side `API_ORIGIN` at request time. Browser calls remain same-origin. Local sessions require the CSRF token returned by `/auth/session` in its named header for POST/PUT/logout. Login uses form-encoded `username` and `password`; logout is POST. Production uses externally issued JWT bearer tokens with configured issuer and audience, plus provisioned subject memberships.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/auth/session` | Session metadata and CSRF token; unauthenticated allowed |
| POST | `/auth/login` | Local-profile form login |
| POST | `/auth/logout` | Local-profile session invalidation |
| GET | `/workspaces` | Current actor's memberships |
| GET, POST | `/workspaces/{w}/workflows` | List/create; limit 1-100, offset >= 0 |
| GET, PUT | `/workspaces/{w}/workflows/{id}` | Read/save draft with expected revision |
| POST | `/workspaces/{w}/workflows/{id}/validate` | Return node-addressable issues |
| POST | `/workspaces/{w}/workflows/{id}/publish` | Publish `{revision}` after validation |
| GET | `/workspaces/{w}/workflows/{id}/versions` | Immutable version metadata |
| GET | `/workspaces/{w}/workflows/{id}/versions/{version}` | Read a snapshot graph |
| POST | `/workspaces/{w}/workflows/{id}/versions/{version}/restore` | Copy snapshot into draft using `{revision}` |
| POST | `/workspaces/{w}/workflows/{id}/execute` | Queue published version with JSON input and Idempotency-Key |
| GET | `/workspaces/{w}/executions` | Paginated execution history |
| GET | `/workspaces/{w}/executions/{id}` | Execution metadata, node checkpoints, persistent events |
| POST | `/workspaces/{w}/executions/{id}/cancel` | Cancel QUEUED/RUNNING; returns 204 |
| GET | `/workspaces/{w}/analytics/overview` | Real workspace aggregates |
| GET | `/workspaces/{w}/audit-logs` | Latest 100 workspace audit entries |
| GET | `/capabilities` | Supported nodes and configured AI metadata; authenticated |

Workflow save body: `{name, description, graph:{nodes,edges}, revision}`. Node data: `{kind,schemaVersion:1,label,config}`. Execution input must be an object <=16 KB; draft graph <=128 KB; request body <=256 KB; node output <=32 KB. Graph limits are 50 nodes / 100 edges. Exactly one manual trigger is required. No cycles or joins.

Application errors return `{message,status}`. Security filter errors may use Spring's standard error body. HTTP 401 means authentication required; 403 means role/CSRF denial; 404 also hides inaccessible tenant resources; 409 means revision/state/idempotency conflict; 422 means graph cannot publish; 429 means a configured limit; 503 on Vercel preview means no backend configured. `X-Request-ID` correlates requests. Pagination uses limit/offset without a total envelope. OpenAPI generation and cursor-based events are planned; this document is not an assertion that an OpenAPI endpoint exists.
