# Testing and evidence

Verified on 2026-10-26/27: 20 Java tests, 19 Vitest tests, four live Playwright tests, lint, TypeScript, production build, and npm audit with zero vulnerabilities. Live hosted smoke checks exercised creation, save, validation, publication, stale-revision denial, immutable execution, idempotency, successful durable execution, redaction, restore, and cross-workspace denial. Browser tests covered the complete authoring/execution journey, CSRF and tenant denial, viewer writes, persistence after reload, and a 390px mobile viewport.

Commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; in apps/api, `./mvnw verify` (`.\mvnw.cmd verify` on Windows). Run `npm run test:e2e` against configured servers, setting WEB_URL and LOCAL_PASSWORD if overridden. The live smoke script is scripts/hosted-smoke.mjs.

Java tests cover save/publish/execute, immutable snapshots, revisions, roles, tenant denial, idempotency, invalid nodes, cancellation, stale leases, recovery bounds, checkpoints, deadline, branches, redaction, advanced nodes, restore, and unconfigured AI failure. Hosted unit tests cover deterministic processing and conditional storage writes. These are behavioral checks, not measured code coverage.

H2 is the default test database. Set TEST_DATABASE_URL to a disposable PostgreSQL database with DATABASE_USER and DATABASE_PASSWORD; never use production. CI includes PostgreSQL and container checks. The local Docker daemon was stopped; GitHub CI subsequently passed PostgreSQL integration and both container builds. Its blocking vulnerability scan identified inherited Java/Alpine packages; patched versions are being rechecked. Worker-process termination, high concurrency, live provider calls, browser OIDC, SSRF-safe connectors, retrieval, backup restoration, and performance targets remain unverified or unimplemented. No exactly-once or scale guarantee is claimed.

The 21-page PDF was rendered and visually checked. The 23-slide PowerPoint was rendered, checked for layout and package integrity, and successfully imported by the presentation validation tool. Native PowerPoint execution was not tested.
