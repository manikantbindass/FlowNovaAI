# Windows desktop client

[Download the portable Windows x64 executable](https://github.com/manikantbindass/FlowNovaAI/releases/latest). Download the `.exe` and open it. No administrator install, Java, Node.js, or separate backend setup is required. Windows 10/11 x64 is the target; Windows ARM and other operating systems have not been tested.

This is an Electron desktop client for https://flownova-ai.vercel.app. It needs internet access and uses the same hosted limits, authentication and execution runtime as the website. It does not bundle an offline backend. Sign in with **demo / demo**. Desktop cookies are separate from your normal browser, so each gets its own demo workspace. Use workflow JSON export/import to transfer definitions. Clearing the app's profile loses access to its browser-scoped demo workspace. Download updates manually from the Help menu or GitHub Releases.

The executable is **unsigned**: no code-signing certificate was supplied, and Windows may identify its publisher as unknown. Compare its SHA-256 hash with `SHA256SUMS.txt` in the same release. No automatic updater, startup service or registry installation is included. Portable describes the single-file distribution; Electron still writes its session/cache profile under the user's application-data directory.

## Reproduce a build

On Windows x64 with Node.js 24:

```powershell
npm ci --prefix apps/desktop
npm test --prefix apps/desktop
npm audit --prefix apps/desktop --audit-level=high
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
npm run dist --prefix apps/desktop
```

The artifact is `apps/desktop/dist/FlowNova-AI-0.1.0-windows-x64.exe`. Build output and dependencies are excluded from Git. The pinned desktop dependencies have their own lockfile and do not change the web application workspace. The Windows desktop GitHub Actions workflow builds a downloadable artifact; publishing an official release remains a separate action.

After root `npm ci`, `node scripts/desktop-smoke.mjs` checks the unpacked executable against the hosted service: rendering, sandbox preferences, absence of renderer Node APIs, public sign-in, and workspace access. Set `DESKTOP_EXE` to test another executable path. The main web suite separately checks authoring, publishing and real execution.

## Desktop boundaries

Remote content lives in a sandboxed WebContentsView, with Node integration disabled, context isolation enabled and no preload bridge or application IPC. Navigation stays on the exact HTTPS app origin. Only links within this GitHub repository may open in the system browser. Other windows, device permissions, webviews and insecure navigation are denied. Workflow exports use a save dialog. Do not disable the sandbox or TLS validation to work around a connection failure; use View → Reload workspace after restoring internet access.

These controls follow [Electron's security guidance](https://www.electronjs.org/docs/latest/tutorial/security). Keep Electron current and rebuild for security fixes. Packaging uses [electron-builder's portable target](https://www.electron.build/v26/docs/targets/).
