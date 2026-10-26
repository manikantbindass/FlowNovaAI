# Deployment

## Vercel-native hosted demo

Import `manikantbindass/FlowNovaAI` into Vercel. Set Root Directory to `apps/web`, Framework to Next.js, Node to 24, and include source outside the root directory. Install with `cd ../.. && npm ci`; build with `npm run build`. This uses the root lockfile and patched transitive overrides.

Connect a **private** Vercel Blob store to production/preview. The server uses its BLOB_READ_WRITE_TOKEN (or SDK-supported OIDC credentials); configure an independent SESSION_SECRET if no stable read/write token is provided. Keep API_ORIGIN unset. The Workflow SDK's withWorkflow wrapper builds durable workflow and step endpoints. Do not expose storage or session secrets through NEXT_PUBLIC variables. Visitors sign in with demo/demo and do not configure a backend.

Hosted workspace documents use authoritative metadata ETags, version-keyed content reads, and conditional writes. Run data, versions, checkpoints and audit entries persist privately. Durable orchestration and delays run on Vercel Workflows. Limits: 25 workflows, 20 versions per workflow, 50 execution records, 2 active runs, 2 MB workspace data, and a 120-second run deadline. Vercel Hobby caps additionally apply. This is an evaluation deployment, not production organizational identity or a measured scaling result.

The Vercel connection may require approval for the owner's default project scope. Do not create a project in another scope to bypass an access denial. A deployment is successful only once Vercel reports READY and the resulting URL is verified. Add the verified URL to README and the repository homepage; do not invent it before deployment.

## Java/PostgreSQL deployment option

1. Choose a host for a long-running Java container and a persistent PostgreSQL service. The worker needs a continuously running process; a frontend serverless function is not a durable worker host.
2. Use the API Dockerfile. Set server binding to 0.0.0.0 behind a private load balancer/reverse proxy. Run the production Spring profile and supply DATABASE_URL, DATABASE_USER, DATABASE_PASSWORD, OIDC_ISSUER_URI, and OIDC_AUDIENCE. Use a managed secret store for provider keys.
3. Configure an OIDC provider and provision workspace/membership rows for authenticated subject identifiers. Browser authorization-code/PKCE integration still needs implementation; current production API supports authorized bearer-token clients.
4. Terminate HTTPS, restrict database/network ingress, configure connection pools, and apply Flyway migrations deliberately. Do not use the local demo profile for private data.
5. Set server-side API_ORIGIN in Vercel to the HTTPS API origin and redeploy. This alone does not complete the planned browser OIDC flow.
6. Configure monitoring, log redaction, rate limits, retention, backups, restore exercises, rollout approval, and cost alerts. Verify tenant denial tests against PostgreSQL and production identity before inviting users.

## Recovery and rollback

Keep database backups outside the application host. Test restore in an isolated environment; the repository does not contain a verified backup service. Roll back the application image only when its expected schema remains compatible. Use expand/contract migrations and forward repair; avoid automatic destructive SQL rollback. Stale execution leases reconcile after expiration, but arbitrary external side effects must not be replayed blindly.

## Scaling gates

The current worker is sequential per process and has no benchmarked throughput guarantee. Separate API/worker roles, test lease claims on PostgreSQL, set bounded pools, apply tenant fairness/backpressure, and measure queue age/depth before scaling replicas. Local in-memory sessions and per-IP request limits are not shared across replicas. Redis is a candidate for shared limits/session coordination, not a substitute for the durable SQL execution queue. Add S3-compatible storage only when documents/artifacts need it.

GitHub Actions defines frontend/backend checks, a PostgreSQL service test, container builds/scanning, and source secret scanning. These remote jobs and container builds are unverified until they run successfully; local test evidence is recorded separately.
