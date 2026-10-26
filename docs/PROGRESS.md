# Progress

2026-10-27: Functional hosted core deployed at https://flownova-ai.vercel.app. Visitors can sign in with demo/demo, create and edit workflows, publish immutable versions, execute real nodes, and inspect persisted results without a separate Java server. Private Blob storage and Vercel Workflows provide the bounded hosted runtime. The Spring Boot relational runtime remains available locally.

Verified: 20 Java tests, 19 frontend/runtime tests, four live Playwright tests, hosted HTTP smoke checks, lint, TypeScript, production build, and npm audit (zero vulnerabilities). Hosted checks include revision conflicts, immutable snapshots, idempotency, restore, redaction, CSRF, tenant denial, viewer permissions, reload persistence, and mobile layout. Docker/PostgreSQL and container scans await CI; no load or enterprise readiness claim is made.

Delivered: nine real screenshots, an animated workflow journey, animated README header/footer, root architecture.md, a 21-page PDF, and a validated editable 23-slide PowerPoint. The connected GitHub API is read-only, but the independently authenticated owner CLI has repository write access and is used for publication.
