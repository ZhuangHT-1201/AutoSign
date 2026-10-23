const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const APP_SCHEME = 'classmark';
const ALLOWED_HOSTS = new Set([
  'byxt.buaa.edu.cn',
  'sso.buaa.edu.cn',
  'uc.buaa.edu.cn',
  'gsmis.buaa.edu.cn',
  'iclass.buaa.edu.cn',
  'd.buaa.edu.cn',
]);

let mainWindow = null;
let authWindow = null;

function isAllowedCampusUrl(value) {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1370,
    height: 880,
    minWidth: 960,
    minHeight: 660,
    show: false,
    backgroundColor: '#f3f5f0',
    title: '课迹',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'resources', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    if (devUrl && url.startsWith(devUrl)) return;
    if (url.startsWith('file:') || url.startsWith(`${APP_SCHEME}:`)) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function openAuthWindow({ startUrl, successMarkers, title }) {
  if (!isAllowedCampusUrl(startUrl)) {
    return Promise.reject(new Error('不支持校园认证地址。'));
  }
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.focus();
    return Promise.resolve({ success: false, url: '', cancelled: true });
  }
  const markers = Array.isArray(successMarkers)
    ? successMarkers.filter((marker) => typeof marker === 'string' && marker.length > 0)
    : [];
  const homeappBase = /^(.*?\/jwapp\/sys\/homeapp)(?:\/|$)/.exec(startUrl)?.[1];
  const probeUrl = homeappBase ? `${homeappBase}/api/home/currentUser.do` : null;

  return new Promise((resolve) => {
    let settled = false;
    let closeTimer = null;
    let latestUrl = startUrl;
    authWindow = new BrowserWindow({
      width: 1040,
      height: 780,
      minWidth: 720,
      minHeight: 600,
      parent: mainWindow ?? undefined,
      modal: Boolean(mainWindow),
      show: false,
      title: typeof title === 'string' ? title : '校园统一认证',
      backgroundColor: '#f7f8f6',
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    const settle = (result) => {
      if (settled) return;
      settled = true;
      if (closeTimer) clearTimeout(closeTimer);
      resolve(result);
    };

    const inspectUrl = (url) => {
      if (settled) return;
      latestUrl = url || latestUrl;
      if (markers.some((marker) => url.includes(marker))) {
        if (closeTimer) return;
        closeTimer = setTimeout(async () => {
          closeTimer = null;
          let authenticated = !probeUrl;
          if (probeUrl) {
            try {
              const response = await session.defaultSession.fetch(probeUrl, {
                credentials: 'include',
                headers: {
                  Accept: 'application/json, text/javascript, */*; q=0.01',
                  'X-Requested-With': 'XMLHttpRequest',
                },
                signal: AbortSignal.timeout(8_000),
              });
              const body = (await response.text()).trimStart();
              authenticated =
                response.ok &&
                (body.startsWith('{') || body.startsWith('[')) &&
                !body.includes('统一身份认证') &&
                !body.includes('name="execution"');
            } catch {
              authenticated = false;
            }
          }
          if (!authenticated || settled) return;
          if (authWindow && !authWindow.isDestroyed()) authWindow.close();
          settle({ success: true, url });
        }, 700);
      }
    };

    authWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (isAllowedCampusUrl(url)) {
        authWindow.loadURL(url);
      } else if (/^https?:\/\//i.test(url)) {
        void shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    authWindow.webContents.on('did-navigate', (_event, url) => inspectUrl(url));
    authWindow.webContents.on('did-navigate-in-page', (_event, url) => inspectUrl(url));
    authWindow.webContents.on('did-redirect-navigation', (_event, url) => inspectUrl(url));
    authWindow.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
      if (isMainFrame && code !== -3) {
        settle({
          success: false,
          url: url || authWindow.webContents.getURL(),
          cancelled: true,
        });
        if (authWindow && !authWindow.isDestroyed()) authWindow.close();
      }
    });
    authWindow.once('ready-to-show', () => authWindow.show());
    authWindow.on('closed', () => {
      const finalUrl = latestUrl;
      const returnedToTarget = markers.some((marker) => finalUrl.includes(marker));
      authWindow = null;
      settle({
        success: returnedToTarget,
        url: finalUrl,
        cancelled: !returnedToTarget,
      });
    });
    authWindow.loadURL(startUrl);
  });
}

async function performRequest(input) {
  if (!input || !isAllowedCampusUrl(input.url)) {
    throw new Error('不允许访问该网络地址。');
  }
  const method = ['GET', 'POST', 'HEAD'].includes(input.method) ? input.method : 'GET';
  const timeoutMs = Math.min(Math.max(Number(input.timeoutMs) || 12_000, 1_000), 30_000);
  const headers = {};
  if (input.headers && typeof input.headers === 'object') {
    for (const [key, value] of Object.entries(input.headers)) {
      if (typeof key === 'string' && typeof value === 'string') headers[key] = value;
    }
  }
  const referrer = headers.Referer || headers.referer;
  delete headers.Referer;
  delete headers.referer;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await session.defaultSession.fetch(input.url, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : input.body,
      redirect: input.redirect === false ? 'manual' : 'follow',
      credentials: 'include',
      referrer: referrer && isAllowedCampusUrl(referrer) ? referrer : undefined,
      referrerPolicy: 'strict-origin-when-cross-origin',
      signal: controller.signal,
    });
    return {
      status: response.status,
      body: method === 'HEAD' ? '' : await response.text(),
      url: response.url || input.url,
      contentType: response.headers.get('content-type') || '',
    };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('连接超时');
    throw new Error(error?.message || '校园网络请求失败');
  } finally {
    clearTimeout(timeout);
  }
}

ipcMain.handle('campus:request', (_event, input) => performRequest(input));
ipcMain.handle('campus:open-auth', (_event, input) => openAuthWindow(input));
ipcMain.handle('campus:clear-session', async () => {
  await session.defaultSession.clearStorageData({
    storages: ['cookies', 'serviceworkers'],
  });
});
ipcMain.handle('campus:open-external', async (_event, url) => {
  if (!/^https?:\/\//i.test(url)) throw new Error('不支持的外部链接');
  await shell.openExternal(url);
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(() => {
    createMainWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
