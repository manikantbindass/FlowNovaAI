# Development

See README for two-terminal startup and `demo` / `demo`. Verified toolchain: Node 24.14.1, npm 11.11.0, JDK 25.0.1, Java bytecode target 21. Frontend dependencies are exact versions in package.json and locked at the monorepo root. Maven wrapper came from Spring Initializr and downloads its distribution automatically. Boot 4.0.8 is pinned in pom.xml.

The original Windows machine had JAVA_HOME pointing to a missing JDK 22; use the actual installed JDK. Its Oracle javapath launcher hung, while `C:\Program Files\Java\jdk-25\bin\java.exe` worked. Do not copy that machine-specific path onto another system. Ports 3000, 3100, and 8080 belonged to existing services; use 3210/8181 or choose available ports. Never stop unrelated processes.

Next.js runs from apps/web with the root lockfile. Local API defaults to loopback, port 8080, the local authentication profile, and a file-backed H2 database. SERVER_PORT=8181 changes the API port. Set API_ORIGIN on the web process to match. The proxy forwards session cookies and CSRF headers. No database credentials or model keys are public environment variables.

`npm run dev --workspace apps/web -- --port 3210` is useful during editing. On a slow or synchronized filesystem, cold Next.js/Turbopack compilation can delay navigation; use a production build to verify runtime behavior. Keep only one build/dev command operating on a given .next output at a time.

Frontend controls explicitly save drafts; there is no autosave. A revision conflict produces an error rather than data loss. Export a JSON backup before risky edits. Import validates the interchange schema; backend validation is authoritative at publishing. Browser theme preference is the only application setting stored in localStorage.

On Vercel without API_ORIGIN, /auth/session reports vercel mode; the hosted adapter uses private Blob storage and Vercel Workflows. /setup explains both this working hosted demo and the optional Java deployment. No Java server is started inside Vercel. Public demo credentials create private browser-scoped workspaces; keep the session cookie to return to that data.
