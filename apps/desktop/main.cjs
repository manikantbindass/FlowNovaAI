'use strict';
const { app, BrowserWindow, WebContentsView, Menu, shell, session } = require('electron');
const path = require('node:path');
const { APP_ORIGIN, REPOSITORY, isAppUrl, isRepositoryUrl } = require('./policy.cjs');

app.setName('FlowNova AI');
app.enableSandbox();
const primary = app.requestSingleInstanceLock();
let window;
let view;
if (!primary) app.quit();
else {
  app.on('second-instance', () => {
    if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); }
  });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}

function createWindow() {
  const profile = session.fromPartition('persist:flownova-workspace');
  profile.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  profile.setPermissionCheckHandler(() => false);
  profile.on('will-download', (_event, item) => {
    // Keep user-initiated workflow exports interactive; never silently overwrite files.
    item.setSaveDialogOptions({ title: 'Save FlowNova export' });
  });
  window = new BrowserWindow({
    width: 1440, height: 940, minWidth: 390, minHeight: 600,
    title: 'FlowNova AI', icon: path.join(__dirname, 'build/icon.png'), backgroundColor: '#080b16', show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, devTools: false }
  });
  window.loadFile(path.join(__dirname, 'shell.html'));
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  view = new WebContentsView({ webPreferences: {
    session: profile, nodeIntegration: false, contextIsolation: true, sandbox: true,
    webSecurity: true, allowRunningInsecureContent: false, webviewTag: false, devTools: false
  }});
  const resize = () => {
    const [width, height] = window.getContentSize();
    view.setBounds({ x: 0, y: 0, width, height });
  };
  window.on('resize', resize);
  const navigate = (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    if (isRepositoryUrl(url)) void shell.openExternal(url);
  };
  view.webContents.on('will-navigate', navigate);
  view.webContents.on('will-redirect', navigate);
  view.webContents.on('will-attach-webview', event => event.preventDefault());
  view.webContents.setWindowOpenHandler(({ url }) => {
    if (isRepositoryUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  // Attach before loading: a detached native view can defer renderer startup.
  window.contentView.addChildView(view);
  view.setBackgroundColor('#080b16');
  resize();
  let attached = true;
  view.webContents.on('did-finish-load', () => {
    if (!isAppUrl(view.webContents.getURL())) return;
    if (!attached) { window.contentView.addChildView(view); attached = true; }
    resize();
  });
  view.webContents.on('did-fail-load', (_event, code, _description, _url, mainFrame) => {
    if (!mainFrame || code === -3) return;
    if (attached) { window.contentView.removeChildView(view); attached = false; }
  });
  const loadWorkspace = () => { void view.webContents.loadURL(`${APP_ORIGIN}/app`).catch(() => {}); };
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'FlowNova AI', submenu: [
      { label: 'Open workspace', click: loadWorkspace },
      { label: 'Open in browser', click: () => shell.openExternal(APP_ORIGIN) },
      { type: 'separator' }, { role: 'quit' }
    ]},
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [
      { label: 'Reload workspace', accelerator: 'CmdOrCtrl+R', click: loadWorkspace },
      { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }
    ]},
    { label: 'Help', submenu: [
      { label: 'Download updates', click: () => shell.openExternal(`${REPOSITORY}/releases`) },
      { label: 'Documentation', click: () => shell.openExternal(REPOSITORY) },
      { label: 'Report an issue', click: () => shell.openExternal(`${REPOSITORY}/issues`) }
    ]}
  ]));
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => { if (!view.webContents.isDestroyed()) view.webContents.close(); window = null; });
  loadWorkspace();
}
