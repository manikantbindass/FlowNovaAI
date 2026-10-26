# Implementation plan

Baseline: `ea03cfe58b1b150640410891d474486abf019eb5` on GitHub main, verified 2026-10-26. Local directory initially held only an unborn Git repository. No existing user files were found. Branch: `codex/foundation`. Connected GitHub integration reports pull=true, push=false; collaborator-permissions endpoint returns 403. The independently authenticated owner GitHub CLI subsequently verified push/admin permission and is used for publication; do not use the read-only connector for writes.

1. Foundation: Next.js App Router/TypeScript, Spring Boot/Java 21 target, Flyway, PostgreSQL Compose, local file-backed H2 profile, CI, repeatable tests.
2. First vertical slice: authenticated local workspaces, role checks, XYFlow editor, server graph validation, revision-safe drafts, immutable publishing, database job queue, bounded deterministic execution, checkpointed node results, cancellation, history, real metrics.
3. AI: bounded server-configured provider adapter; fail clearly when credentials are absent. No fabricated responses.
4. Extend only after verified core: OIDC onboarding, safe network egress HTTP connector, webhooks/schedules, approval gates, encrypted tenant credentials, connector SDK, RAG, billing and production operations.

Use a modular monolith. SQL jobs share transactions with execution creation, avoiding a second queue and dual writes. Initially one in-process worker claims jobs via compare-and-set leases. All tenant queries verify persisted membership. No custom code execution. Unsupported roadmap features remain labeled planned.

Local limitations: Docker daemon was unavailable at inspection; Java launcher environment points at a missing JDK 22, while JDK 25 is installed. Use explicit JAVA_HOME. Local H2 is a development alternative, not proof of PostgreSQL compatibility. Do not claim deployment, recovery, or scalability until tested.

Hosted extension delivered: Next.js Functions, sealed browser sessions, private Blob persistence with conditional writes, Vercel Workflows durable steps, bounded execution, and a verified live application. See PROGRESS.md and TESTING.md for current evidence.
