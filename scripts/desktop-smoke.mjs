import assert from 'node:assert/strict';
import path from 'node:path';
import { _electron } from 'playwright';

const executablePath = path.resolve(process.env.DESKTOP_EXE || 'apps/desktop/dist/win-unpacked/FlowNova AI.exe');
const client = await _electron.launch({ executablePath, timeout: 60000 });
try {
  await client.firstWindow();
  const deadline = Date.now() + 60000;
  let state;
  while (Date.now() < deadline) {
    state = await client.evaluate(async ({ webContents }) => {
      const page = webContents.getAllWebContents().find(page => page.getURL().startsWith('https://flownova-ai.vercel.app/'));
      if (!page) return null;
      return {
        url: page.getURL(),
        preferences: page.getLastWebPreferences(),
        content: await page.executeJavaScript('({ text: document.body.innerText, node: typeof require, process: typeof process })')
      };
    });
    if (state?.content?.text?.includes('demo / demo') || state?.content?.text?.includes('Overview')) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(state?.content?.text?.includes('demo / demo') || state?.content?.text?.includes('Overview'), 'Hosted login or workspace rendered');
  assert.equal(state.preferences.nodeIntegration, false);
  assert.equal(state.preferences.contextIsolation, true);
  assert.equal(state.preferences.sandbox, true);
  assert.equal(state.content.node, 'undefined');
  assert.equal(state.content.process, 'undefined');
  const api = await client.evaluate(async ({ webContents }) => {
    const page = webContents.getAllWebContents().find(page => page.getURL().startsWith('https://flownova-ai.vercel.app/'));
    return page.executeJavaScript(`(async () => {
      const session = await fetch('/api/v1/auth/session').then(r => r.json());
      const response = await fetch('/api/v1/auth/login', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded','X-CSRF-TOKEN':session.csrf}, body:'username=demo&password=demo'});
      const workspaces = await fetch('/api/v1/workspaces');
      return { login: response.status, workspaces: workspaces.status, count: (await workspaces.json()).length };
    })()`);
  });
  assert.equal(api.login, 200);
  assert.equal(api.workspaces, 200);
  assert.ok(api.count > 0);
  console.log(JSON.stringify({ executablePath, rendered: true, sandboxed: true, nodeAccess: false, login: api.login, workspaces: api.count }));
} finally {
  await client.close();
}
