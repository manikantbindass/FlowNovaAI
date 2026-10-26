import assert from 'node:assert/strict';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';

const executablePath = path.resolve(process.env.DESKTOP_EXE || 'apps/desktop/dist/win-unpacked/FlowNova AI.exe');
// Use the main-process inspector for QA without enabling renderer DevTools.
const reserve = net.createServer();
await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
const port = reserve.address().port;
await new Promise(resolve => reserve.close(resolve));
const child = spawn(executablePath, [`--inspect=127.0.0.1:${port}`], { stdio: 'ignore', windowsHide: true });
child.on('error', error => { console.error(error.message); });
let socket;
let nextId = 0;
const requests = new Map();
async function evaluate(source) {
  const id = ++nextId;
  const result = new Promise((resolve, reject) => requests.set(id, { resolve, reject }));
  socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: source, awaitPromise: true, returnByValue: true } }));
  const timer = setTimeout(() => requests.get(id)?.reject(new Error('Inspector evaluation timed out')), 45000);
  try { return await result; } finally { clearTimeout(timer); requests.delete(id); }
}
try {
  const deadline = Date.now() + 90000;
  let endpoint;
  while (Date.now() < deadline) {
    try { endpoint = (await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json()))[0]?.webSocketDebuggerUrl; } catch {}
    if (endpoint) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(endpoint, 'Packaged executable started its main process');
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const request = requests.get(message.id);
    if (!request) return;
    if (message.error || message.result?.exceptionDetails) request.reject(new Error(JSON.stringify(message.error || message.result.exceptionDetails)));
    else request.resolve(message.result?.result?.value);
  });
  const electron = "process.mainModule.require('electron')";
  console.log('Inspector attached:', await evaluate('process.versions.electron'));
  let state;
  while (Date.now() < deadline) {
    state = await evaluate(`(async () => {
      const { webContents } = ${electron};
      const page = webContents.getAllWebContents().find(page => page.getURL().startsWith('https://flownova-ai.vercel.app/'));
      if (!page) return null;
      if (page.isLoadingMainFrame()) return { loading: true, url: page.getURL() };
      return {
        url: page.getURL(),
        preferences: page.getLastWebPreferences(),
        content: await page.executeJavaScript('({ text: document.body.innerText, node: typeof require, process: typeof process })')
      };
    })()`);
    console.log('Page:', JSON.stringify(state && {url: state.url, loading: state.loading, rendered: !!state.content}));
    if (state?.content?.text?.includes('demo / demo') || state?.content?.text?.includes('Overview')) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(state?.content?.text?.includes('demo / demo') || state?.content?.text?.includes('Overview'), 'Hosted login or workspace rendered');
  assert.equal(state.preferences.nodeIntegration, false);
  assert.equal(state.preferences.contextIsolation, true);
  assert.equal(state.preferences.sandbox, true);
  assert.equal(state.content.node, 'undefined');
  assert.equal(state.content.process, 'undefined');
  const api = await evaluate(`(async () => {
    const { webContents } = ${electron};
    const page = webContents.getAllWebContents().find(page => page.getURL().startsWith('https://flownova-ai.vercel.app/'));
    return page.executeJavaScript(${JSON.stringify(`(async () => {
      const session = await fetch('/api/v1/auth/session').then(r => r.json());
      const response = await fetch('/api/v1/auth/login', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded','X-CSRF-TOKEN':session.csrf}, body:'username=demo&password=demo'});
      const workspaces = await fetch('/api/v1/workspaces');
      return { login: response.status, workspaces: workspaces.status, count: (await workspaces.json()).length };
    })()`)});
  })()`);
  assert.equal(api.login, 200);
  assert.equal(api.workspaces, 200);
  assert.ok(api.count > 0);
  const screenshot = await evaluate(`(async () => {
    const { BrowserWindow } = ${electron};
    return (await BrowserWindow.getAllWindows()[0].capturePage()).toPNG().toString('base64');
  })()`);
  await mkdir('.tools', { recursive: true });
  await writeFile('.tools/desktop-smoke.png', Buffer.from(screenshot, 'base64'));
  console.log(JSON.stringify({ executablePath, rendered: true, sandboxed: true, nodeAccess: false, login: api.login, workspaces: api.count }));
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ id: ++nextId, method: 'Runtime.evaluate', params: { expression: "process.mainModule.require('electron').app.exit(0)" } }));
    await new Promise(resolve => setTimeout(resolve, 500));
    socket.close();
  }
  if (child.exitCode === null) child.kill();
}
