# Contributing

Start with README and docs/DEVELOPMENT.md. Use a feature branch, keep business rules in Java, preserve tenant predicates and immutable versions, and add behavior tests for authorization and execution changes. Avoid committing secrets, generated build output, local databases, and environment files. Use exact dependency versions and the root lockfile.

Before submitting: run frontend lint/typecheck/tests/build and backend verify; describe what changed, why, and what was actually tested. Do not weaken tests to hide a real failure. Document unavailable providers and external dependencies. New nodes need a versioned editor contract, authoritative server validation, bounded execution, and tests. Network or code execution nodes need a complete security design before being exposed.
