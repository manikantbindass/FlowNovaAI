# Vercel-native hosted runtime

The owner requested a working deployment without a separately hosted Java backend. The initial frontend-only preview was insufficient for that revised requirement.

## Decision

Add a clearly identified hosted demo runtime inside Next.js. It uses iron-session sealed HttpOnly cookies, one private workspace per browser account group, Vercel Blob for durable JSON workspace records, optimistic ETag conditional writes, and Vercel Workflows for durable graph execution and delays. The Spring Boot/PostgreSQL runtime remains available for local development and future enterprise deployment.

The hosted API preserves the editor's HTTP contracts. Deterministic node behavior is implemented in TypeScript for the Vercel runtime and Java for the relational runtime. This is an explicit tradeoff against the original single-Java-runtime preference, authorized by the later request for Vercel-only operation. Both implementations need behavior/contract tests; do not let supported types or semantics diverge silently.

## Bounds

Hosted workspaces are public-credential demo accounts with private browser-scoped data, not identity-verified organizations. Credentials are demo/demo by default. Roles and workspace boundaries are enforced server-side; cookie data is authenticated/encrypted by iron-session. Visitors do not receive storage or session secrets. A shared secret is derived from the server-only store token unless SESSION_SECRET is supplied. Rotating it invalidates sessions.

Blob records use uncached reads and conditional ETag writes, avoiding silently lost updates. This is bounded workspace storage, not a scalable relational database replacement. Limits: 25 workflows, 20 published versions per workflow, 50 execution records, 2 active runs, 2 MB workspace document, 50 graph nodes, 100 edges, 16 KB input, 32 KB node output, and a 120-second run deadline. The Hobby account's provider limits can stop service; no throughput guarantee is asserted.

Workflow steps record node checkpoints and persisted events. Provider calls remain at-least-once if a step retries after a crash. Queuing and Blob updates span services; failures are reported and compensated where possible, not claimed to form a distributed transaction.

The hosted demo needs no visitor setup. AI keys and future OAuth connectors still require owner configuration. Browser OIDC organizations, billing, unsafe network/code execution, RAG, and external connectors remain planned. Do not call this an enterprise production release.

## References

- https://vercel.com/docs/vercel-blob/using-blob-sdk (uncached reads, ETags, conditional writes)
- https://vercel.com/docs/vercel-blob/usage-and-pricing (Hobby caps)
- https://workflow-sdk.dev/docs/getting-started/next (durable workflow integration)
- https://github.com/vvo/iron-session (session library)
